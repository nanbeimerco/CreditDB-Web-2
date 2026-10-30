"""Web 版で使う DB を作る。

アプリ版リポジトリ (CreditDB-Pro-Mobile) の最新データ Release から creditdb.zip を取得し、
Web で使わない部分を外して public/data/creditdb.dat（gzip 圧縮した SQLite）と version.json を書き出す。
拡張子を .gz にしないのは、サーバーが自動で展開して送ってくるのを避けるため（ブラウザには圧縮したまま保存する）。

使い方:
  python scripts/build_web_db.py                     # 最新 Release から作る
  python scripts/build_web_db.py --input creditdb.zip # 手元のファイルから作る
  python scripts/build_web_db.py --print-latest-tag   # 最新 Release のタグだけ表示
"""

import argparse
import gzip
import hashlib
import json
import os
import shutil
import sqlite3
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

SOURCE_REPO = "nanbeimerco/CreditDB-Pro-Mobile"
DB_ASSET = "creditdb.zip"
SCHEMA_VERSION = 1  # Web 側が期待する DB の形。下の REQUIRED を変えたら上げる

# Web が使うテーブルと列。足りなければビルドを失敗させる（サイトは前回のデータのまま残る）
REQUIRED = {
    "summary": ["total_works", "total_staff", "total_cv", "year_min", "year_max", "updated_at", "version", "global_mean"],
    "works": ["work_id", "title", "title_en", "year", "anilist_raw_score", "deviation_score", "z_score_rank",
              "predicted_score", "residual", "performance_verdict", "tier", "percentile",
              "staff_json", "characters_json", "search_text_norm", "episodes"],
    "leaderboards": ["role", "name", "name_norm", "works_count", "bayesian_rating", "career_cumulative_z",
                     "rating_rank", "cumulative_rank", "rating_tier", "cumulative_tier",
                     "best_work_title", "best_work_year", "top_character", "first_year", "latest_year"],
    "profiles": ["name", "name_norm", "primary_role", "total_works", "bayesian_rating", "overall_rating_tier",
                 "overall_rank", "career_cumulative_z", "overall_cum_tier", "cumulative_rank",
                 "all_role_stats_json", "first_year", "latest_year"],
    "studios": ["name", "name_norm", "works_count", "best_work_title", "best_work_year", "best_work_dev",
                "best_work_tier", "first_year", "latest_year"],
    "studio_works": ["studio_name", "work_id", "title", "year", "deviation_score", "tier"],
    "work_covers": ["work_id", "target"],
    "episode_scores": ["work_id", "episode", "source", "rating", "votes"],
    "staff_metrics": ["name", "role", "metric", "value", "n", "rank", "total", "tier"],
    "metric_validation": ["role", "method", "pearson", "spearman", "n"],
    "non_person_names": ["name"],
}

# Web では使わないもの（人物ごとの参加作品リストは作品データから組み立てる）
DROP_TABLES = ["imdb_map"]
DROP_COLUMNS = [("profiles", "career_trajectory_json")]


def http_get(url: str, accept: str = "application/json") -> bytes:
    headers = {"Accept": accept, "User-Agent": "CreditDB-Web-2-builder"}
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token and url.startswith("https://api.github.com/"):
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=120) as res:
        return res.read()


def latest_release() -> dict:
    """creditdb.zip を含む Release のうち、公開日時が一番新しいもの。
    一覧の並びはタグのコミット日時順で公開順とは限らないので、published_at で選び直す。"""
    data = json.loads(http_get(f"https://api.github.com/repos/{SOURCE_REPO}/releases?per_page=50"))
    candidates = [r for r in data if not r.get("draft") and any(a["name"] == DB_ASSET for a in r.get("assets", []))]
    if not candidates:
        sys.exit(f"{SOURCE_REPO} に {DB_ASSET} を含む Release が見つかりません")
    return max(candidates, key=lambda r: r["published_at"])


def extract_db(src: Path, work: Path) -> Path:
    out = work / "creditdb.db"
    if src.suffix == ".zip":
        with zipfile.ZipFile(src) as z:
            name = next(n for n in z.namelist() if n.endswith(".db"))
            with z.open(name) as f, open(out, "wb") as g:
                shutil.copyfileobj(f, g)
    elif src.suffix == ".gz":
        with gzip.open(src) as f, open(out, "wb") as g:
            shutil.copyfileobj(f, g)
    else:
        shutil.copy(src, out)
    return out


def validate(con: sqlite3.Connection) -> None:
    problems = []
    for table, cols in REQUIRED.items():
        have = {r[1] for r in con.execute(f"PRAGMA table_info({table})")}
        if not have:
            problems.append(f"テーブル {table} がありません")
            continue
        missing = [c for c in cols if c not in have]
        if missing:
            problems.append(f"{table} に列がありません: {', '.join(missing)}")
    n = con.execute("SELECT COUNT(*) FROM works").fetchone()[0]
    if n < 10000:
        problems.append(f"作品数が少なすぎます ({n})")
    if problems:
        sys.exit("DB が Web 版の想定と合いません:\n  " + "\n  ".join(problems))


def slim(db: Path) -> None:
    con = sqlite3.connect(db)
    validate(con)
    for t in DROP_TABLES:
        con.execute(f"DROP TABLE IF EXISTS {t}")
    for t, c in DROP_COLUMNS:
        if c in {r[1] for r in con.execute(f"PRAGMA table_info({t})")}:
            con.execute(f"ALTER TABLE {t} DROP COLUMN {c}")
    con.commit()
    con.execute("VACUUM")
    con.close()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", help="手元の creditdb.zip / .db / .db.gz（省略時は最新 Release から取得）")
    ap.add_argument("--out-dir", default="public/data")
    ap.add_argument("--print-latest-tag", action="store_true")
    args = ap.parse_args()

    if args.print_latest_tag:
        print(latest_release()["tag_name"])
        return

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        if args.input:
            src, tag, published = Path(args.input), "local", None
        else:
            rel = latest_release()
            tag, published = rel["tag_name"], rel["published_at"]
            asset = next(a for a in rel["assets"] if a["name"] == DB_ASSET)
            print(f"取得: {SOURCE_REPO} {tag} ({asset['size'] / 1e6:.1f} MB)")
            src = work / DB_ASSET
            src.write_bytes(http_get(asset["browser_download_url"], accept="application/octet-stream"))

        db = extract_db(src, work)
        slim(db)

        con = sqlite3.connect(db)
        s = con.execute("SELECT total_works, total_staff, total_cv, year_min, year_max, updated_at, version "
                        "FROM summary LIMIT 1").fetchone()
        con.close()

        raw = db.read_bytes()
        gz_path = out_dir / "creditdb.dat"
        with open(gz_path, "wb") as f:
            # mtime=0 で中身が同じなら同じファイルになるようにする
            with gzip.GzipFile(fileobj=f, mode="wb", compresslevel=9, mtime=0) as g:
                g.write(raw)
        gz = gz_path.read_bytes()

    version = {
        "schema": SCHEMA_VERSION,
        "sourceTag": tag,
        "sourcePublishedAt": published,
        "dataUpdatedAt": s[5],
        "dbVersion": s[6],
        "totalWorks": s[0],
        "totalStaff": s[1],
        "totalCv": s[2],
        "yearMin": s[3],
        "yearMax": s[4],
        "dbFile": "creditdb.dat",
        "sizeCompressed": len(gz),
        "sizeUncompressed": len(raw),
        "sha256": hashlib.sha256(gz).hexdigest(),
    }
    (out_dir / "version.json").write_text(json.dumps(version, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"出力: {gz_path} ({len(gz) / 1e6:.1f} MB, 展開後 {len(raw) / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()

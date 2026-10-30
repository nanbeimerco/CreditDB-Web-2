# CreditDB for Web 2

アニメ作品と制作スタッフの評価データベースの Web 版です。PC のブラウザで読むことを前提にした、Fluent 2 デザインの作り直し版です。

- 作品: 年代補正した偏差値・Tier・AniList の素点・スタッフから予測した偏差値・各話の IMDb 評価
- スタッフ: 役職別ランキング（総合実力・累計実績・個人寄与度・各話評価）と、人物ごとの成績・経歴
- スタジオ: 作品一覧・Tier の内訳・よく参加しているスタッフ

## しくみ

```
CreditDB-Pro-Mobile（アプリ版）の週次更新
  └ Release「data-…」に creditdb.zip を公開（毎週月曜）
        ↓ 毎日確認（.github/workflows/deploy.yml）
このリポジトリ
  └ scripts/build_web_db.py が Web 用に軽くした DB を作る（約 40 MB）
  └ Vite でビルドして GitHub Pages に公開
        ↓
ブラウザ
  └ DB をダウンロードしてブラウザに保存し、sql.js（WebAssembly の SQLite）で検索する
    データが変わったときだけダウンロードし直す
```

- DB は git に入れません。ビルドのたびにアプリ版の最新 Release から作ります。
- アプリ版の DB の形が変わって Web で使えなくなった場合は、ビルドが失敗し、サイトは前回のデータのまま残ります（`scripts/build_web_db.py` の `REQUIRED`）。
- Web 版は人物ごとの参加作品リスト（約 90 MB）を持たず、作品のクレジットからその場で組み立てます。

## 開発

Node.js 20 以上と Python 3.10 以上が必要です。

```bash
npm install
npm run data   # アプリ版の最新 Release から public/data/ に DB を作る
npm run dev
```

手元の DB を使う場合は `python scripts/build_web_db.py --input path/to/creditdb.zip` です。

## 公開の設定

リポジトリの Settings → Pages → Build and deployment の Source を「GitHub Actions」にします。

## データの出典

AniList（作品情報・スコア・話数付きクレジット）、Bangumi（制作クレジット・表紙画像）、IMDb（各話評価）。
Information courtesy of IMDb (https://www.imdb.com). Used with permission. 非商用での利用です。

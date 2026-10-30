// DB の取得・保存・検索をまとめて行うワーカー。重い処理で画面が固まらないよう別スレッドで動かす。
import initSqlJs, { type Database } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import type { VersionInfo, WorkerRequest, WorkerResponse } from './protocol';

const ctx = self as unknown as {
  postMessage(m: WorkerResponse): void;
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
};
const post = (m: WorkerResponse) => ctx.postMessage(m);

let db: Database | null = null;

// ---- ブラウザ内の保存先（IndexedDB）。使えない環境でも動くよう、失敗は無視する

const IDB_NAME = 'creditdb';
const IDB_STORE = 'files';
const IDB_KEY = 'db';

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function cacheGet(): Promise<{ sha: string; data: ArrayBuffer } | null> {
  try {
    const d = await idb();
    return await new Promise((resolve) => {
      const req = d.transaction(IDB_STORE).objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function cachePut(sha: string, data: ArrayBuffer): Promise<void> {
  try {
    const d = await idb();
    await new Promise<void>((resolve) => {
      const tx = d.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put({ sha, data }, IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* 保存できなくても今回の表示には困らない */
  }
}

// ---- 取得

async function download(url: string, total: number): Promise<Uint8Array<ArrayBuffer>> {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok || !res.body) throw new Error(`DB の取得に失敗しました (HTTP ${res.status})`);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  let lastPost = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    if (loaded - lastPost > 512 * 1024) {
      lastPost = loaded;
      post({ type: 'progress', phase: 'download', loaded, total });
    }
  }
  const buf = new Uint8Array(loaded);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.length;
  }
  return buf;
}

/** gzip なら展開する（サーバーが自動で展開して返す場合もあるので、先頭の印で判定する） */
async function unpack(buf: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  if (buf[0] !== 0x1f || buf[1] !== 0x8b) return buf;
  post({ type: 'progress', phase: 'unpack' });
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function open(baseUrl: string): Promise<VersionInfo> {
  post({ type: 'progress', phase: 'version' });
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });

  let version: VersionInfo | null = null;
  try {
    const r = await fetch(`${baseUrl}version.json`, { cache: 'no-cache' });
    if (r.ok) version = await r.json();
  } catch {
    /* オフラインなど。保存済みの DB があればそれを使う */
  }

  // 保存するのは圧縮したままのデータ（展開後の 4 分の 1 ほど）
  const cached = await cacheGet();
  let packed: Uint8Array<ArrayBuffer>;
  if (cached && (!version || cached.sha === version.sha256)) {
    post({ type: 'progress', phase: 'cache' });
    packed = new Uint8Array(cached.data);
  } else if (version) {
    packed = await download(`${baseUrl}${version.dbFile}?v=${version.sha256.slice(0, 12)}`, version.sizeCompressed);
    // 保存は待たない（終わる前に閉じても、次回もう一度ダウンロードするだけ）
    void cachePut(version.sha256, packed.slice().buffer);
  } else {
    throw new Error('データの情報 (version.json) を取得できませんでした');
  }
  const data = await unpack(packed);

  post({ type: 'progress', phase: 'open' });
  db = new SQL.Database(data);
  if (!version) {
    const s = db.exec('SELECT total_works, total_staff, total_cv, year_min, year_max, updated_at, version FROM summary LIMIT 1')[0];
    const v = s.values[0];
    version = {
      schema: 1, sourceTag: 'cache', sourcePublishedAt: null, dataUpdatedAt: String(v[5]), dbVersion: String(v[6]),
      totalWorks: Number(v[0]), totalStaff: Number(v[1]), totalCv: Number(v[2]), yearMin: Number(v[3]), yearMax: Number(v[4]),
      dbFile: '', sizeCompressed: 0, sizeUncompressed: data.byteLength, sha256: cached?.sha ?? '',
    };
  }
  return version;
}

function query(sql: string, params: (string | number | null)[]): Record<string, unknown>[] {
  if (!db) throw new Error('DB がまだ開かれていません');
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows: Record<string, unknown>[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

ctx.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const m = e.data;
  if (m.type === 'open') {
    try {
      post({ type: 'ready', version: await open(m.baseUrl) });
    } catch (err) {
      post({ type: 'fatal', message: err instanceof Error ? err.message : String(err) });
    }
  } else if (m.type === 'query') {
    try {
      post({ type: 'result', id: m.id, rows: query(m.sql, m.params) });
    } catch (err) {
      post({ type: 'error', id: m.id, message: err instanceof Error ? err.message : String(err) });
    }
  }
};

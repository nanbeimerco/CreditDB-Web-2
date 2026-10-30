import type { LoadPhase, VersionInfo, WorkerResponse } from './protocol';

type Pending = { resolve: (rows: Record<string, unknown>[]) => void; reject: (e: Error) => void };

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
const pending = new Map<number, Pending>();
let nextId = 1;
let progressHandler: ((phase: LoadPhase, loaded?: number, total?: number) => void) | null = null;
let openPromise: Promise<VersionInfo> | null = null;
let openResolve: ((v: VersionInfo) => void) | null = null;
let openReject: ((e: Error) => void) | null = null;

worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
  const m = e.data;
  switch (m.type) {
    case 'progress':
      progressHandler?.(m.phase, m.loaded, m.total);
      break;
    case 'ready':
      openResolve?.(m.version);
      break;
    case 'fatal':
      openReject?.(new Error(m.message));
      break;
    case 'result':
      pending.get(m.id)?.resolve(m.rows);
      pending.delete(m.id);
      break;
    case 'error':
      pending.get(m.id)?.reject(new Error(m.message));
      pending.delete(m.id);
      break;
  }
};

worker.onerror = (e) => {
  const err = new Error(`データベースの処理を開始できませんでした: ${e.message || '不明なエラー'}`);
  openReject?.(err);
  pending.forEach((p) => p.reject(err));
  pending.clear();
};

/** DB を開く（初回はダウンロード、2回目以降はブラウザに保存した分を使う） */
export function openDb(onProgress: (phase: LoadPhase, loaded?: number, total?: number) => void): Promise<VersionInfo> {
  progressHandler = onProgress;
  if (!openPromise) {
    openPromise = new Promise<VersionInfo>((resolve, reject) => {
      openResolve = resolve;
      openReject = reject;
    });
    // ワーカーから見た相対パスはずれるので、ページ基準の絶対 URL を渡す
    const baseUrl = new URL(`${import.meta.env.BASE_URL}data/`, document.baseURI).href;
    worker.postMessage({ type: 'open', baseUrl });
  }
  return openPromise;
}

export function query<T>(sql: string, params: (string | number | null)[] = []): Promise<T[]> {
  const id = nextId++;
  return new Promise<T[]>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (rows: Record<string, unknown>[]) => void, reject });
    worker.postMessage({ type: 'query', id, sql, params });
  });
}

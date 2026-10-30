// 画面とワーカーの間でやりとりするメッセージ

export interface VersionInfo {
  schema: number;
  sourceTag: string;
  sourcePublishedAt: string | null;
  dataUpdatedAt: string;
  dbVersion: string;
  totalWorks: number;
  totalStaff: number;
  totalCv: number;
  yearMin: number;
  yearMax: number;
  dbFile: string;
  sizeCompressed: number;
  sizeUncompressed: number;
  sha256: string;
}

export type LoadPhase = 'version' | 'cache' | 'download' | 'unpack' | 'save' | 'open';

export type WorkerRequest =
  | { type: 'open'; baseUrl: string }
  | { type: 'query'; id: number; sql: string; params: (string | number | null)[] };

export type WorkerResponse =
  | { type: 'progress'; phase: LoadPhase; loaded?: number; total?: number }
  | { type: 'ready'; version: VersionInfo }
  | { type: 'fatal'; message: string }
  | { type: 'result'; id: number; rows: Record<string, unknown>[] }
  | { type: 'error'; id: number; message: string };

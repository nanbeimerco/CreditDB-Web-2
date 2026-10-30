import { createContext, useContext } from 'react';
import type { VersionInfo } from '../db/protocol';

export const VersionContext = createContext<VersionInfo | null>(null);

export function useVersion(): VersionInfo {
  const v = useContext(VersionContext);
  if (!v) throw new Error('VersionContext がありません');
  return v;
}

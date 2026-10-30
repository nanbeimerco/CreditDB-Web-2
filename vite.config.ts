import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 相対パスで出力するので、GitHub Pages のリポジトリ名に依存しない
export default defineConfig({
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  // sql.js は CommonJS なので、ワーカーから読めるよう事前に変換しておく
  optimizeDeps: { include: ['sql.js'] },
  build: { chunkSizeWarningLimit: 1500 },
});

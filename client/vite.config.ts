import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

export default defineConfig({
  plugins: [react()],
  // CI sets VITE_APP_VERSION (the release version); locally it falls back to package.json
  define: { __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION || pkg.version) },
  server: { port: 5176, strictPort: true, host: true, fs: { allow: ['..'] } },
  build: { chunkSizeWarningLimit: 1500 },
});

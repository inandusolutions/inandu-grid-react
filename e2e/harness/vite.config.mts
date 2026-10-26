import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Serves the e2e harness, which imports the library straight from ../../src so the tests exercise
// the code in this checkout (not the published package the marketing `site/` installs).
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  server: { port: 4203, strictPort: true },
});

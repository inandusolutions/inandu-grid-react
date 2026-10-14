import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Runs against this repo's source so the example always matches the code next to it. In your own
// app, `npm i @inandu-solutions/grid-react` and import from the package instead.
const src = fileURLToPath(new URL('../../src', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@inandu-solutions/grid-react/style.css': `${src}/styles/inandu-grid.css`, '@inandu-solutions/grid-react': `${src}/index.ts` } },
});

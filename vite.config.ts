/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [react(), dts({ include: ['src'], exclude: ['src/**/*.test.*', 'src/test-setup.ts'] })],
  build: {
    lib: {
      entry: fileURLToPath(new URL('src/index.ts', import.meta.url)),
      formats: ['es', 'cjs'],
      fileName: 'inandu-grid-react',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', '@inandu-solutions/grid-core', 'jspdf'],
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    // Measured 2026-11-19: statements 85.0, branches 82.4, functions 85.3, lines 87.3.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.*', 'src/test-setup.ts'],
      reporter: ['text-summary', 'text'],
      // A few points under what is measured today: a drop fails CI, normal change does not. Raise them when coverage rises.
      thresholds: { statements: 82, branches: 79, functions: 82, lines: 84 },
    },
  },
});

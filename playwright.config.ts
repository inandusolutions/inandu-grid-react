import { defineConfig, devices } from '@playwright/test';

/**
 * Real-browser tests for the library itself. The harness in e2e/harness renders the grid from
 * ../../src (this checkout, not the npm package) - one scenario per hash route. Specs are named
 * *.e2e.ts so Vitest's default *.spec.* / *.test.* globs never pick them up.
 * Port 4203 is non-default so it never collides with a dev server.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:4203', trace: 'on-first-retry' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], permissions: ['clipboard-read', 'clipboard-write'] } },
    // The other engines and a touch device: CI runs them in the e2e-cross-browser job (npm run e2e:all locally).
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'], permissions: ['clipboard-read', 'clipboard-write'] } },
  ],
  webServer: {
    command: 'npx vite --config e2e/harness/vite.config.mts',
    url: 'http://localhost:4203',
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
  },
});

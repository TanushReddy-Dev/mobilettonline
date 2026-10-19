import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    // Set PW_CHANNEL=chrome to use an installed Chrome instead of the
    // Playwright-managed Chromium build.
    channel: process.env.PW_CHANNEL || undefined
  },
  webServer: {
    command: 'node server.js',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
    env: { PORT: '4173' }
  }
});

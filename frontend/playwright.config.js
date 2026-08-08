import { defineConfig } from '@playwright/test';
import process from 'node:process';

const browserMatrix = process.env.BROWSER_MATRIX === '1'
  ? [
      { name: 'chromium', use: { browserName: 'chromium' } },
      { name: 'firefox', use: { browserName: 'firefox' } },
      { name: 'webkit', use: { browserName: 'webkit' } },
    ]
  : [{ name: 'chromium', use: { browserName: 'chromium' } }];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: process.env.BROWSER_MATRIX === '1' ? 1 : undefined,
  timeout: process.env.BROWSER_MATRIX === '1' ? 60_000 : 30_000,
  projects: browserMatrix,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
});

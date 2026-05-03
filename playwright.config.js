import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: './e2e/tests',
  globalSetup:    './e2e/global-setup.js',
  globalTeardown: './e2e/global-teardown.js',

  // Each test file gets a fresh browser context (tabs, cookies, localStorage)
  fullyParallel: false,
  workers: 1,          // run serially — shared local server state
  retries: 1,          // one retry on flaky network timing

  timeout: 30_000,     // 30 s per test
  expect: { timeout: 8_000 },

  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e/report', open: 'never' }],
  ],

  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    viewport: { width: 1280, height: 800 },
    // Capture screenshot + trace on first retry
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // ── Start both servers automatically ────────────────────────────────────────
  webServer: [
    {
      // Backend — started with the isolated test-notes dir
      command: 'NB_NOTES_DIR=e2e/test-notes NB_TEMPLATES_DIR=e2e/test-templates node server.js',
      cwd: path.resolve(__dirname),
      url: 'http://localhost:3001/api/tree',
      reuseExistingServer: false,
      timeout: 15_000,
      env: {
        NB_NOTES_DIR:     path.join(__dirname, 'e2e/test-notes'),
        NB_TEMPLATES_DIR: path.join(__dirname, 'e2e/test-templates'),
      },
    },
    {
      // Frontend Vite dev server
      command: 'npm run dev',
      cwd: path.join(__dirname, 'client'),
      url: 'http://localhost:5173',
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});

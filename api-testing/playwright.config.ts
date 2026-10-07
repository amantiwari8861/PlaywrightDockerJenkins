import { defineConfig } from '@playwright/test';

const PORT = process.env.API_PORT ?? '5001';
const HOST = process.env.API_HOST ?? '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;
const skipWebServer = process.env.SKIP_WEBSERVER === 'true';

/**
 * API test config. Uses the Node runner only (no browsers needed) and boots
 * the Express backend automatically via `webServer`.
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  // Data-dependent specs share one Mongo collection, so run files serially to
  // keep counts and ownership assertions deterministic.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never',outputFolder:"playwright-reporter" }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    // No Origin header by default: a non-browser API client does not send one,
    // and the backend's allowlist does not include this dev port. The CORS
    // spec sets its own Origin values explicitly where it needs them.
  },

  projects: [
    {
      name: 'api',
      use: {},
    },
  ],

  webServer: skipWebServer
    ? undefined
    : {
        command: 'npm run start',
        cwd: '../api-backend',
        url: `${BASE_URL}/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
});

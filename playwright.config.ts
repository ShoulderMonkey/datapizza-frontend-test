import { defineConfig } from '@playwright/test';

// PLAYWRIGHT_BASE_URL points the suite at an already running server (e.g. a production build): no webServer then.
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  use: { baseURL: externalBaseURL ?? 'http://localhost:3000' },
  ...(externalBaseURL
    ? {}
    : {
        webServer: {
          command: 'npm run dev',
          url: 'http://localhost:3000',
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }),
});

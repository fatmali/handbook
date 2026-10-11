import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 2,
  use: { baseURL: 'http://127.0.0.1:4173/handbook/', trace: 'retain-on-failure' },
  webServer: { command: 'npm run build && npx vite preview --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173/handbook/', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
});

/** Start Vite and exercise identical identity journeys on desktop and mobile. */
import { defineConfig, devices } from '@playwright/test';

const host = process.env.PLAYWRIGHT_HOST || '127.0.0.1';
const port = process.env.PLAYWRIGHT_PORT || '5173';
const baseURL = `http://${host}:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `node node_modules/vite/bin/vite.js --host ${host} --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});

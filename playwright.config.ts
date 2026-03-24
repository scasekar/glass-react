import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5174',
    headless: true,
    // WebGPU requires a real GPU context in headless Chrome
    launchOptions: {
      args: ['--enable-unsafe-webgpu', '--use-angle=default'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Start demo dev server before tests (will reuse if already running)
  webServer: {
    command: 'npm run dev:demo',
    port: 5174,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});

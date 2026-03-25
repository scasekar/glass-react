import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
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
  // Start main dev server (serves src/App.tsx with ShowcasePage)
  webServer: {
    command: 'npm run dev:vite',
    port: 5173,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});

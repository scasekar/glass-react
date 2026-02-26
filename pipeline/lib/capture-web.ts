import { chromium } from 'playwright';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { CONFIG } from './config.js';
import { startDevServer, stopDevServer } from './dev-server.js';

export async function captureWeb(mode: 'light' | 'dark'): Promise<string> {
  const outputPath = resolve(
    import.meta.dirname, '..', CONFIG.outputDir, 'web', `${mode}.png`
  );
  await mkdir(dirname(outputPath), { recursive: true });

  // Ensure dev server is running
  const baseUrl = await startDevServer(CONFIG.devServerPort);

  // Build the full URL with preset params + capture mode
  const url = `${baseUrl}/?${CONFIG.presetUrls[mode]}`;
  console.log(`  Navigating to: ${url}`);

  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-gpu', '--enable-unsafe-webgpu', '--use-angle=metal'],
  });

  try {
    const context = await browser.newContext({
      viewport: CONFIG.viewport,
      deviceScaleFactor: 1,
      colorScheme: mode === 'light' ? 'light' : 'dark',
    });

    const page = await context.newPage();
    await page.goto(url);

    // Wait for WebGPU canvas to be visible and rendered
    await page.locator('#gpu-canvas').waitFor({ state: 'visible' });
    await page.waitForFunction(() => {
      const canvas = document.getElementById('gpu-canvas') as HTMLCanvasElement;
      return canvas && canvas.width > 0 && canvas.height > 0;
    });

    // Extra settle time for GPU rendering to complete
    await page.waitForTimeout(3000);

    // Screenshot the canvas element specifically
    const canvas = page.locator('#gpu-canvas');
    const screenshot = await canvas.screenshot({ type: 'png' });

    // Write to output
    await writeFile(outputPath, screenshot);
    console.log(`  Saved web screenshot: ${outputPath}`);

    await context.close();
  } finally {
    await browser.close();
  }

  return outputPath;
}

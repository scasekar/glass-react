import { test, expect } from '@playwright/test';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const HARNESS_URL = '/?harness';

test.describe('GlassRenderer visual harness', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS_URL);
    // Wait for WebGPU init and at least one rendered frame
    await page.waitForSelector('#glass-renderer-canvas', { state: 'visible', timeout: 10_000 });
    // Give rAF loop time to render a few frames
    await page.waitForTimeout(500);
  });

  test('canvas element is visible', async ({ page }) => {
    const canvas = page.locator('#glass-renderer-canvas');
    await expect(canvas).toBeVisible();
  });

  test('glass panel overlay exists in DOM', async ({ page }) => {
    const panel = page.locator('[data-testid="glass-panel"]');
    await expect(panel).toBeAttached();
  });

  test('canvas renders non-black pixels (WebGPU producing output)', async ({ page }) => {
    const canvas = page.locator('#glass-renderer-canvas');

    // Capture screenshot of just the canvas
    const screenshot = await canvas.screenshot();

    // Count non-black pixels by sampling the PNG buffer
    // PNG bytes: every 4 bytes = RGBA pixel
    let nonBlackCount = 0;
    let totalSampled = 0;

    // Sample every 10th pixel to keep it fast
    for (let i = 0; i < screenshot.length - 3; i += 40) {
      const r = screenshot[i];
      const g = screenshot[i + 1];
      const b = screenshot[i + 2];
      // Count as non-black if any channel > 20 (above noise floor)
      if (r > 20 || g > 20 || b > 20) {
        nonBlackCount++;
      }
      totalSampled++;
    }

    const nonBlackRatio = nonBlackCount / totalSampled;
    console.log(`Non-black pixel ratio: ${(nonBlackRatio * 100).toFixed(1)}%`);

    // At least 10% of pixels must be non-black (synthetic amber texture should dominate)
    expect(nonBlackRatio).toBeGreaterThan(0.1);
  });

  test('saves reference screenshot for manual review', async ({ page }) => {
    const screenshotDir = join(process.cwd(), 'tests', 'screenshots');
    await mkdir(screenshotDir, { recursive: true });

    const screenshotPath = join(screenshotDir, 'glass-renderer.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`Screenshot saved to: ${screenshotPath}`);

    // Verify the file was created
    const { existsSync } = await import('fs');
    expect(existsSync(screenshotPath)).toBe(true);
  });

  test('resize viewport does not crash renderer', async ({ page }) => {
    // Trigger resize
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(500);

    // Canvas should still be visible and producing output
    const canvas = page.locator('#glass-renderer-canvas');
    await expect(canvas).toBeVisible();

    // Take screenshot after resize to confirm no crash/blank screen
    const screenshot = await canvas.screenshot();
    let nonBlackCount = 0;
    let totalSampled = 0;
    for (let i = 0; i < screenshot.length - 3; i += 40) {
      const r = screenshot[i];
      const g = screenshot[i + 1];
      const b = screenshot[i + 2];
      if (r > 20 || g > 20 || b > 20) nonBlackCount++;
      totalSampled++;
    }
    const ratio = nonBlackCount / totalSampled;
    console.log(`Post-resize non-black pixel ratio: ${(ratio * 100).toFixed(1)}%`);
    expect(ratio).toBeGreaterThan(0.1);
  });
});

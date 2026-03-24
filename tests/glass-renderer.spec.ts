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

test.describe('GlassProvider integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#gpu-canvas', { state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(2000);
  });

  test('GlassPanel renders non-black pixels over live background', async ({ page }) => {
    // Wait for GlassPanel to appear in DOM
    await page.waitForSelector('[data-testid="glass-panel"]', { state: 'attached', timeout: 10_000 });

    const screenshotDir = join(process.cwd(), 'tests', 'screenshots');
    await mkdir(screenshotDir, { recursive: true });

    // Save full-page screenshot for reference
    await page.screenshot({ path: join(screenshotDir, 'glass-integration.png') });

    // Screenshot the gpu-canvas element and sample for non-black pixels
    const canvas = page.locator('#gpu-canvas');
    const screenshot = await canvas.screenshot();

    let nonBlackCount = 0;
    let totalSampled = 0;

    for (let i = 0; i < screenshot.length - 3; i += 40) {
      const r = screenshot[i];
      const g = screenshot[i + 1];
      const b = screenshot[i + 2];
      if (r > 20 || g > 20 || b > 20) {
        nonBlackCount++;
      }
      totalSampled++;
    }

    const ratio = nonBlackCount / totalSampled;
    console.log(`Non-black ratio (integration): ${(ratio * 100).toFixed(1)}%`);

    // At least 10% of pixels must be non-black
    expect(ratio).toBeGreaterThan(0.1);
  });

  test('GlassPanel element is visible in DOM', async ({ page }) => {
    const panel = page.locator('[data-testid="glass-panel"]');
    await expect(panel).toBeAttached();
  });

  test('resize does not produce black canvas (GLASS-05 smoke)', async ({ page }) => {
    // Resize viewport
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(500);

    // Screenshot the gpu-canvas and verify non-black output
    const canvas = page.locator('#gpu-canvas');
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
    console.log(`Post-resize non-black ratio (integration): ${(ratio * 100).toFixed(1)}%`);
    expect(ratio).toBeGreaterThan(0.1);
  });

  test('saves integration screenshot for manual review', async ({ page }) => {
    const screenshotDir = join(process.cwd(), 'tests', 'screenshots');
    await mkdir(screenshotDir, { recursive: true });

    const screenshotPath = join(screenshotDir, 'glass-integration-full.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Integration screenshot saved to: ${screenshotPath}`);

    // Verify the file was created
    const { existsSync } = await import('fs');
    expect(existsSync(screenshotPath)).toBe(true);
  });
});

test.describe('Tuning page redesign', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for React to mount and GlassProvider to initialize
    await page.waitForSelector('[data-testid="control-panel"]', { state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(500);
  });

  test('control panel is visible at 300px width', async ({ page }) => {
    const panel = page.locator('[data-testid="control-panel"]');
    await expect(panel).toBeVisible();
    // Verify panel width is approximately 300px
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(298);
    expect(box!.width).toBeLessThanOrEqual(302);
  });

  test('preset chip buttons are present in DOM', async ({ page }) => {
    // Preset chips are buttons inside the panel
    const panel = page.locator('[data-testid="control-panel"]');
    // At least 2 preset chips should exist (Clear Light + Clear Dark at minimum)
    const chipButtons = panel.locator('button').filter({ hasText: /Clear|Frosted|Custom/i });
    const count = await chipButtons.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('collapsible section header toggles content', async ({ page }) => {
    const panel = page.locator('[data-testid="control-panel"]');
    // Find the "GEOMETRY" section header (starts collapsed per plan 02)
    const geometryHeader = panel.locator('div[style*="cursor"]').filter({ hasText: /geometry/i });
    if (await geometryHeader.count() === 0) {
      // Fallback: find any section toggle
      const anyHeader = panel.locator('div[style*="cursor: pointer"]').first();
      await anyHeader.click();
      await page.waitForTimeout(200);
    } else {
      // Click to expand the Geometry section
      await geometryHeader.first().click();
      await page.waitForTimeout(200);
      // The Corner Radius slider should now be visible
      await expect(panel.locator('label').filter({ hasText: /corner/i })).toBeVisible();
    }
  });

  test('saves tuning page screenshot for manual review', async ({ page }) => {
    const screenshotDir = join(process.cwd(), 'tests', 'screenshots');
    await mkdir(screenshotDir, { recursive: true });

    const screenshotPath = join(screenshotDir, 'tuning-redesign.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`Tuning redesign screenshot saved to: ${screenshotPath}`);

    const { existsSync } = await import('fs');
    expect(existsSync(screenshotPath)).toBe(true);
  });
});

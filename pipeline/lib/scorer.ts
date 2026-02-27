import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import fs from 'fs';
import { writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { PNG } from 'pngjs';
import { CONFIG } from './config.js';
import { normalize } from './normalize.js';
import { compare } from './compare.js';
import type { ROIMask } from './config.js';
import type { GlassParams } from '../../demo/controls/presets.js';

/** Persistent browser capture context for repeated screenshot captures. */
export interface CaptureContext {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

/**
 * Launch a persistent Chrome browser context for fast repeated captures.
 * Reuses a single browser instance across all evaluations.
 */
export async function createCaptureContext(
  mode: 'light' | 'dark',
  viewport: { width: number; height: number },
): Promise<CaptureContext> {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-gpu', '--enable-unsafe-webgpu', '--use-angle=metal'],
  });

  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    colorScheme: mode === 'light' ? 'light' : 'dark',
  });

  const page = await context.newPage();

  return { browser, context, page };
}

/** Close the persistent browser gracefully. */
export async function closeCaptureContext(ctx: CaptureContext): Promise<void> {
  await ctx.context.close();
  await ctx.browser.close();
}

/**
 * Serialize GlassParams into a URL query string.
 * Includes capture=true flag for capture mode.
 */
function paramsToQueryString(params: GlassParams): string {
  const qs = new URLSearchParams();
  qs.set('capture', 'true');

  for (const [key, value] of Object.entries(params)) {
    if (key === 'tint') {
      qs.set(key, JSON.stringify(value));
    } else {
      qs.set(key, String(value));
    }
  }

  return qs.toString();
}

/**
 * Capture a screenshot of the WebGPU canvas with the given params.
 * Uses persistent browser context for speed (no launch overhead).
 */
async function captureWithParams(
  ctx: CaptureContext,
  baseUrl: string,
  params: GlassParams,
): Promise<Buffer> {
  const url = `${baseUrl}/?${paramsToQueryString(params)}`;
  await ctx.page.goto(url);

  // Wait for WebGPU canvas to be visible and rendered
  await ctx.page.locator('#gpu-canvas').waitFor({ state: 'visible' });
  await ctx.page.waitForFunction(() => {
    const canvas = document.getElementById('gpu-canvas') as HTMLCanvasElement;
    return canvas && canvas.width > 0 && canvas.height > 0;
  });

  // Settle time for GPU rendering (2s warm browser vs 3s cold start)
  await ctx.page.waitForTimeout(2000);

  // Screenshot the canvas element
  const canvas = ctx.page.locator('#gpu-canvas');
  const screenshot = await canvas.screenshot({ type: 'png' });

  return Buffer.from(screenshot);
}

/**
 * Compute a tuning-friendly score between two PNG images.
 *
 * Uses "mean error of mismatching pixels" — a hybrid metric that:
 * 1. Ignores pixels below a noise floor (noiseThreshold) to focus on actual differences
 * 2. Sums the actual color magnitude of differences (continuous, not binary)
 * 3. Returns: (count_above_noise / total) * mean_error_magnitude * 100
 *
 * This combines the spatial selectivity of pixelmatch with continuous sensitivity.
 * The multiplication of count fraction × error magnitude means the optimizer
 * is rewarded for both reducing the number of mismatching pixels AND reducing
 * the magnitude of remaining differences.
 */
function computeTuningScore(webPath: string, iosPath: string, mask?: ROIMask): number {
  const webPng = PNG.sync.read(fs.readFileSync(webPath));
  const iosPng = PNG.sync.read(fs.readFileSync(iosPath));

  const { width, height } = webPng;
  const noiseThreshold = 8 / 255; // ~3% — ignore differences below display noise

  let sumAbsErr = 0;
  let mismatchCount = 0;
  let totalCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask) {
        const inROI = x >= mask.x && x < mask.x + mask.width
                   && y >= mask.y && y < mask.y + mask.height;
        if (!inROI) continue;
      }

      totalCount++;
      const idx = (y * width + x) * 4;
      const dr = Math.abs(webPng.data[idx]     - iosPng.data[idx])     / 255;
      const dg = Math.abs(webPng.data[idx + 1] - iosPng.data[idx + 1]) / 255;
      const db = Math.abs(webPng.data[idx + 2] - iosPng.data[idx + 2]) / 255;
      const maxChannelDiff = Math.max(dr, dg, db);

      if (maxChannelDiff > noiseThreshold) {
        const avgErr = (dr + dg + db) / 3;
        sumAbsErr += avgErr;
        mismatchCount++;
      }
    }
  }

  if (mismatchCount === 0) return 0;

  // score = fraction_mismatching × mean_error_of_mismatching × 100
  const fractionMismatch = mismatchCount / totalCount;
  const meanError = sumAbsErr / mismatchCount;
  return fractionMismatch * meanError * 100;
}

/**
 * Create a scoring function that captures, normalizes, and compares
 * a WebGPU screenshot against an iOS reference image.
 *
 * Uses MSE (mean squared error) for continuous, gradient-friendly scoring
 * that responds to even tiny parameter changes. Returns percentage [0-100].
 */
export function createScorer(
  ctx: CaptureContext,
  baseUrl: string,
  iosReferencePath: string,
  _mode: 'light' | 'dark',
): (params: GlassParams) => Promise<number> {
  // Temp file paths for intermediate results
  const tempRaw = path.join(os.tmpdir(), 'tune_web_raw.png');
  const tempNorm = path.join(os.tmpdir(), 'tune_web_norm.png');

  return async (params: GlassParams): Promise<number> => {
    // Capture screenshot with current params
    const screenshot = await captureWithParams(ctx, baseUrl, params);
    await writeFile(tempRaw, screenshot);

    // Normalize to standard size/colorspace
    await normalize(tempRaw, tempNorm);

    // Hybrid score: fraction of mismatching pixels × their mean error magnitude
    return computeTuningScore(tempNorm, iosReferencePath, CONFIG.roiMask);
  };
}

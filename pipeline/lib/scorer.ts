import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { CONFIG } from './config.js';
import { normalize } from './normalize.js';
import { compare } from './compare.js';
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
    args: ['--enable-gpu', '--use-gl=egl'],
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
 * Create a scoring function that captures, normalizes, and compares
 * a WebGPU screenshot against an iOS reference image.
 *
 * Returns a factory-produced function: (GlassParams) => Promise<number>
 * where the number is the diff percentage (lower = better match).
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
  const tempDiff = path.join(os.tmpdir(), 'tune_diff.png');

  return async (params: GlassParams): Promise<number> => {
    // Capture screenshot with current params
    const screenshot = await captureWithParams(ctx, baseUrl, params);
    await writeFile(tempRaw, screenshot);

    // Normalize to standard size/colorspace
    await normalize(tempRaw, tempNorm);

    // Compare against iOS reference
    const result = await compare(tempNorm, iosReferencePath, tempDiff, CONFIG.roiMask);

    return result.percentage;
  };
}

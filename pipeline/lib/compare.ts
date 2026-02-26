import fs from 'fs';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import type { ROIMask } from './config.js';
import { CONFIG } from './config.js';

export interface CompareResult {
  /** Number of mismatched pixels */
  count: number;
  /** Total pixels in comparison region */
  total: number;
  /** Mismatch percentage (0-100) */
  percentage: number;
}

/**
 * Apply ROI mask: zero out pixels outside the region of interest.
 * Sets non-ROI pixels to solid black so they match between images
 * and don't contribute to mismatch count.
 */
function applyMask(png: PNG, mask: ROIMask): void {
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const inROI = x >= mask.x && x < mask.x + mask.width
                 && y >= mask.y && y < mask.y + mask.height;
      if (!inROI) {
        const idx = (y * png.width + x) * 4;
        png.data[idx] = 0;      // R
        png.data[idx + 1] = 0;  // G
        png.data[idx + 2] = 0;  // B
        png.data[idx + 3] = 255; // A (opaque)
      }
    }
  }
}

export async function compare(
  webPath: string,
  iosPath: string,
  diffPath: string,
  mask?: ROIMask
): Promise<CompareResult> {
  await mkdir(dirname(diffPath), { recursive: true });

  const webPng = PNG.sync.read(fs.readFileSync(webPath));
  const iosPng = PNG.sync.read(fs.readFileSync(iosPath));

  const { width, height } = webPng;

  // Validate dimensions match
  if (webPng.width !== iosPng.width || webPng.height !== iosPng.height) {
    throw new Error(
      `Image dimensions mismatch: web=${webPng.width}x${webPng.height}, ios=${iosPng.width}x${iosPng.height}`
    );
  }

  // Apply ROI mask if provided (DIFF-04)
  if (mask) {
    applyMask(webPng, mask);
    applyMask(iosPng, mask);
  }

  const diff = new PNG({ width, height });
  const count = pixelmatch(
    webPng.data, iosPng.data, diff.data,
    width, height,
    {
      threshold: CONFIG.diffThreshold,
      alpha: 0.3,
      diffColor: [255, 0, 0],      // Red for mismatched pixels
      diffColorAlt: [0, 255, 0],   // Green for anti-aliased differences
    }
  );

  // Write diff image
  fs.writeFileSync(diffPath, PNG.sync.write(diff));

  // Total is the ROI area if masked, or full image otherwise
  const total = mask ? mask.width * mask.height : width * height;
  return {
    count,
    total,
    percentage: (count / total) * 100,
  };
}

import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import { CONFIG } from './config.js';

export async function normalize(inputPath: string, outputPath: string): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });

  await sharp(inputPath)
    .resize(CONFIG.size, CONFIG.size, { fit: 'fill' })  // Force exact 800x800
    .toColorspace('srgb')                                 // Explicit sRGB conversion
    .removeAlpha()                                        // Strip alpha for consistent comparison
    .png({ compressionLevel: 0 })                         // Lossless, fast write
    .toFile(outputPath);
}

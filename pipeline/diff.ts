import { resolve } from 'path';
import { captureWeb } from './lib/capture-web.js';
import { captureIOS } from './lib/capture-ios.js';
import { normalize } from './lib/normalize.js';
import { compare } from './lib/compare.js';
import { generateReport } from './lib/report.js';
import { CONFIG } from './lib/config.js';
import { stopDevServer } from './lib/dev-server.js';

const OUTPUT_BASE = resolve(import.meta.dirname, CONFIG.outputDir);

async function main() {
  console.log('=== Screenshot Diff Pipeline ===\n');
  console.log(`  Size: ${CONFIG.size}x${CONFIG.size}`);
  console.log(`  Threshold: ${CONFIG.diffThreshold}`);
  console.log(`  ROI Mask: (${CONFIG.roiMask.x}, ${CONFIG.roiMask.y}) ${CONFIG.roiMask.width}x${CONFIG.roiMask.height}`);
  console.log('');

  const results: Array<{ mode: string; percentage: number; reportPath: string }> = [];

  try {
    for (const mode of ['light', 'dark'] as const) {
      const presetName = CONFIG.presets[mode];
      console.log(`--- ${presetName} (${mode} mode) ---`);

      // 1. Capture web screenshot
      console.log('  [1/5] Capturing web screenshot...');
      const webRaw = await captureWeb(mode);

      // 2. Capture iOS screenshot
      console.log('  [2/5] Capturing iOS screenshot...');
      const iosRaw = await captureIOS(mode);

      // 3. Normalize both to sRGB 800x800
      console.log('  [3/5] Normalizing to sRGB...');
      const webNorm = resolve(OUTPUT_BASE, 'web', `${mode}_norm.png`);
      const iosNorm = resolve(OUTPUT_BASE, 'ios', `${mode}_norm.png`);
      await normalize(webRaw, webNorm);
      await normalize(iosRaw, iosNorm);

      // 4. Compare with ROI mask
      console.log('  [4/5] Running pixelmatch comparison...');
      const diffPath = resolve(OUTPUT_BASE, 'diffs', `${mode}_diff.png`);
      const result = await compare(webNorm, iosNorm, diffPath, CONFIG.roiMask);

      console.log(`  Mismatch: ${result.percentage.toFixed(2)}% (${result.count} pixels)`);

      // 5. Generate HTML report
      console.log('  [5/5] Generating report...');
      const reportPath = await generateReport(mode, webNorm, iosNorm, diffPath, result);

      results.push({ mode, percentage: result.percentage, reportPath });
      console.log('');
    }
  } finally {
    // Always stop dev server when done
    stopDevServer();
  }

  // Summary
  console.log('=== Pipeline Complete ===\n');
  console.log('  Results:');
  for (const r of results) {
    console.log(`    ${r.mode}: ${r.percentage.toFixed(2)}% mismatch`);
  }
  console.log('\n  Reports:');
  for (const r of results) {
    console.log(`    ${r.reportPath}`);
  }
  console.log('');

  // Always exit 0 (report-only, no pass/fail threshold per locked decision)
  process.exit(0);
}

main().catch(err => {
  console.error('Pipeline error:', err);
  stopDevServer();
  process.exit(0); // Still exit 0 per requirement
});

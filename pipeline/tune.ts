import { resolve } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { CONFIG } from './lib/config.js';
import { startDevServer, stopDevServer } from './lib/dev-server.js';
import { captureIOS } from './lib/capture-ios.js';
import { normalize } from './lib/normalize.js';
import { createCaptureContext, closeCaptureContext, createScorer } from './lib/scorer.js';
import { coordinateDescent, TUNABLE_PARAMS } from './lib/tuner.js';
import type { TuningConfig } from './lib/tuner.js';
import { PRESETS } from '../demo/controls/presets.js';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(): { mode: 'light' | 'dark'; maxCycles: number; threshold: number } {
  const args = process.argv.slice(2);
  let mode: 'light' | 'dark' = 'light';
  let maxCycles = 15;
  let threshold = 0.05;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mode' && args[i + 1]) {
      const val = args[i + 1];
      if (val === 'light' || val === 'dark') {
        mode = val;
      }
      i++;
    } else if (args[i] === '--max-cycles' && args[i + 1]) {
      maxCycles = Number(args[i + 1]);
      i++;
    } else if (args[i] === '--threshold' && args[i + 1]) {
      threshold = Number(args[i + 1]);
      i++;
    }
  }

  return { mode, maxCycles, threshold };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { mode, maxCycles, threshold } = parseArgs();
  const presetName = CONFIG.presets[mode];
  const outputDir = resolve(import.meta.dirname, 'output', 'tuning');

  console.log('');
  console.log('=== Automated Tuning Loop ===');
  console.log(`  Mode: ${mode}`);
  console.log(`  Starting preset: ${presetName}`);
  console.log(`  Max cycles: ${maxCycles}`);
  console.log(`  Convergence threshold: ${threshold}%`);
  console.log('');

  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true });

  // 1. Capture iOS reference (one-time)
  console.log('  Capturing iOS reference...');
  const iosRaw = await captureIOS(mode);
  const iosNormPath = resolve(outputDir, `ios-ref-${mode}.png`);
  await normalize(iosRaw, iosNormPath);
  console.log('  iOS reference captured and normalized');

  // 2. Start dev server
  const baseUrl = await startDevServer(CONFIG.devServerPort);

  // 3. Create persistent browser context
  const ctx = await createCaptureContext(mode, CONFIG.viewport);

  try {
    // 4. Create scorer
    const score = createScorer(ctx, baseUrl, iosNormPath, mode);

    // 5. Get starting params from preset
    const startParams = { ...PRESETS[presetName] };

    // 6. Build tuning config
    const config: TuningConfig = {
      params: TUNABLE_PARAMS,
      maxCycles,
      convergenceThreshold: threshold,
    };

    // 7. Run coordinate descent with real-time console logging
    console.log('');
    console.log('  Starting coordinate descent...');
    console.log('');

    const result = await coordinateDescent(
      startParams, config, mode, presetName, score,
      (entry) => {
        const arrow = entry.direction === 'none' ? '='
          : entry.direction === 'plus' ? '+' : '-';
        const delta = entry.delta < 0
          ? `improved ${(-entry.delta).toFixed(3)}%`
          : 'no change';
        console.log(
          `  [${entry.cycle}/${entry.paramIndex}] ${entry.param} ${arrow} `
          + `${entry.newValue.toFixed(4)} | ${delta} | best: ${entry.bestScore.toFixed(2)}%`,
        );
      },
    );

    // 8. Write outputs
    const bestParamsPath = resolve(outputDir, `best-params-${mode}.json`);
    const tuneLogPath = resolve(outputDir, `tune-log-${mode}.json`);

    await writeFile(bestParamsPath, JSON.stringify(result.bestParams, null, 2));
    await writeFile(tuneLogPath, JSON.stringify(result, null, 2));

    // 9. Print summary
    const relativeImprovement = result.initialScore > 0
      ? ((result.improvement / result.initialScore) * 100).toFixed(1)
      : '0.0';

    console.log('');
    console.log(`=== Tuning Complete: ${mode} mode ===`);
    console.log(`  Preset: ${presetName}`);
    console.log(`  Initial score: ${result.initialScore.toFixed(2)}%`);
    console.log(`  Final score:   ${result.finalScore.toFixed(2)}%`);
    console.log(`  Improvement:   ${result.improvement.toFixed(2)}% (${relativeImprovement}% relative)`);
    console.log(`  Cycles:        ${result.cycles}`);
    console.log(`  Evaluations:   ${result.totalEvaluations}`);
    console.log(`  Elapsed:       ${result.elapsed}`);
    console.log(`  Best params:   pipeline/output/tuning/best-params-${mode}.json`);
    console.log(`  Full log:      pipeline/output/tuning/tune-log-${mode}.json`);
    console.log('');
  } finally {
    // 10. Cleanup (always runs)
    await closeCaptureContext(ctx);
    stopDevServer();
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Tuning loop failed:', err);
  stopDevServer();
  process.exit(1);
});

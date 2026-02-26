import fs from 'fs';
import { mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import type { CompareResult } from './compare.js';
import { CONFIG } from './config.js';

export async function generateReport(
  mode: 'light' | 'dark',
  webPath: string,
  iosPath: string,
  diffPath: string,
  result: CompareResult
): Promise<string> {
  const reportDir = resolve(import.meta.dirname, '..', CONFIG.outputDir, 'reports');
  await mkdir(reportDir, { recursive: true });

  const reportPath = resolve(reportDir, `${mode}_report.html`);

  // Embed images as base64 for self-contained report
  const webB64 = fs.readFileSync(webPath).toString('base64');
  const iosB64 = fs.readFileSync(iosPath).toString('base64');
  const diffB64 = fs.readFileSync(diffPath).toString('base64');

  const presetName = CONFIG.presets[mode];
  const timestamp = new Date().toISOString();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Glass Diff Report: ${presetName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: #111;
      color: #eee;
      padding: 32px;
    }
    h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 8px; }
    .meta { color: #888; font-size: 0.8rem; margin-bottom: 24px; }
    .mismatch {
      font-size: 2rem;
      font-weight: 700;
      text-align: center;
      padding: 16px;
      margin-bottom: 24px;
      border-radius: 12px;
      background: ${result.percentage > 50 ? 'rgba(255,59,48,0.15)' : result.percentage > 20 ? 'rgba(255,149,0,0.15)' : 'rgba(52,199,89,0.15)'};
      color: ${result.percentage > 50 ? '#ff3b30' : result.percentage > 20 ? '#ff9500' : '#34c759'};
    }
    .stats { color: #888; font-size: 0.85rem; text-align: center; margin-bottom: 24px; }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
    }
    .grid > div { text-align: center; }
    .grid img {
      width: 100%;
      border: 1px solid #333;
      border-radius: 8px;
      image-rendering: pixelated;
    }
    .label {
      margin-top: 8px;
      font-size: 0.8rem;
      color: #888;
    }
  </style>
</head>
<body>
  <h1>Screenshot Diff: ${presetName}</h1>
  <div class="meta">Generated: ${timestamp} | Size: ${CONFIG.size}x${CONFIG.size} | Threshold: ${CONFIG.diffThreshold}</div>

  <div class="mismatch">${result.percentage.toFixed(2)}% mismatch</div>
  <div class="stats">${result.count.toLocaleString()} of ${result.total.toLocaleString()} pixels differ</div>

  <div class="grid">
    <div>
      <img src="data:image/png;base64,${webB64}" alt="Web (Playwright)">
      <div class="label">Web (Playwright)</div>
    </div>
    <div>
      <img src="data:image/png;base64,${iosB64}" alt="iOS (Simulator)">
      <div class="label">iOS (Simulator)</div>
    </div>
    <div>
      <img src="data:image/png;base64,${diffB64}" alt="Diff">
      <div class="label">Diff (red = mismatch)</div>
    </div>
  </div>
</body>
</html>`;

  fs.writeFileSync(reportPath, html);
  console.log(`  Report saved: ${reportPath}`);
  return reportPath;
}

# Phase 13: Screenshot Diff Pipeline - Research

**Researched:** 2026-02-26
**Domain:** Visual regression testing / image diffing pipeline (Playwright, pixelmatch, sharp, xcrun simctl)
**Confidence:** HIGH

## Summary

This phase creates a unified Node.js/TypeScript script that captures WebGPU canvas screenshots via Playwright, captures iOS Simulator screenshots via `xcrun simctl io`, normalizes both to sRGB color space, and produces pixel-diff comparisons using pixelmatch. The pipeline outputs a visual diff PNG and an HTML report for each comparison (light and dark mode).

The existing project already has Playwright 1.58.2 installed, an iOS capture script (`ios-reference/capture.sh`) with proven `xcrun simctl io` patterns, URL-based parameter injection in the demo app (Phase 12), and presets for "Apple Clear Light" and "Apple Clear Dark". The primary technical challenge is ensuring WebGPU renders correctly in Playwright's headless Chromium (requires `--enable-gpu` and `channel: "chrome"`) and normalizing the dimension mismatch between the full-device iOS screenshot (1206x2622) and the 800x800 cropped comparison region.

**Primary recommendation:** Build a single TypeScript pipeline script using `tsx` for execution, with sharp for image normalization/cropping, pixelmatch + pngjs for diffing, and Playwright's `locator.screenshot()` for WebGPU canvas capture.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Fixed 800x800 square crop for both web and iOS captures
- Identical scene on both sides: same wallpaper image, same glass panel size/position, same mode
- Use the Apple preset parameters only (Apple Clear Light, Apple Clear Dark)
- Capture both light and dark mode variants -- two diff comparisons per pipeline run
- Web capture uses Playwright; iOS capture uses `xcrun simctl io` against iPhone 16 Pro Simulator
- Terminal output: print mismatch percentage to stdout (report-only, no pass/fail threshold, exit code always 0)
- Save a visual diff PNG showing pixel differences
- Generate an HTML report showing web screenshot, iOS screenshot, and diff image
- Use pixelmatch for pixel comparison (per DIFF-03 requirement)
- Pipeline supports a region-of-interest mask restricting comparison to the glass panel area only (per DIFF-04)
- Single unified script -- one command captures web, captures iOS, normalizes, diffs, and generates the report
- Script auto-launches iPhone 16 Pro Simulator if not already running

### Claude's Discretion
- HTML report interactivity (static side-by-side vs interactive slider)
- Pipeline script language (Node.js/TypeScript recommended given Playwright and pixelmatch are JS-native)
- Output directory structure for screenshots and diffs
- Region mask definition method (fixed coordinates vs auto-detect)
- Single vs multiple comparison regions
- Whether to implement a clean capture mode (hide UI controls) vs mask-based exclusion
- Diff image mask boundary visualization

### Deferred Ideas (OUT OF SCOPE)
- AI-driven diff analysis: Claude examines visual differences and recommends architectural shader changes -- potential future phase beyond Phase 14
- Pass/fail threshold gating -- could be added later if needed for CI, but Phase 13 is report-only
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DIFF-01 | Playwright script captures WebGPU canvas screenshot at standardized pixel dimensions | Playwright `locator.screenshot()` on `#gpu-canvas` with `channel: "chrome"` and `--enable-gpu` flag; viewport set to fixed size; sharp resizes to 800x800 |
| DIFF-02 | Diff script normalizes both web and iOS screenshots to sRGB color space before comparison | sharp's default behavior converts to sRGB and strips ICC profiles; iOS screenshots from simulator already have sRGB IEC61966-2.1 profile; sharp `.toColorspace('srgb')` explicit for safety |
| DIFF-03 | pixelmatch comparison produces diff image output with mismatch percentage | pixelmatch v7.1.0 returns mismatch pixel count; percentage = count / (width * height) * 100; outputs diff PNG via pngjs |
| DIFF-04 | Diff pipeline supports region-of-interest masking to compare only the glass panel area | Apply a binary mask (transparent vs opaque) to zero out non-ROI pixels before passing to pixelmatch; mask defined as JSON coordinates in config |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| playwright | 1.58.2 | WebGPU canvas screenshot capture | Already installed in project; headless Chromium with GPU support; `locator.screenshot()` targets canvas directly |
| pixelmatch | 7.1.0 | Pixel-level image comparison | Required by DIFF-03; ~150 LOC, zero deps, works on raw typed arrays; industry standard for visual diff |
| pngjs | 7.0.0 | PNG read/write for pixelmatch I/O | Standard companion to pixelmatch; sync API for reading/writing PNG buffers |
| sharp | 0.34.5 | Image normalization, cropping, resizing, sRGB conversion | Fastest Node.js image processor; built-in sRGB conversion; handles ICC profile stripping; extract() for cropping |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | 4.x | Execute TypeScript pipeline script directly | Avoids compilation step; `npx tsx pipeline/diff.ts` for quick invocation |
| @types/pngjs | 6.0.5 | TypeScript types for pngjs | Type safety in pipeline script |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| sharp | sips (macOS CLI) | sips is zero-install but lacks programmatic Node.js API; sharp provides composable pipeline in same script |
| sharp | Jimp | Jimp is pure JS (slower, no native deps); sharp 10-100x faster for image processing |
| pngjs | sharp .raw() | Could use sharp to read raw pixel data instead of pngjs; but pixelmatch examples all use pngjs and it is more explicit |

**Installation:**
```bash
npm install --save-dev pixelmatch pngjs sharp @types/pngjs tsx
```

Note: `playwright` is already installed (v1.58.2). Ensure Chromium browsers are installed:
```bash
npx playwright install chromium
```

## Architecture Patterns

### Recommended Project Structure
```
pipeline/
  diff.ts              # Main pipeline script (single entry point)
  lib/
    capture-web.ts     # Playwright WebGPU capture
    capture-ios.ts     # xcrun simctl screenshot + crop
    normalize.ts       # sRGB normalization via sharp
    compare.ts         # pixelmatch diffing + mask support
    report.ts          # HTML report generation
    config.ts          # Pipeline configuration (dimensions, presets, ROI mask)
  output/              # Generated artifacts (gitignored)
    web/               # Web screenshots
    ios/               # iOS screenshots (cropped)
    diffs/             # Diff PNGs
    reports/           # HTML reports
```

### Pattern 1: Playwright WebGPU Canvas Capture
**What:** Launch Chrome with GPU acceleration, navigate to demo app with preset URL params, wait for render, screenshot canvas element.
**When to use:** Every pipeline run for web capture.
**Example:**
```typescript
// Source: Playwright docs + WebGPU visual testing guides
import { chromium } from 'playwright';

const browser = await chromium.launch({
  channel: 'chrome',           // Use installed Chrome (not bundled Chromium)
  args: ['--enable-gpu', '--use-gl=egl'],
});

const context = await browser.newContext({
  viewport: { width: 800, height: 800 },
  deviceScaleFactor: 1,        // 1:1 pixel mapping, no DPR scaling
  colorScheme: 'light',        // or 'dark' for dark mode variant
});

const page = await context.newPage();

// Load demo with Apple Clear Light preset via URL params
await page.goto('http://localhost:5173/?blur=0.5&opacity=0.25&tint=[0.15,0.15,0.2]&...');

// Wait for WebGPU canvas to be rendered
await page.locator('#gpu-canvas').waitFor({ state: 'visible' });
// Wait for engine init + first frame
await page.waitForFunction(() => {
  const canvas = document.getElementById('gpu-canvas') as HTMLCanvasElement;
  return canvas && canvas.width > 0 && canvas.height > 0;
});
// Extra settle time for GPU rendering
await page.waitForTimeout(2000);

const canvas = page.locator('#gpu-canvas');
const screenshot = await canvas.screenshot({ type: 'png' });

await browser.close();
```

### Pattern 2: iOS Simulator Capture + Crop
**What:** Boot simulator, set appearance, capture full screenshot, crop to 800x800 region matching the glass panel area.
**When to use:** Every pipeline run for iOS capture.
**Example:**
```typescript
// Source: existing capture.sh patterns + sharp API
import { execSync } from 'child_process';
import sharp from 'sharp';

// Boot simulator if needed
try {
  execSync('xcrun simctl boot "iPhone 16 Pro"', { stdio: 'pipe' });
} catch { /* already booted */ }

// Set appearance
execSync('xcrun simctl ui booted appearance light');

// Wait for rendering to settle
await new Promise(r => setTimeout(r, 3000));

// Capture full screenshot (1206x2622 @3x)
const rawPath = '/tmp/ios_capture_raw.png';
execSync(`xcrun simctl io booted screenshot --type=png --mask=ignored "${rawPath}"`);

// Crop to 800x800 centered on glass panel area
// Coordinates determined by glass panel position in reference app
await sharp(rawPath)
  .extract({ left: 203, top: 600, width: 800, height: 800 })
  .toColorspace('srgb')
  .toFile('pipeline/output/ios/clear_light.png');
```

### Pattern 3: sRGB Normalization
**What:** Convert both web and iOS screenshots to sRGB with ICC profile stripped, ensuring consistent color representation.
**When to use:** Before every pixelmatch comparison.
**Example:**
```typescript
// Source: sharp docs - default behavior converts to sRGB
import sharp from 'sharp';

async function normalize(inputPath: string, outputPath: string, size: number): Promise<void> {
  await sharp(inputPath)
    .resize(size, size, { fit: 'fill' })  // Force exact 800x800
    .toColorspace('srgb')                  // Explicit sRGB conversion
    .removeAlpha()                         // Strip alpha for consistent comparison
    .png({ compressionLevel: 0 })          // Lossless, fast write
    .toFile(outputPath);
}
```

### Pattern 4: ROI Mask Application
**What:** Zero out pixels outside the region-of-interest before diffing, so only the glass panel area contributes to the mismatch score.
**When to use:** When DIFF-04 mask is enabled (default on).
**Example:**
```typescript
// Source: pixelmatch API + raw pixel manipulation
import { PNG } from 'pngjs';

interface ROIMask {
  x: number;      // left offset in pixels
  y: number;      // top offset in pixels
  width: number;  // mask width
  height: number; // mask height
}

function applyMask(png: PNG, mask: ROIMask): void {
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const inROI = x >= mask.x && x < mask.x + mask.width
                 && y >= mask.y && y < mask.y + mask.height;
      if (!inROI) {
        const idx = (y * png.width + x) * 4;
        // Set to solid black (or any uniform color) so pixels outside ROI match
        png.data[idx] = 0;
        png.data[idx + 1] = 0;
        png.data[idx + 2] = 0;
        png.data[idx + 3] = 255;
      }
    }
  }
}
```

### Pattern 5: HTML Report Generation
**What:** Generate a self-contained HTML file with embedded base64 images for web, iOS, and diff.
**When to use:** After each diff comparison.
**Example:**
```typescript
function generateReport(
  webPath: string, iosPath: string, diffPath: string,
  mismatch: number, mode: string
): string {
  const webB64 = fs.readFileSync(webPath).toString('base64');
  const iosB64 = fs.readFileSync(iosPath).toString('base64');
  const diffB64 = fs.readFileSync(diffPath).toString('base64');

  return `<!DOCTYPE html>
<html><head><title>Glass Diff: ${mode}</title>
<style>
  body { font-family: system-ui; background: #1a1a1a; color: #eee; padding: 24px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
  img { width: 100%; border: 1px solid #333; border-radius: 8px; }
  .label { text-align: center; font-size: 14px; color: #888; margin-top: 8px; }
  .mismatch { font-size: 24px; text-align: center; margin: 24px 0; }
</style></head><body>
<h1>Screenshot Diff: ${mode}</h1>
<div class="mismatch">Mismatch: ${mismatch.toFixed(2)}%</div>
<div class="grid">
  <div><img src="data:image/png;base64,${webB64}"><div class="label">Web (Playwright)</div></div>
  <div><img src="data:image/png;base64,${iosB64}"><div class="label">iOS (Simulator)</div></div>
  <div><img src="data:image/png;base64,${diffB64}"><div class="label">Diff</div></div>
</div>
</body></html>`;
}
```

### Anti-Patterns to Avoid
- **Headless Chromium without GPU flags:** WebGPU canvas renders blank/white without `--enable-gpu`. Always use `channel: 'chrome'` with `args: ['--enable-gpu', '--use-gl=egl']`.
- **Comparing different pixel dimensions:** pixelmatch requires identical width/height. Always normalize both images to exactly 800x800 before diffing.
- **Relying on page.screenshot() for canvas:** Use `locator.screenshot()` targeting the canvas element specifically, not `page.screenshot()` with a clip region, to avoid off-by-one pixel issues.
- **Ignoring color space:** iOS simulator screenshots carry sRGB ICC profiles; web screenshots may not. Always run both through sharp's sRGB normalization to strip profiles and ensure consistent color representation.
- **Hard-coded sleep without render wait:** Always combine `waitForFunction` (checking canvas dimensions) with a reasonable settle timeout (2s), rather than just sleep.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pixel comparison | Custom diff algorithm | pixelmatch v7.1.0 | Anti-aliasing detection, perceptual color distance, battle-tested at Mapbox scale |
| Image resize/crop | Canvas-based resize in Node | sharp v0.34.5 | libvips-backed, 10-100x faster than pure JS; correct lanczos3 resampling |
| sRGB conversion | Manual ICC profile parsing | sharp `.toColorspace('srgb')` | Handles all input profiles automatically; strips ICC metadata |
| PNG read/write | fs.readFile + manual parsing | pngjs v7.0.0 | Standard PNG codec; sync API matches pixelmatch usage patterns |
| HTML report templates | Template engine (handlebars, ejs) | Template literal string | Report is a single static page with 3 images; a template engine adds unnecessary complexity |

**Key insight:** The entire diff pipeline is ~200 lines of glue code connecting well-tested libraries. Every component (capture, normalize, compare, report) has a standard tool. The value is in the wiring and configuration, not custom algorithms.

## Common Pitfalls

### Pitfall 1: WebGPU Blank Canvas in Headless Mode
**What goes wrong:** Playwright screenshots show a blank white or black canvas instead of the rendered glass effect.
**Why it happens:** Headless Chromium disables GPU hardware acceleration by default. WebGPU requires GPU access.
**How to avoid:** Always launch with `channel: 'chrome'` (system Chrome, not bundled Chromium) and pass `args: ['--enable-gpu', '--use-gl=egl']`. Verify with a test that checks `chrome://gpu` reports "Hardware accelerated".
**Warning signs:** Screenshot file size is suspiciously small (< 5KB for 800x800); all pixels are the same color.

### Pitfall 2: iOS Screenshot Dimension Mismatch
**What goes wrong:** pixelmatch throws "Image dimensions do not match" error.
**Why it happens:** iOS Simulator captures at device resolution (1206x2622 for iPhone 16 Pro @3x). Web capture is at logical pixels. Raw screenshots have different dimensions.
**How to avoid:** Always resize/crop both images to exactly 800x800 using sharp before comparison. The iOS image must be cropped to the glass panel region and resized; the web image viewport is set to 800x800 with `deviceScaleFactor: 1`.
**Warning signs:** Pipeline crashes immediately at the pixelmatch call.

### Pitfall 3: Color Profile Differences Inflating Mismatch
**What goes wrong:** Mismatch percentage is high (>20%) even when images look visually similar.
**Why it happens:** iOS screenshots embed an sRGB ICC profile in PNG metadata. Web screenshots have no profile (assumed sRGB). Some tools interpret the embedded profile differently, causing color shifts.
**How to avoid:** Run both images through `sharp(input).toColorspace('srgb').removeAlpha()` to strip ICC profiles and ensure identical color representation. The DIFF-02 requirement mandates solid color patches differ by <1% after normalization.
**Warning signs:** Diff image shows uniform faint pink/green tint everywhere, not localized to glass areas.

### Pitfall 4: Demo App UI Elements in Web Screenshot
**What goes wrong:** The web screenshot includes text labels, buttons, control panel, header, and footer that have no equivalent in the iOS reference app, causing massive mismatch in non-glass areas.
**Why it happens:** The demo app (Phase 12) has a full UI with control panel sidebar, header, glass elements with text, and footer. The iOS reference app shows only glass elements over the wallpaper.
**How to avoid:** Use the ROI mask (DIFF-04) to restrict comparison to just the glass panel area. Alternatively, set viewport to capture only the canvas background region behind a known glass element.
**Warning signs:** Diff image is mostly red/highlighted outside the glass panel regions.

### Pitfall 5: Simulator Not Booted or App Not Running
**What goes wrong:** `xcrun simctl io booted screenshot` fails with "No devices are booted" or the screenshot shows the home screen instead of the reference app.
**Why it happens:** The pipeline script assumes the simulator is ready. The user may not have built/installed the GlassReference app.
**How to avoid:** Auto-boot iPhone 16 Pro Simulator (`xcrun simctl boot "iPhone 16 Pro"`; ignore "already booted" errors). Launch the app by bundle ID (`xcrun simctl launch booted com.glassreference.app`). Wait for app to render before capturing.
**Warning signs:** Screenshot shows iOS home screen or springboard.

### Pitfall 6: pixelmatch ESM Import Issue
**What goes wrong:** `ERR_REQUIRE_ESM` when trying to use pixelmatch.
**Why it happens:** pixelmatch v6+ is ESM-only. Older Node.js versions cannot `require()` ESM modules.
**How to avoid:** Project already uses `"type": "module"` in package.json and Node.js 24.10.0, so standard ESM `import pixelmatch from 'pixelmatch'` works. Use `tsx` to run TypeScript files with ESM support.
**Warning signs:** Module import error at script startup.

## Code Examples

### Complete Diff Pipeline Entry Point
```typescript
// pipeline/diff.ts
// Source: Assembled from Playwright docs, pixelmatch README, sharp API docs
import { captureWeb } from './lib/capture-web.js';
import { captureIOS } from './lib/capture-ios.js';
import { normalize } from './lib/normalize.js';
import { compare } from './lib/compare.js';
import { generateReport } from './lib/report.js';
import { CONFIG } from './lib/config.js';

async function main() {
  console.log('=== Screenshot Diff Pipeline ===\n');

  for (const mode of ['light', 'dark'] as const) {
    const preset = mode === 'light' ? 'Apple Clear Light' : 'Apple Clear Dark';
    console.log(`--- ${preset} (${mode} mode) ---`);

    // 1. Capture
    await captureWeb(mode, preset);
    await captureIOS(mode);

    // 2. Normalize to sRGB 800x800
    await normalize(`output/web/${mode}.png`, `output/web/${mode}_norm.png`);
    await normalize(`output/ios/${mode}.png`, `output/ios/${mode}_norm.png`);

    // 3. Compare
    const result = await compare(
      `output/web/${mode}_norm.png`,
      `output/ios/${mode}_norm.png`,
      `output/diffs/${mode}_diff.png`,
      CONFIG.roiMask
    );

    console.log(`  Mismatch: ${result.percentage.toFixed(2)}% (${result.count} pixels)`);

    // 4. Report
    await generateReport(mode, result);
  }

  console.log('\n=== Pipeline complete ===');
  process.exit(0); // Always exit 0 (report-only)
}

main().catch(err => {
  console.error('Pipeline error:', err);
  process.exit(0); // Still exit 0 per requirement
});
```

### pixelmatch with ROI Mask
```typescript
// Source: pixelmatch README + custom mask application
import fs from 'fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

interface CompareResult {
  count: number;        // Mismatched pixels
  total: number;        // Total compared pixels
  percentage: number;   // Mismatch percentage
}

export async function compare(
  webPath: string, iosPath: string, diffPath: string,
  mask?: { x: number; y: number; width: number; height: number }
): Promise<CompareResult> {
  const webPng = PNG.sync.read(fs.readFileSync(webPath));
  const iosPng = PNG.sync.read(fs.readFileSync(iosPath));
  const { width, height } = webPng;

  // Apply ROI mask if provided
  if (mask) {
    applyMask(webPng, mask);
    applyMask(iosPng, mask);
  }

  const diff = new PNG({ width, height });
  const count = pixelmatch(
    webPng.data, iosPng.data, diff.data,
    width, height,
    { threshold: 0.1, alpha: 0.3, diffColor: [255, 0, 0] }
  );

  fs.writeFileSync(diffPath, PNG.sync.write(diff));

  const total = mask ? mask.width * mask.height : width * height;
  return { count, total, percentage: (count / total) * 100 };
}
```

### Vite Dev Server Management
```typescript
// Source: Vite CLI + Node child_process
import { spawn, ChildProcess } from 'child_process';

let viteProcess: ChildProcess | null = null;

export async function startDevServer(): Promise<string> {
  const port = 5173;
  // Check if already running
  try {
    const res = await fetch(`http://localhost:${port}`);
    if (res.ok) return `http://localhost:${port}`;
  } catch { /* not running, start it */ }

  viteProcess = spawn('npx', ['vite', '--config', 'vite.demo.config.ts', '--port', String(port)], {
    cwd: process.cwd(),
    stdio: 'pipe',
  });

  // Wait for server to be ready
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Vite start timeout')), 30000);
    viteProcess!.stdout?.on('data', (data: Buffer) => {
      if (data.toString().includes('Local:')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    viteProcess!.on('error', reject);
  });

  return `http://localhost:${port}`;
}

export function stopDevServer(): void {
  viteProcess?.kill();
  viteProcess = null;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Chromium old headless (--headless=old) | New headless mode (default in Playwright 1.49+) | Playwright 1.49, late 2024 | GPU flags behave differently; use `--enable-gpu` + `--use-gl=egl` |
| pixelmatch v5 CJS | pixelmatch v7 ESM-only | v6.0.0, 2023 | Must use ESM imports; Node 24 supports `require(esm)` natively |
| sharp v0.32 | sharp v0.34.5 | 2025 | Default sRGB conversion improved; `removeAlpha()` API stable |
| Simulator screenshots with masks | `--mask=ignored` for raw framebuffer | Always available | Use `--mask=ignored` for pixel-exact captures without device chrome |

**Deprecated/outdated:**
- Playwright's `page.screenshot({ clip: {...} })` for element capture: Use `locator.screenshot()` instead -- avoids off-by-one pixel issues
- `channel: 'chromium'` for WebGPU: Bundled Chromium may lack GPU support; prefer `channel: 'chrome'` (system Chrome)

## Open Questions

1. **Exact iOS crop coordinates for glass panel region**
   - What we know: iOS screenshots are 1206x2622 (@3x). The glass panel in ContentView.swift is positioned with VStack padding and has `cornerRadius: 28`.
   - What's unclear: The exact pixel coordinates for an 800x800 crop centered on the glass panel area. This depends on the reference app's layout at runtime.
   - Recommendation: During implementation, capture a reference screenshot, visually identify the glass panel bounding box, and hard-code the crop coordinates in `config.ts`. Could also run the simulator, take a screenshot, and measure with Preview.app. This is a one-time calibration step.

2. **Web demo viewport vs canvas content mapping**
   - What we know: The demo app has a sidebar control panel (328px right padding), header, and multiple glass elements. Setting viewport to 800x800 will include UI chrome.
   - What's unclear: Whether to capture the full canvas (which renders behind everything) or a specific region. The `#gpu-canvas` is full-viewport.
   - Recommendation: Capture the full `#gpu-canvas` (which is the WebGPU background) at 800x800. The canvas renders the wallpaper + glass effect behind all UI elements. Use the ROI mask to compare only the glass panel region. Alternatively, create a "capture mode" URL param that hides all UI overlays.

3. **Web app "capture mode" for clean screenshots**
   - What we know: The iOS app has `captureMode` state that hides UI controls. The web demo has no equivalent.
   - What's unclear: Whether the pipeline should add a `?capture=true` URL param to hide non-glass UI elements, or rely entirely on ROI masking.
   - Recommendation: Implement a `?capture=true` URL param in the demo app that hides the control panel, header, footer, and text content -- showing only the canvas with glass elements. This is a small change (few lines in `demo/App.tsx`) and produces cleaner comparisons. The ROI mask then only needs to handle the wallpaper vs glass distinction, not UI element exclusion.

4. **Vite dev server lifecycle during pipeline**
   - What we know: Playwright needs the demo app served at a URL. The demo uses `vite --config vite.demo.config.ts`.
   - What's unclear: Whether to expect the user to run the dev server manually or auto-start/stop it in the pipeline.
   - Recommendation: Auto-detect if dev server is running (fetch localhost:5173). If not, auto-start it in the pipeline, capture screenshots, then shut it down. This makes the pipeline truly single-command.

## Sources

### Primary (HIGH confidence)
- [Playwright Screenshots API](https://playwright.dev/docs/screenshots) - page.screenshot(), locator.screenshot(), clip options
- [pixelmatch GitHub](https://github.com/mapbox/pixelmatch) - v7.1.0 API, threshold, diffColor, diffMask options, pngjs integration example
- [sharp API - Resize](https://sharp.pixelplumbing.com/api-resize/) - extract(), resize() for cropping
- [sharp API - Colour](https://sharp.pixelplumbing.com/api-colour/) - toColorspace('srgb'), pipelineColorspace()
- [sharp API - Output](https://sharp.pixelplumbing.com/api-output/) - PNG options, metadata stripping behavior
- Existing project code: `ios-reference/capture.sh`, `demo/App.tsx`, `demo/controls/presets.ts`, `src/components/GlassProvider.tsx`

### Secondary (MEDIUM confidence)
- [WebGPU Visual Testing with Playwright](https://dev.to/ndesmic/webgpu-engine-from-scratch-part-11-1-visual-testing-1imh) - `--enable-gpu` flag, canvas locator screenshot, render timing
- [GPU for Playwright Headless](https://michelkraemer.com/enable-gpu-for-slow-playwright-tests-in-headless-mode/) - `--use-gl=egl` on macOS, `channel: 'chrome'` recommendation
- [Chrome WebGPU Troubleshooting](https://developer.chrome.com/docs/web-platform/webgpu/troubleshooting-tips) - `--enable-unsafe-webgpu` not needed on macOS
- iOS screenshot dimensions verified locally: 1206x2622, sRGB IEC61966-2.1 profile (via `sips -g all`)

### Tertiary (LOW confidence)
- Exact crop coordinates for iOS glass panel region -- requires runtime measurement during implementation
- Whether `channel: 'chrome'` vs `channel: 'chromium'` matters for WebGPU on macOS specifically -- multiple sources recommend 'chrome' but behavior may vary by Playwright version

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via official docs and npm; versions confirmed current
- Architecture: HIGH - Pipeline structure follows established visual testing patterns; all integration points verified
- Pitfalls: HIGH - WebGPU headless blank canvas and color profile normalization are well-documented issues with known solutions
- ROI mask implementation: MEDIUM - Pixel-level mask zeroing is straightforward but exact coordinates require runtime calibration

**Research date:** 2026-02-26
**Valid until:** 2026-03-26 (30 days -- stable domain, no fast-moving dependencies)

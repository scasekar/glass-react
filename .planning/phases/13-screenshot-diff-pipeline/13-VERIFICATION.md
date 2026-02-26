---
phase: 13-screenshot-diff-pipeline
verified: 2026-02-26T22:10:00Z
status: passed
score: 4/4 success criteria verified
re_verification: false
human_verification:
  - test: "Run npm run diff end-to-end"
    expected: "Pipeline executes capture -> normalize -> diff -> report for both light and dark modes; mismatch percentage printed to terminal; HTML reports generated at pipeline/output/reports/"
    why_human: "Requires iOS Simulator with GlassReference app installed and system Chrome with WebGPU support — cannot run in automated verification context"
  - test: "Open a generated light_report.html in a browser"
    expected: "Three-column layout showing Web, iOS, and Diff images side-by-side with color-coded mismatch percentage indicator"
    why_human: "HTML visual layout requires browser rendering to verify correctness"
  - test: "Visit demo at ?capture=true&opacity=0.25&tint=%5B0.15%2C0.15%2C0.2%5D"
    expected: "Only a centered GlassPanel over wallpaper visible — no header, no footer, no sidebar, no buttons row, no text children"
    why_human: "Visual rendering in browser cannot be verified programmatically"
---

# Phase 13: Screenshot Diff Pipeline Verification Report

**Phase Goal:** A scripted pipeline captures matching screenshots from web and iOS and produces a quantified pixel-diff comparison
**Verified:** 2026-02-26T22:10:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Success Criteria from ROADMAP.md

| # | Success Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| 1 | Running the Playwright capture script produces a PNG screenshot of the WebGPU canvas at the standardized pixel dimensions | VERIFIED | `pipeline/lib/capture-web.ts` exports `captureWeb(mode)`: launches Chrome with `--enable-gpu --use-gl=egl`, sets `viewport: {width:800, height:800}`, `deviceScaleFactor:1`, waits for `#gpu-canvas`, screenshots canvas element to `{mode}.png` |
| 2 | Both web and iOS screenshots are normalized to sRGB color space before comparison | VERIFIED | `pipeline/lib/normalize.ts` exports `normalize(input, output)`: calls `sharp().resize(800, 800, {fit:'fill'}).toColorspace('srgb').removeAlpha().png()` — explicit sRGB conversion, exact 800x800 resize, alpha strip; called by `diff.ts` for both `webRaw` and `iosRaw` before comparison |
| 3 | Running the diff script produces a visual diff image and a mismatch percentage comparing web vs iOS glass renders | VERIFIED | `pipeline/diff.ts` orchestrates full pipeline; `pipeline/lib/compare.ts` uses `pixelmatch` to produce diff PNG with red/green mismatch pixels and returns `{count, total, percentage}`; `npm run diff` script wired in package.json |
| 4 | Diff pipeline supports a region-of-interest mask that restricts comparison to the glass panel area only | VERIFIED | `pipeline/lib/compare.ts` `applyMask()` zeroes non-ROI pixels to solid black on both images before pixelmatch; `diff.ts` passes `CONFIG.roiMask` (`{x:150, y:100, width:500, height:500}`) to `compare()` |

**Score:** 4/4 success criteria verified

### Observable Truths (from PLAN must_haves)

**Plan 01 truths:**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Playwright captures a PNG screenshot of the WebGPU canvas at 800x800 pixels | VERIFIED | `capture-web.ts` lines 8-58: viewport 800x800, `canvas.screenshot({type:'png'})`, writes to `{mode}.png` |
| 2 | Demo app hides all UI chrome when ?capture=true URL param is present | VERIFIED | `demo/App.tsx` line 46-83: `isCapture = searchParams.has('capture')`, early-return renders only centered `GlassPanel` in `GlassProvider`, no ControlPanel/header/footer/buttons |
| 3 | Dev server is auto-started if not already running, and stopped after capture | VERIFIED | `dev-server.ts`: `startDevServer()` checks existing server via `fetch()` then spawns Vite; `diff.ts` calls `stopDevServer()` in `finally` block |

**Plan 02 truths:**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 4 | Running one command captures web and iOS screenshots, normalizes to sRGB, produces pixel-diff with mismatch percentage | VERIFIED | `package.json` `"diff": "npx tsx pipeline/diff.ts"`; `diff.ts` loops over light/dark: captureWeb → captureIOS → normalize(web) → normalize(ios) → compare → generateReport |
| 5 | Both web and iOS screenshots are normalized to sRGB 800x800 before comparison | VERIFIED | `normalize.ts` uses sharp with `.toColorspace('srgb').resize(800,800)` |
| 6 | Diff pipeline produces a visual diff PNG and an HTML report for each mode | VERIFIED | `compare.ts` writes `{mode}_diff.png`; `report.ts` writes `{mode}_report.html` with base64-embedded images |
| 7 | ROI mask restricts comparison to the glass panel area only | VERIFIED | `compare.ts` `applyMask()` with `{x:150, y:100, width:500, height:500}`; called with `CONFIG.roiMask` in `diff.ts` line 44 |
| 8 | Pipeline exits with code 0 regardless of mismatch percentage | VERIFIED | `diff.ts` lines 73 and 79: `process.exit(0)` in both normal path and error handler |
| 9 | Simulator is auto-launched if not already running | VERIFIED | `capture-ios.ts` lines 14-19: `execSync('xcrun simctl boot ...')` with try/catch to ignore already-booted error |

**Overall truth score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pipeline/lib/config.ts` | Pipeline configuration | VERIFIED | Exports `CONFIG` and `PipelineConfig`, `ROIMask` interfaces; `presetToQueryString()` serializes PRESETS with `capture=true`; 84 lines, substantive |
| `pipeline/lib/capture-web.ts` | Playwright web screenshot capture | VERIFIED | Exports `captureWeb(mode)`, 59 lines, full implementation with Chrome GPU flags, canvas wait, 3s settle |
| `pipeline/lib/dev-server.ts` | Vite dev server lifecycle | VERIFIED | Exports `startDevServer(port)` and `stopDevServer()`, 62 lines, checks existing server, spawns Vite, waits for "Local:" |
| `demo/App.tsx` | Capture mode hiding UI chrome | VERIFIED | Line 46-83: `isCapture` check, early-return with bare GlassPanel only |
| `pipeline/lib/capture-ios.ts` | iOS Simulator screenshot + crop | VERIFIED | Exports `captureIOS(mode)`, 59 lines, boots sim, sets appearance, crops with sharp |
| `pipeline/lib/normalize.ts` | sRGB normalization to 800x800 | VERIFIED | Exports `normalize(input, output)`, 15 lines, sharp pipeline: resize + sRGB + removeAlpha |
| `pipeline/lib/compare.ts` | pixelmatch with ROI mask | VERIFIED | Exports `compare()` and `CompareResult`, 87 lines, `applyMask()` implementation, writes diff PNG |
| `pipeline/lib/report.ts` | HTML report generation | VERIFIED | Exports `generateReport()`, 99 lines, base64-embeds all 3 images, color-coded mismatch |
| `pipeline/diff.ts` | Unified pipeline entry point | VERIFIED | 80 lines, `main()` function, sequential light/dark loop, `finally` dev server stop, `process.exit(0)` |
| `pipeline/output/.gitignore` | Output artifact exclusion | VERIFIED | Contains `*` and `!.gitignore` — excludes generated PNGs and HTML reports from git |

### Key Link Verification

**Plan 01 key links:**

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `capture-web.ts` | `config.ts` | `import CONFIG` | WIRED | Line 4: `import { CONFIG } from './config.js'` — used for `viewport`, `devServerPort`, `presetUrls`, `outputDir` |
| `capture-web.ts` | `dev-server.ts` | `startDevServer/stopDevServer` | PARTIAL | Line 5 imports both; `startDevServer` called on line 14; `stopDevServer` imported but not called (intentional — lifecycle managed by `diff.ts`) |
| `capture-web.ts` | `demo/App.tsx` | `capture=true` URL param | WIRED | `config.ts` `presetToQueryString()` sets `params.set('capture', 'true')` line 44; `diff.ts` builds URL as `${baseUrl}/?${CONFIG.presetUrls[mode]}`; `App.tsx` line 46 reads `searchParams.has('capture')` |

**Plan 02 key links:**

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `pipeline/diff.ts` | `capture-web.ts` | `import captureWeb` | WIRED | Line 2 import; line 28 `await captureWeb(mode)` |
| `pipeline/diff.ts` | `capture-ios.ts` | `import captureIOS` | WIRED | Line 3 import; line 32 `await captureIOS(mode)` |
| `pipeline/diff.ts` | `normalize.ts` | `import normalize` | WIRED | Line 4 import; lines 38-39 `await normalize(webRaw, webNorm)` and `await normalize(iosRaw, iosNorm)` |
| `pipeline/diff.ts` | `compare.ts` | `import compare` | WIRED | Line 5 import; line 44 `await compare(webNorm, iosNorm, diffPath, CONFIG.roiMask)` |
| `pipeline/diff.ts` | `report.ts` | `import generateReport` | WIRED | Line 6 import; line 50 `await generateReport(mode, webNorm, iosNorm, diffPath, result)` |
| `pipeline/diff.ts` | `dev-server.ts` | `stopDevServer` | WIRED | Line 8 import; line 57 in `finally` block and line 78 in error handler |

**Note on partial link:** `stopDevServer` imported in `capture-web.ts` but intentionally unused there — the PLAN explicitly documents "Do NOT call `stopDevServer()` here — the pipeline entry point (Plan 02) manages the dev server lifecycle." This is a minor unused-import lint warning, not a functional gap.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DIFF-01 | 13-01-PLAN, 13-02-PLAN | Playwright script captures WebGPU canvas screenshot at standardized pixel dimensions | SATISFIED | `capture-web.ts` uses Playwright with 800x800 viewport, screenshots `#gpu-canvas` element; `CONFIG.size = 800` |
| DIFF-02 | 13-02-PLAN | Diff script normalizes both web and iOS screenshots to sRGB color space before comparison | SATISFIED | `normalize.ts` `.toColorspace('srgb')` called for both `webRaw` and `iosRaw` in `diff.ts` before `compare()` |
| DIFF-03 | 13-02-PLAN | pixelmatch comparison produces diff image output with mismatch percentage | SATISFIED | `compare.ts` uses `pixelmatch()` to write diff PNG with `diffColor:[255,0,0]`; returns `{count, total, percentage}`; `diff.ts` prints and collects percentage |
| DIFF-04 | 13-02-PLAN | Diff pipeline supports region-of-interest masking to compare only the glass area | SATISFIED | `compare.ts` `applyMask()` zeroes non-ROI pixels to black on both images; `diff.ts` passes `CONFIG.roiMask` to `compare()` |

All 4 requirements fully satisfied. No orphaned requirements.

### Commits Verified

All commits documented in SUMMARY.md files were verified present in git log:

| Commit | Description | Plan |
|--------|-------------|------|
| `d11140c` | feat(13-01): install pipeline deps, create config, add capture mode | 13-01 Task 1 |
| `942a249` | feat(13-01): implement Playwright web capture and Vite dev server lifecycle | 13-01 Task 2 |
| `244f5a1` | feat(13-02): iOS capture, sRGB normalization, and pixelmatch comparison with ROI mask | 13-02 Task 1 |
| `606a841` | feat(13-02): HTML report generation, unified pipeline entry point, and npm script | 13-02 Task 2 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `pipeline/lib/capture-web.ts` | 5 | `stopDevServer` imported but never called | Info | No functional impact — intentional design decision documented in PLAN; minor unused import |

No blocking or warning anti-patterns found. No TODO/FIXME/placeholder comments. No empty implementations or stub returns.

### Human Verification Required

#### 1. End-to-End Pipeline Execution

**Test:** Run `npm run diff` from project root with iOS Simulator running and GlassReference app installed
**Expected:** Terminal shows progress for light and dark modes ([1/5]...[5/5]), prints mismatch percentages for both modes, creates `pipeline/output/reports/light_report.html` and `pipeline/output/reports/dark_report.html`; exits with code 0
**Why human:** Requires iOS Simulator with GlassReference app (`com.glassreference.app` bundle ID) and system Chrome with WebGPU GPU access — cannot run in automated CI context

#### 2. HTML Report Visual Layout

**Test:** Open `pipeline/output/reports/light_report.html` in a browser after running the pipeline
**Expected:** Three images side-by-side (Web, iOS, Diff), mismatch percentage displayed with color coding (green < 20%, orange 20-50%, red > 50%), metadata line showing timestamp and config
**Why human:** HTML visual rendering requires browser; base64 image embedding correctness requires actual pipeline run

#### 3. Capture Mode Visual Appearance

**Test:** Open the demo app with `?capture=true&opacity=0.25&tint=%5B0.15%2C0.15%2C0.2%5D` URL
**Expected:** Blank viewport with centered GlassPanel over wallpaper background — no header ("LiquidGlass React"), no footer hint, no button row, no sidebar ControlPanel, no text inside the panel
**Why human:** Visual browser rendering required; capture mode correctness for screenshot comparison requires visual inspection

### Gaps Summary

No gaps found. All automated checks passed at all three levels (exists, substantive, wired).

The one noted item — `stopDevServer` imported but not called in `capture-web.ts` — is an intentional design decision explicitly documented in the PLAN: "Do NOT call `stopDevServer()` here -- the pipeline entry point (Plan 02) manages the dev server lifecycle." This is a lint-level unused import, not a functional gap.

---

_Verified: 2026-02-26T22:10:00Z_
_Verifier: Claude (gsd-verifier)_

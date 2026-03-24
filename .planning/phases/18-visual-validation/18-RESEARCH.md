# Phase 18: Visual Validation - Research

**Researched:** 2026-03-24
**Domain:** Screenshot diff pipeline, coordinate-descent tuning, Playwright capture against iOS Simulator
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VIS-01 | Re-tune presets against iOS Simulator ground truth using coordinate-descent pipeline | Tuning pipeline (`npm run tune`) is fully operational. The pipeline's `capture-web.ts` targets `#gpu-canvas` which still exists at the same DOM ID in v3.0. Preset params in `demo/controls/presets.ts` are the output target. |
| VIS-02 | Automated diff confirms convergence against iOS reference (not v2.0 baseline) | `npm run diff` runs `pipeline/diff.ts` which captures web vs iOS, normalizes both, and computes pixel mismatch score. iOS reference screenshots in `pipeline/output/ios/` serve as ground truth. Score must not be worse than last committed scores (light: ~0.40%, dark: ~0.85%). |
</phase_requirements>

## Summary

Phase 18 establishes that the v3.0 architecture (JS glass pipeline) produces visual output that matches or improves upon the v2.0 baseline scores against iOS Simulator ground truth. The prior milestone (v2.0) achieved light mode 0.40% and dark mode 0.85% mismatch using the coordinate-descent tuner. Phase 17 just completed the full v3.0 React integration wiring — GlassProvider now drives GlassRenderer.render() with the JS glass pipeline. The core question for this phase is whether the v3.0 pipeline produces visually equivalent output and whether the presets need re-tuning after the architecture change.

The good news: the entire capture-and-diff toolchain (`pipeline/`) is already functional and does not need changes for v3.0. The pipeline's web capture script targets `#gpu-canvas` (still present in `GlassProvider.tsx`), uses the demo app's capture mode URL flag (`?capture=true`), and reads preset params from `demo/controls/presets.ts` — all unchanged. The tuner evaluates rendering by loading URLs with query-string parameters, meaning it is agnostic to whether the glass comes from C++ or JS. The iOS reference screenshots cached in `pipeline/output/ios/` remain valid since the iOS reference app is unchanged.

The key risk is that the v3.0 JS pipeline may render the glass effect with subtle differences from the v2.0 C++ pipeline — different GPU rounding, slightly different uniform packing, or DPR handling differences — which would shift the preset scores. If scores have regressed, `npm run tune` re-converges them. The tuning process is well-established: 3-phase group descent (interior → edges → distortion), each with adaptive step halving, running ~23 max cycles total.

**Primary recommendation:** Run `npm run diff` first to check current scores. If either preset scores worse than the v2.0 baseline (light 0.40%, dark 0.85%), run `npm run tune -- --mode [light|dark]` and update `demo/controls/presets.ts` with the best-params output.

## Standard Stack

### Core (all pre-existing, no new packages needed)

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| `pipeline/diff.ts` | project-local | Full capture + compare pipeline | Already working v2.0 tool |
| `pipeline/tune.ts` | project-local | Coordinate-descent preset optimizer | Already working v2.0 tool |
| Playwright chromium | ^1.58.2 | Headless Chrome for web screenshot capture | Already installed |
| pixelmatch | ^7.1.0 | Binary pixel diff metric for diff reports | Already installed |
| pngjs | ^7.0.0 | PNG read/write for tuning scorer | Already installed |
| sharp | ^0.34.5 | Image normalization (resize, sRGB) | Already installed |
| xcrun simctl | macOS system | iOS Simulator control for iOS reference capture | System tool, no install |

### Supporting

| Tool | Purpose | Notes |
|------|---------|-------|
| `pipeline/lib/tuner.ts` (phasedDescent) | 3-phase group descent optimizer | interior → edges → distortion phases |
| `pipeline/lib/scorer.ts` (createScorer) | Capture + normalize + hybrid-score in one call | Fraction-mismatch × mean-error metric |
| `pipeline/lib/capture-web.ts` | Launch Playwright, load capture URL, screenshot `#gpu-canvas` | Already targets v3.0 canvas ID |
| `pipeline/lib/capture-ios.ts` | xcrun simctl boot/launch/screenshot GlassReference app | iOS reference unchanged |
| `demo/controls/presets.ts` | Source of truth for named preset parameters | Output of tuning is written back here |

**Commands:**
```bash
npm run diff                         # Full compare: light + dark
npm run tune -- --mode light         # Re-tune Clear Light preset
npm run tune -- --mode dark          # Re-tune Clear Dark preset
```

## Architecture Patterns

### Capture Flow (web side)

```
npm run diff / tune
    └── dev-server.ts: spawn `vite --config vite.demo.config.ts --port 5173`
    └── capture-web.ts: chromium.launch({ args: ['--enable-gpu', '--enable-unsafe-webgpu', '--use-angle=metal'] })
        └── navigate to http://localhost:5173/?capture=true&blur=...&opacity=...
        └── page.locator('#gpu-canvas').waitFor({ state: 'visible' })
        └── page.waitForTimeout(3000)  // GPU settle time
        └── canvas.screenshot({ type: 'png' })
    └── normalize.ts: sharp → resize to 800x800 sRGB
    └── compare.ts: pixelmatch → binary diff PNG + percentage
    └── scorer.ts (tune only): hybrid score = fraction_mismatch × mean_error × 100
```

The capture URL is built by `config.ts`'s `presetToQueryString()`, which serializes all 17 `GlassParams` fields into query params. `App.tsx`'s `getParamsFromURL()` reads them back. When `?capture=true` is present, App renders a single circular `GlassButton` centered in a square viewport — the exact scene compared against the iOS reference.

### iOS Reference Capture Flow

```
capture-ios.ts:
    └── xcrun simctl boot "iPhone 17 Pro"
    └── xcrun simctl ui booted appearance [light|dark]
    └── xcrun simctl terminate booted com.glassreference.app
    └── xcrun simctl launch booted com.glassreference.app
    └── wait 3s
    └── xcrun simctl io booted screenshot → /tmp/glass_pipeline_ios_raw.png
    └── sharp.extract({ left: 0, top: 708, width: 1206, height: 1206 })  // crop center square
```

The `GlassReference` iOS app is already installed in the simulator. It shows `.glassEffect(.clear)` on a matching wallpaper background. iOS reference screenshots are stable — the iOS app and wallpaper have not changed.

### Tuning Algorithm Pattern

The tuner uses phased group coordinate descent in 3 phases:

1. **interior** (10 max cycles): blurRadius, contrast, saturation, opacity, tint_r, tint_g, tint_b — largest pixel area, highest visual impact
2. **edges** (8 max cycles): specular, rim, envReflectionStrength, fresnelExponent, glareDirection — border highlight identity
3. **distortion** (5 max cycles): refraction, aberration, fresnelIOR — subtle lens effects

Per-parameter adaptive step halving: if neither ±step improves the score, the step for that param is halved. When step < minStep, the param is frozen for that phase. Greedy line search: when a direction improves, keep stepping in that direction until score stops improving (up to 8 more steps).

Score metric is hybrid: `(mismatch_pixel_count / total) × mean_color_error × 100`. Lower is better. Unlike binary pixelmatch, this responds to magnitude of color differences, making it a smooth, gradient-friendly objective.

### Updating Presets After Tuning

After `npm run tune` completes, the best params are written to `pipeline/output/tuning/best-params-[mode].json`. These must be manually copied into `demo/controls/presets.ts`:

```typescript
// In demo/controls/presets.ts — replace the appropriate entry in PRESETS
'Clear Light': {
  ...DEFAULTS,
  // paste best-params-light.json values here
},
'Clear Dark': {
  ...DEFAULTS,
  // paste best-params-dark.json values here
},
```

After updating presets, run `npm run diff` again to confirm the score with the new preset values.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pixel comparison metric | Custom image diff | `pipeline/lib/scorer.ts computeTuningScore()` | Already tuned noise floor (8/255), hybrid metric validated on v2.0 |
| Optimizer | New search algorithm | `pipeline/lib/tuner.ts phasedDescent()` | Phased groups + adaptive step halving + line search are all already proven |
| iOS screenshot capture | New xcrun wrapper | `pipeline/lib/capture-ios.ts` | Already handles boot, appearance, terminate-relaunch, status bar override, crop |
| Web screenshot capture | New browser automation | `pipeline/lib/capture-web.ts` + `scorer.ts captureWithParams()` | Already handles WebGPU settle time, canvas ID wait, persistent context |
| Report generation | New HTML reporter | `pipeline/lib/report.ts generateReport()` | Already produces side-by-side HTML diff reports |

## Common Pitfalls

### Pitfall 1: Stale iOS Reference Screenshots
**What goes wrong:** The tuner compares web output against `pipeline/output/ios/` screenshots. If those are stale (from a prior run with different iOS app state or wallpaper), the tuner optimizes toward an outdated target.
**Why it happens:** `npm run tune` re-captures iOS at the start, but `pipeline/output/tuning/ios-ref-*.png` may differ from the `pipeline/output/ios/*.png` used by `npm run diff`.
**How to avoid:** Always run `npm run diff` (which also recaptures iOS) rather than trusting cached screenshots when checking scores.
**Warning signs:** Diff score much better than expected, or iOS screenshots look different on manual inspection.

### Pitfall 2: GPU Settle Time Insufficient
**What goes wrong:** `captureWithParams()` uses `waitForTimeout(2000)` (warm browser) and `captureWeb()` uses 3000ms. If the v3.0 WASM init or wallpaper upload takes longer, screenshots may capture a partially-rendered frame.
**Why it happens:** v3.0 added async wallpaper upload (`loadAndUploadWallpaper`) on top of the existing WASM init. This adds a fetch + createImageBitmap step before the background is fully rendered.
**How to avoid:** Verify visually that the captured web screenshot shows the wallpaper background (not black). If it shows black or a uniform color, increase `waitForTimeout` in `capture-web.ts`.
**Warning signs:** Web screenshots show solid color background instead of the wallpaper texture.

### Pitfall 3: Dev Server Port Conflict
**What goes wrong:** `pipeline/lib/dev-server.ts` starts Vite on port 5173. If the regular demo dev server is already running on 5173 (e.g., left over from development), the pipeline will use the already-running server, which may be serving a different version.
**Why it happens:** `startDevServer()` first checks if something is already responding on the port; if yes, it reuses it without verifying which config it's using.
**How to avoid:** Stop any running dev servers before running the pipeline (`kill $(lsof -ti:5173)`).
**Warning signs:** Unexpected behavior, stale code served.

### Pitfall 4: Preset Values Not Written Back to presets.ts
**What goes wrong:** `npm run tune` writes `pipeline/output/tuning/best-params-[mode].json` but does NOT automatically update `demo/controls/presets.ts`. The presets file is the source of truth used at runtime.
**Why it happens:** By design — the tuner is a research tool, not an auto-commit bot.
**How to avoid:** After each tune run, explicitly copy the values from best-params JSON to the PRESETS object in presets.ts. Then run `npm run diff` to confirm the score with the updated presets.

### Pitfall 5: Score Regression Due to v3.0 Shader Path Differences
**What goes wrong:** The JS glass pipeline may produce subtly different output than the v2.0 C++ pipeline for the same nominal parameter values — different GPU rounding, slightly different uniform packing order, or different DPR handling.
**Why it happens:** The shader (glass.wgsl) was ported verbatim, but the uniform buffer packing in JS (`buildGlassUniformData()`) must match the C++ struct layout exactly. If any field is at a different float32 offset, the GPU sees wrong values.
**How to avoid:** The uniforms tests (`src/renderer/__tests__/uniforms.test.ts`) already verify all 28 float fields at their exact byte offsets. These tests pass (27 green). Any regression would be caught at the shader/uniform level, not at the visual level.
**Warning signs:** Scores significantly worse than v2.0 baseline (light > 1%, dark > 2%) with no obvious explanation.

### Pitfall 6: cornerRadius Clamping in Capture Mode
**What goes wrong:** The capture mode renders a `GlassButton` with `cornerRadius={9999}` (a circle). The v2.0 fix clamps `cornerRadius` in the WGSL shader: `min(glass.cornerRadius * dpr, min(rectHalf.x, rectHalf.y))`. In v3.0, this clamping lives in `src/renderer/glass.wgsl`. If the clamping was lost during the WGSL port, the capture scene renders as fully transparent.
**Why it happens:** WGSL port verbatim from glass.wgsl.h preserves the clamp. But worth verifying.
**How to avoid:** Inspect the capture screenshot before scoring — it must show a visible circular glass element.
**Warning signs:** Web screenshot is entirely transparent/white over the background.

## Code Examples

### Running the Diff Pipeline
```bash
# Source: pipeline/diff.ts (project codebase)
npm run diff
# Produces: pipeline/output/diffs/light_diff.png, dark_diff.png
#           pipeline/output/reports/light_report.html, dark_report.html
# Scores printed to stdout, always exits 0
```

### Running the Tuner (single mode)
```bash
# Source: pipeline/tune.ts (project codebase)
npm run tune -- --mode dark
# Reads: pipeline/output/ios/ for iOS reference (recaptures fresh)
# Writes: pipeline/output/tuning/best-params-dark.json
#         pipeline/output/tuning/tune-log-dark.json
# Does NOT update demo/controls/presets.ts — manual step required
```

### Updating Presets After Tuning
```typescript
// Source: demo/controls/presets.ts
// After tune, copy values from pipeline/output/tuning/best-params-[mode].json
export const PRESETS: Record<string, GlassParams> = {
  'Clear Light': {
    ...DEFAULTS,
    blur: 0.3,          // from best-params-light.json
    opacity: 0.17,
    // ... all 17 fields
  },
  'Clear Dark': {
    ...DEFAULTS,
    blur: 0.08,         // from best-params-dark.json
    // ... all 17 fields
  },
};
```

### Checking Current Scores Programmatically
```bash
# Last committed scores (from tune-log JSON artifacts)
cat pipeline/output/tuning/tune-log-light.json | node -e \
  "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); \
   console.log('light finalScore:', d.finalScore)"
# light finalScore: 0.4009...

cat pipeline/output/tuning/tune-log-dark.json | node -e \
  "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); \
   console.log('dark finalScore:', d.finalScore)"
# dark finalScore: 0.8511...
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| C++ glass pipeline renders glass | JS GlassRenderer renders glass | Phase 16+17 (v3.0) | Visual output may differ slightly — this phase confirms parity |
| emscripten_set_main_loop render loop | JS requestAnimationFrame render loop | Phase 17 (v3.0) | Timing change should not affect captured screenshots (static settle) |
| Single C++ render pass | Two-pass: C++ background + JS glass | Phase 16+17 (v3.0) | Same visual result; two queue.submit() calls instead of one |
| No wallpaper async load at init | loadAndUploadWallpaper() on engine ready | Phase 17 | Adds async step before wallpaper appears; capture settle time may need increase |

**v2.0 Baseline Scores (target: must not regress):**
- Clear Light: 0.40% hybrid mismatch score
- Clear Dark: 0.85% hybrid mismatch score

Note: These are hybrid scores from `computeTuningScore()` (fraction_mismatch × mean_error × 100), NOT the binary pixelmatch percentage. The HANDOFF.md refers to older pixelmatch scores (3.01% and 14.90%) from before the tuner was run. The tune-log JSON files contain the authoritative post-tuning scores.

## Open Questions

1. **Does v3.0 produce visible output before wallpaper upload completes?**
   - What we know: `loadAndUploadWallpaper()` is called after `setReady(true)`. The rAF loop starts at `ready=true`. There is a window where background mode is 'image' but no image data is uploaded yet.
   - What's unclear: Does the C++ engine fall back to noise or render black when in image mode with no data uploaded? If it renders black, the 3s capture settle time may not be enough.
   - Recommendation: Add a visual check to the first test task — capture a screenshot manually and verify the wallpaper background is visible before proceeding with tuning.

2. **How much did v3.0 shift the scores vs v2.0 baseline?**
   - What we know: uniform layout is tested and verified. WGSL shader was ported verbatim from the v2.0 C++ glass.wgsl.h header.
   - What's unclear: Exact score before re-tuning — unknown until `npm run diff` is run against v3.0 build.
   - Recommendation: Run `npm run diff` as the first task and record both scores. If light ≤ 0.40% and dark ≤ 0.85%, the presets don't need re-tuning. If either is worse, run `npm run tune`.

3. **Is the WASM build current?**
   - What we know: git status shows `engine/src/shaders/glass.wgsl.h` modified (listed in git status as tracked changed file).
   - What's unclear: Whether `engine/build-web/` is up to date with the current source.
   - Recommendation: Phase 18 should start with `npm run build:wasm` to ensure the WASM binary is fresh before running any capture.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.1 (unit) + Playwright 1.58.2 (e2e) |
| Config file | vitest.config.ts (default) / playwright.config.ts |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose && npx playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| VIS-01 | Clear Light and Clear Dark presets tuned against iOS ground truth | Manual + pipeline | `npm run tune -- --mode light && npm run tune -- --mode dark` | Not automated unit test — requires live GPU + iOS Simulator |
| VIS-02 | Automated diff confirms convergence scores not regressed from v2.0 | Pipeline smoke | `npm run diff` | Exits 0 regardless of score (report-only by locked decision) |

**Note:** VIS-01 and VIS-02 are pipeline/manual tasks, not vitest unit tests. The existing 27 vitest tests cover the shader and renderer internals but do not measure visual parity against iOS. There is no automated threshold check in `npm run diff` (it always exits 0 per the locked design decision in `pipeline/diff.ts`). Visual parity is validated by manual inspection of diff reports and score comparison against baseline.

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose` (existing 27 unit tests — fast, ~453ms)
- **Per wave merge:** `npx vitest run --reporter=verbose && npx playwright test` (adds e2e harness tests)
- **Phase gate:** `npm run diff` scores confirmed ≤ v2.0 baseline before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers the phase requirements. The pipeline itself is the test infrastructure for VIS-01/VIS-02.

## Sources

### Primary (HIGH confidence)
- Live codebase: `pipeline/diff.ts`, `pipeline/tune.ts`, `pipeline/lib/*.ts` — direct source inspection, no assumptions
- Live codebase: `demo/App.tsx` — confirms `#gpu-canvas` ID, `?capture=true` flow, URL param parsing are all unchanged in v3.0
- Live codebase: `demo/controls/presets.ts` — current preset values match last tune-log output
- Live codebase: `pipeline/output/tuning/tune-log-*.json` — authoritative baseline scores (light: 0.40%, dark: 0.85%)
- Live codebase: `src/renderer/__tests__/uniforms.test.ts`, `src/renderer/__tests__/shader.test.ts` — 27 tests green, uniform layout verified
- Live codebase: `src/components/GlassProvider.tsx` — v3.0 implementation confirms canvas ID, wallpaper upload timing, rAF loop structure

### Secondary (MEDIUM confidence)
- `pipeline/lib/capture-web.ts` line 36: `#gpu-canvas` selector confirmed present in GlassProvider.tsx line 258
- `.planning/HANDOFF.md` — v2.0 session notes, historical pixelmatch scores (3.01% / 14.90% pre-tuning)

### Tertiary (LOW confidence)
- None — all findings are backed by direct code inspection

## Metadata

**Confidence breakdown:**
- Pipeline compatibility: HIGH — direct code inspection confirms all selectors/IDs/APIs unchanged
- Baseline scores: HIGH — authoritative from tune-log JSON artifacts (light 0.40%, dark 0.85%)
- Shader parity: HIGH — uniform layout verified by 27 passing unit tests; WGSL ported verbatim
- Score regression risk: MEDIUM — confirmed shader correctness but GPU rounding differences are possible until `npm run diff` is run against actual v3.0 build

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable toolchain; iOS reference app unchanged)

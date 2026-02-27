# Visual Parity Tuning — Handoff

**Date:** 2026-02-27
**Goal:** Get web glass shader as close to Apple Liquid Glass (Clear) as possible

## Current State

- Pipeline infrastructure **fixed and working** (commit `b09afc1`)
- Chrome WebGPU: `--use-angle=metal` (macOS Metal backend)
- iOS capture: `DEVELOPER_DIR` fix for `xcrun simctl`, device = iPhone 17 Pro
- iOS reference app: rebuilt with `.clear` glass variant default
- **Baseline**: Light 72.75% mismatch, Dark 72.75%
- The dev server is expected to be running at http://localhost:5173 (start with `npm run dev` if not)

## Why Mismatch Is So High (72.75%)

Two problems — **structural mismatch** AND **visual mismatch**:

### Structural (inflates score, not about glass quality):
- Web capture: centered 360×240 glass panel in 800×800 viewport
- iOS capture: cropped 800×800 from full-screen app with text overlays, nav bars, etc.
- The images show completely different compositions

### Visual (the actual glass effect differences):
| Aspect | iOS (Clear) | Web (Current) | Action Needed |
|--------|-------------|---------------|---------------|
| **Blur** | Very subtle — background clearly visible | Way too blurry/frosted | Reduce `blurRadius` (15→3-5) |
| **Tint opacity** | Nearly transparent | Too opaque dark blue tint | Reduce `opacity` (0.25→0.05-0.08) |
| **Tint color** | Neutral/warm, barely visible | Dark blue [0.15,0.15,0.2] | Shift lighter/warmer |
| **Specular/Rim** | Very subtle edge gleam | Too strong | Reduce both |
| **Overall** | Glass is nearly invisible, just slightly frosted | Heavy frosted glass look | Major reduction needed |

## IMMEDIATE Next Steps (do these in order)

### Step 1: Align capture compositions
Both screenshots must show comparable content for the diff score to be meaningful.

**A) Make web capture panel fill the viewport:**
- Edit `demo/App.tsx` line 61: change `width: 360, height: 240` to `width: '100%', height: '100%'`
- This makes the glass panel fill the 800×800 capture viewport

**B) Calibrate iOS crop region:**
- View the raw iOS screenshot at `/tmp/glass_pipeline_ios_raw.png` (1206×2622)
- Find the large glass card (the one with "Glass Panel" text)
- Update `iosCropRegion` in `pipeline/lib/config.ts` to isolate just that card
- The card is roughly at: `{ left: 40, top: 400, width: 1126, height: 500 }` (needs visual calibration)

**C) Tighten ROI mask:**
- Focus on the center of the glass where there's no text on either image
- Something like `{ x: 200, y: 250, width: 400, height: 300 }` (centered, avoids text)

### Step 2: Rough-tune presets
Update `demo/controls/presets.ts` "Apple Clear Light":
```
blur: 0.5 → 0.3
opacity: 0.25 → 0.06
blurRadius: 15 → 4
tint: [0.15, 0.15, 0.2] → [0.5, 0.5, 0.55]
contrast: 0.85 → 0.95
saturation: 1.4 → 1.1
specular: 0.2 → 0.08
rim: 0.15 → 0.04
```

### Step 3: Run diff, look at screenshots, iterate
```bash
npm run diff   # Capture both modes, generate reports
```
Then read the output images visually:
- `pipeline/output/web/light_norm.png` — web screenshot
- `pipeline/output/ios/light_norm.png` — iOS screenshot
- `pipeline/output/diffs/light_diff.png` — diff overlay

### Step 4: Run automated tuner
```bash
npm run tune -- --mode light --max-cycles 20
```
Apply best params from `pipeline/output/tuning/best-params-light.json` back to presets.ts.

### Step 5: Shader code changes (if parameters aren't enough)
- `engine/src/shaders/glass.wgsl.h` — the WGSL glass shader
- May need: blur kernel shape changes, vibrancy effect, edge falloff curves

## Key Files
- `demo/App.tsx` — capture mode layout (line 48-83)
- `demo/controls/presets.ts` — Apple Clear Light/Dark parameter presets
- `pipeline/lib/config.ts` — crop regions, ROI mask, presets
- `pipeline/lib/capture-ios.ts` — iOS simulator capture
- `pipeline/lib/capture-web.ts` — Playwright web capture
- `pipeline/lib/scorer.ts` — tuning loop scorer (persistent browser)
- `engine/src/shaders/glass.wgsl.h` — WGSL glass shader (7.8KB)
- `pipeline/tune.ts` — automated tuning entry point
- `pipeline/diff.ts` — diff pipeline entry point

## Commands
```bash
npm run dev               # Start dev server (needed for capture)
npm run diff              # Capture + compare both modes
npm run tune              # Run automated tuner (light mode default)
npm run tune -- --mode dark --max-cycles 20
```

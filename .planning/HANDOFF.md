# Visual Parity Tuning — Handoff

**Date:** 2026-02-26
**Goal:** Get web glass shader as close to Apple Liquid Glass (Clear) as possible

## What Was Done

1. **Fixed pipeline infrastructure** (committed `b09afc1`):
   - Chrome WebGPU was rendering black — fixed by using `--use-angle=metal` instead of `--use-gl=egl`
   - iOS capture was failing — fixed `DEVELOPER_DIR` for `xcrun simctl`
   - Updated device to iPhone 17 Pro
   - Changed iOS reference app to default to `.clear` glass variant

2. **Baseline captured**: Light 72.75% mismatch, Dark 72.75%

## Key Visual Findings

Comparing iOS Clear glass vs web rendering:

| Aspect | iOS (Clear) | Web (Current) | Action Needed |
|--------|-------------|---------------|---------------|
| **Blur** | Very subtle — background clearly visible | Way too blurry/frosted | Reduce `blurRadius` significantly (15→3-5?) |
| **Tint opacity** | Nearly transparent | Too opaque dark blue tint | Reduce `opacity` (0.25→0.05-0.10?) |
| **Tint color** | Neutral/warm, barely visible | Dark blue [0.15,0.15,0.2] | Shift warmer, reduce saturation |
| **Refraction** | Subtle edge distortion | Visible but OK | May be close already |
| **Specular** | Very subtle edge gleam | Present | May need reduction |
| **Overall** | Glass is nearly invisible, just slightly frosted | Heavy frosted glass look | Major parameter reduction needed |

## Structural Comparison Issues

The diff score (72.75%) is inflated because **web and iOS show different compositions**:
- Web: centered 360×240 glass panel in 800×800 viewport
- iOS: cropped 800×800 from full-screen app with text overlays

### To Fix For Meaningful Comparison:
1. **Option A**: Make web capture full-viewport glass (match iOS layout)
2. **Option B**: Crop iOS to just the glass card area, exclude text
3. **Option C**: Focus ROI mask on a text-free glass area only
4. **Best**: Combine — make web panel bigger + tighten iOS crop + smaller ROI on glass-only area

## Next Steps (Priority Order)

### 1. Fix Comparison (make diff scores meaningful)
- Adjust web capture mode to render larger glass panel (e.g., 600×400 instead of 360×240)
- Recalibrate `iosCropRegion` in config.ts to isolate just the large glass card
- Tighten `roiMask` to focus on center of glass (avoid text areas)
- Goal: get structural mismatch down so parameter tuning shows real improvement

### 2. Rough Manual Tuning (big parameter changes)
Based on visual comparison, update "Apple Clear Light" preset:
```
blur: 0.5 → 0.3
opacity: 0.25 → 0.08
blurRadius: 15 → 4
tint: [0.15, 0.15, 0.2] → [0.4, 0.4, 0.45] (lighter, less saturated)
contrast: 0.85 → 0.95 (less contrast reduction)
saturation: 1.4 → 1.1 (less boost)
specular: 0.2 → 0.1
rim: 0.15 → 0.05
```

### 3. Run Automated Tuner
After manual rough-tune gets score down, run `npm run tune -- --mode light` to fine-tune all 16 parameters via coordinate descent.

### 4. Shader Code Changes (if parameters aren't enough)
May need to modify `engine/src/shaders/glass.wgsl.h`:
- Apple's glass has a very subtle "vibrancy" effect (slight color boost without heavy tint)
- The blur might need to be a different kernel shape
- Edge effects (rim, specular) might need different falloff curves

### 5. Iterate
Run diff → inspect screenshots visually → adjust → repeat

## Key Files
- `pipeline/lib/config.ts` — crop regions, ROI mask, presets
- `demo/controls/presets.ts` — Apple Clear Light/Dark parameter presets
- `engine/src/shaders/glass.wgsl.h` — WGSL glass shader (7.8KB)
- `pipeline/tune.ts` — automated tuning entry point
- `pipeline/diff.ts` — diff pipeline entry point

## Commands
```bash
npm run diff          # Capture + compare both modes
npm run tune          # Run automated tuner (light mode default)
npm run tune -- --mode dark --max-cycles 20  # Dark mode, more cycles
```

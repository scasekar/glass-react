# Visual Parity Tuning — Handoff

**Date:** 2026-02-27
**Status:** Light mode converged (3.52%), Dark mode needs iOS dark capture fix

## Current Scores
- **Light: 3.52%** — strong match, remaining diff at borders/edges only
- **Dark: 34.48%** — iOS light/dark captures are identical (dark mode bug)

## What Changed This Session

### Pipeline Fixes
1. **Capture mode**: Glass panel now 70% viewport with cornerRadius=24 (was 100% + cornerRadius=0)
   - Allows testing edge highlights, rim glow, refraction at borders
   - Both web (`demo/App.tsx`) and iOS (`ContentView.swift`) updated to match
2. **ROI**: Full 800x800 image (was 50,50,700,700 — missing edges)
3. **Diff threshold**: 0.05 (was 0.1)

### Tuner Rewrite
- **Phased descent**: interior → edges → distortion (coupled params tuned together)
- **Line search**: When direction helps, keeps going (was: test ±1 step only)
- **Per-param step halving**: Only shrinks the stuck param (was: global halve)
- **Hybrid scoring**: `fraction_mismatching × mean_error_magnitude` (not pixelmatch binary count or MSE)
- See `pipeline/lib/tuner.ts` for full implementation

### Tuned Apple Clear Light Params (major changes from pre-tuning)
| Param | Before | After | Insight |
|-------|--------|-------|---------|
| contrast | 0.88 | 1.28 | iOS BOOSTS contrast, doesn't reduce |
| opacity | 0.08 | 0.17 | iOS tint more visible than assumed |
| rim | 0.10 | 0.40 | iOS has strong bright border rim |
| blurRadius | 8 | 3.5 | iOS barely blurs background |
| saturation | 1.2 | 0.9 | iOS slightly desaturates |
| specular | 0.15 | 0.05 | iOS specular subtle, rim does heavy lifting |
| refraction | 0.08 | 0.0 | iOS Clear = no lens distortion |
| envReflection | 0.10 | 0.02 | iOS minimal env reflection |
| fresnelExp | 3.0 | 0.5 | Very broad falloff |

## Known Issues

### iOS Dark Mode Capture
`pipeline/lib/capture-ios.ts` uses `simctl ui booted appearance dark` but iOS light and dark screenshots are byte-identical. Either:
1. The app's `@Binding var colorScheme` isn't responding to system appearance changes
2. `.glassEffect(.clear)` looks identical in light/dark mode (unlikely)
3. The app needs to be terminated and relaunched after appearance change

**Fix attempt needed**: Try `simctl terminate booted com.glassreference.app` before `simctl launch` when switching modes.

## IMMEDIATE Next Steps

### 1. Fix iOS dark mode capture
Edit `pipeline/lib/capture-ios.ts` — terminate and relaunch app between light/dark:
```typescript
simctl('terminate booted com.glassreference.app');
// wait...
simctl('launch booted com.glassreference.app');
```

### 2. Tune Dark preset
Once dark capture works, run:
```bash
npm run tune -- --mode dark
```

### 3. Further light refinement (optional)
The remaining 3.52% is at edges. Could try:
- Tighter step sizes in edges phase
- Separate edge-only ROI scoring

## Commands
```bash
npm run dev               # Dev server
npm run diff              # Capture + compare both modes
npm run tune -- --mode light   # Tune light preset
npm run tune -- --mode dark    # Tune dark preset

# Rebuild iOS app:
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild \
  -project ios-reference/GlassReference.xcodeproj \
  -scheme GlassReference -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -derivedDataPath ios-reference/build clean build
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun simctl install booted \
  ios-reference/build/Build/Products/Debug-iphonesimulator/GlassReference.app
```

## Key Files
- `demo/controls/presets.ts` — Apple Clear Light/Dark presets (TUNED)
- `pipeline/lib/tuner.ts` — Phased descent optimizer
- `pipeline/lib/scorer.ts` — Hybrid MSE scorer
- `pipeline/lib/config.ts` — crop, ROI, threshold
- `pipeline/tune.ts` — Tuner entry point
- `demo/App.tsx` — capture mode layout (70% panel, cornerRadius=24)
- `ios-reference/GlassReference/ContentView.swift` — capture mode (70% panel, RoundedRectangle)
- `engine/src/shaders/glass.wgsl.h` — WGSL shader

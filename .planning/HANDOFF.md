# Visual Parity Tuning — Handoff

**Date:** 2026-03-01
**Status:** Light mode 3.01%, Dark mode 14.90% (needs tuning), DPR fix applied

## Current Scores
- **Light: 3.01%** pixelmatch — strong match, diff only at glass circle edges
- **Dark: 14.90%** pixelmatch — real captures now working, preset needs tuning

## What Changed This Session

### 1. iOS Dark Mode Capture Fix
**Root cause:** `GlassReferenceApp.swift` hardcoded `@State var colorScheme = .light` with `.preferredColorScheme()`, overriding the system appearance set by `simctl`.

**Fix:**
- `GlassReferenceApp.swift`: Removed manual colorScheme override — app now follows system appearance
- `ContentView.swift`: Changed `@Binding var colorScheme` → `@Environment(\.colorScheme) var colorScheme`
- `capture-ios.ts`: Set appearance BEFORE launching app, terminate + relaunch between modes

### 2. Shader cornerRadius Clamping Fix
**Root cause:** Capture mode uses `cornerRadius={9999}` for circles. The SDF function `sdRoundedBox` produces invalid results when `r > min(b.x, b.y)`, causing the mask to be 0 everywhere (fully transparent — glass effect invisible).

**Fix:** `glass.wgsl.h` — clamp cornerRadius: `min(glass.cornerRadius * dpr, min(rectHalf.x, rectHalf.y))`

### 3. DPR (Device Pixel Ratio) Scaling Fix
**Root cause:** Shader operates in physical pixel space (canvas resolution includes DPR from ResizeObserver), but `cornerRadius`, `blurRadius`, and hardcoded rim/specular constants assumed 1x DPR. On Retina displays: blocky blur, tight corners, thin rim.

**Fix:**
- Added `dpr` field to `GlassUniforms` (repurposed `_pad7` at offset 108)
- C++ `BackgroundEngine::setDpr(float)` stores DPR, applied per-region in render loop
- Shader scales `cornerRadius * dpr`, `blurRadius * dpr`
- Shader normalizes dist for effects: `cssDist = dist / dpr` for rim and specular falloff
- JS calls `engine.setDpr(devicePixelRatio)` from ResizeObserver

### 4. StrictMode Engine Cleanup
Added `module.destroyEngine()` on cancelled init to stop orphaned rAF render loops.

## IMMEDIATE Next Steps

### 1. Tune Dark preset
The iOS dark `.glassEffect(.clear)` is surprisingly similar to light — very subtle. Current web "Clear Dark" preset is too aggressive (heavy blur, dark tint, strong env reflection).
```bash
npm run tune -- --mode dark
```

### 2. Verify DPR fix visually
The DPR fix was committed but needs manual testing on a Retina display. Check that glass effects look identical at 1x and 2x DPR (consistent blur width, corner radius, rim thickness).

### 3. Further light refinement (optional)
Light is at 3.01% — remaining diff at circle edges (rim highlights). Could tune further.

## Commands
```bash
npm run dev               # Dev server (demo mode)
npm run diff              # Capture + compare both modes
npm run tune -- --mode light   # Tune light preset
npm run tune -- --mode dark    # Tune dark preset
npm run build:wasm        # Rebuild C++ engine

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
- `engine/src/shaders/glass.wgsl.h` — WGSL shader (DPR scaling, SDF mask)
- `engine/src/background_engine.h` — GlassUniforms struct (dpr field at offset 108)
- `demo/controls/presets.ts` — Clear Light/Dark presets (TUNED light, dark needs work)
- `pipeline/lib/tuner.ts` — Phased descent optimizer
- `pipeline/lib/capture-ios.ts` — iOS capture with terminate+relaunch
- `ios-reference/GlassReference/ContentView.swift` — Follows system appearance
- `src/components/GlassProvider.tsx` — setDpr() call in ResizeObserver

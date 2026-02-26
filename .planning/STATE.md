---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Visual Parity
status: unknown
last_updated: "2026-02-26T22:17:36Z"
progress:
  total_phases: 14
  completed_phases: 13
  total_plans: 29
  completed_plans: 28
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-25)

**Core value:** Glass components that look and feel like Apple's Liquid Glass -- visually convincing refraction at 60FPS, now with pixel-level parity against native iOS rendering.
**Current focus:** Phase 14 in progress -- automated tuning loop scorer and tuner built

## Current Position

Phase: 14 of 14 (Automated Tuning Loop) -- IN PROGRESS
Plan: 1 of 2 in current phase (14-01 complete)
Milestone: v2.0 Visual Parity (Phases 9-14)
Status: Phase 14 Plan 01 complete -- scorer and tuner engine modules built
Last activity: 2026-02-26 -- Completed 14-01 Scorer & Tuner Engine

Progress: [██████████] 96% (v2.0)

## Performance Metrics

**Velocity:**
- Total plans completed: 16 (all v1.0)
- Average duration: ~3.0 min
- Total execution time: ~0.75 hours

**By Phase (v1.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-08 (v1.0) | 16 | ~65 min | ~4 min |

**v2.0 Plans:**

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 09 | P03 | 1min | 2 | 1 |
| 10 | P01 | 6min | 2 | 4 |
| 10 | P02 | 3min | 2 | 8 |
| 11 | P01 | 45min | 2 | 5 |
| 11 | P02 | 2min | 2 | 3 |
| 12 | P01 | 3min | 2 | 3 |
| 12 | P02 | 2min | 2 | 1 |
| 13 | P01 | 3min | 2 | 7 |
| 13 | P02 | 3min | 2 | 6 |
| 14 | P01 | 3min | 2 | 2 |

**Recent Trend:**
- Phase 14 Plan 01 complete (scorer + tuner engine modules)
- Trend: Stable

## Accumulated Context

### Decisions

All v1.0 decisions logged in PROJECT.md Key Decisions table.
v2.0 decisions:
- Image loading via JS decode + C++ upload (not C++ stb_image) -- confirmed by research
- Separate Xcode project for SwiftUI reference (not inside glass-react repo)
- leva for tuning UI, pixelmatch + pngjs for diff pipeline
- [09-01] Image is default BackgroundMode; falls back to noise until texture uploaded
- [09-01] Dawn C++ API uses TexelCopyTextureInfo/TexelCopyBufferLayout (not Web API names)
- [09-01] Embind free functions (not class methods) for uploadImageData/setBackgroundMode for uintptr_t support
- [09-02] HEAPU8 must be in EXPORTED_RUNTIME_METHODS for JS→WASM pixel transfer (not just EXPORTED_FUNCTIONS)
- [09-02] Wallpaper loaded via fetch + createImageBitmap(colorSpaceConversion:'none') + OffscreenCanvas for sRGB preservation
- [Phase 09]: Phase 9 success criteria updated: backgroundSrc prop deferred, criteria reflect bundled-wallpaper-only scope
- [10-01] Fresnel edge reflection is additive on top of existing specular, not a replacement
- [10-01] blurRadius uniform is in absolute pixels, JS computes from props
- [10-01] glareAngle has no clamping -- wraps naturally via cos/sin
- [10-02] glareDirection uses degrees in API, converted to radians in useGlassRegion
- [10-02] blurRadius (pixels) takes precedence over blur (normalized) when both set
- [10-02] No hover effects on new shader params -- physical material properties, not interaction feedback
- [10-02] Same defaults across dark/light mode for new params (physical properties)
- [11-02] sips fallback when exiftool unavailable -- both produce pixel-identical stripped PNGs
- [Scope] Tuning target narrowed to `.clear` variant only (light + dark mode). `.regular` variant remains available in reference app but is not a convergence target for Phases 12-14
- [11-02] Screenshots gitignored (large binary output), only .gitkeep tracked
- [11-02] In-app variant toggle is a documented limitation -- script captures current variant only
- [12-01] GlassParams re-exported from ControlPanel for backward compat with App.tsx imports
- [12-01] Flat JSON export format (no nesting, no metadata) per locked decision
- [12-01] All 16 GlassParams fields required -- tuning panel always holds concrete values
- [12-02] URL params parsed once on mount via lazy useState initializer -- no re-parsing on navigation
- [12-02] Human-verified complete tuning experience: sliders, resets, presets, import/export, URL params all functional
- [13-01] Chrome channel (not bundled Chromium) for WebGPU GPU support in Playwright
- [13-01] deviceScaleFactor=1 for 1:1 pixel mapping, no DPR scaling
- [13-01] morphSpeed=0 in capture mode for instant parameter application
- [13-01] backgroundMode always 'image' in capture mode to match iOS reference
- [13-02] ROI mask zeroes non-glass pixels to solid black on both images before pixelmatch comparison
- [13-02] Pipeline always exits 0 regardless of mismatch (report-only, no pass/fail gating)
- [13-02] Sequential capture (web then iOS) per mode to avoid resource contention
- [13-02] 3s settle time after iOS appearance change for rendering completion
- [14-01] 2s settle time for warm browser scorer (vs 3s cold start in capture-web)
- [14-01] Tint decomposed into 3 independent axes (tint_r, tint_g, tint_b) for coordinate descent
- [14-01] Scorer uses os.tmpdir() for intermediate capture/normalize/diff images
- [14-01] Step halving applied uniformly to all params when no improvement in a cycle

### Pending Todos

None.

### Blockers/Concerns

- iOS Simulator `.glassEffect()` dark-on-device bug (C6) -- use simulator only as reference
- Playwright WebGPU headless capture reliability -- validate early in Phase 13
- 5x5 Gaussian blur structural gap vs Apple multi-pass -- acknowledged, excluded from initial convergence target

## Session Continuity

Last session: 2026-02-26
Stopped at: Completed 14-01-PLAN.md -- scorer and tuner engine modules
Resume file: None

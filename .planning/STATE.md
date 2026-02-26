# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-25)

**Core value:** Glass components that look and feel like Apple's Liquid Glass -- visually convincing refraction at 60FPS, now with pixel-level parity against native iOS rendering.
**Current focus:** Phase 9 - Image Background Engine

## Current Position

Phase: 9 of 14 (Image Background Engine)
Plan: 2 of 2 in current phase (all complete)
Milestone: v2.0 Visual Parity (Phases 9-14)
Status: Executing — phase verification pending
Last activity: 2026-02-25 -- Completed 09-02 JS/React Image Integration

Progress: [██░░░░░░░░] 17% (v2.0)

## Performance Metrics

**Velocity:**
- Total plans completed: 16 (all v1.0)
- Average duration: ~3.0 min
- Total execution time: ~0.75 hours

**By Phase (v1.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-08 (v1.0) | 16 | ~65 min | ~4 min |

**Recent Trend:**
- v1.0 complete, starting fresh milestone
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

### Pending Todos

None.

### Blockers/Concerns

- iOS Simulator `.glassEffect()` dark-on-device bug (C6) -- use simulator only as reference
- Playwright WebGPU headless capture reliability -- validate early in Phase 13
- 5x5 Gaussian blur structural gap vs Apple multi-pass -- acknowledged, excluded from initial convergence target

## Session Continuity

Last session: 2026-02-25
Stopped at: Completed 09-02-PLAN.md — all plans in Phase 9 done, awaiting verification
Resume file: None

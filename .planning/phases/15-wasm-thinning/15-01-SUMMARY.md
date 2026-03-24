---
phase: 15-wasm-thinning
plan: "01"
subsystem: engine
tags: [wasm, webgpu, c++, emscripten, background-renderer]

# Dependency graph
requires: []
provides:
  - "Thinned BackgroundEngine: single-pass background renderer with no glass code"
  - "RGBA8Unorm offscreen texture via kOffscreenFormat constant"
  - "Call-driven architecture: renderBackground() replaces self-owned MainLoop"
  - "getSceneTextureHandleJS() Embind export for JS texture access"
affects: [16-glass-renderer, 17-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: ["kOffscreenFormat constant for explicit texture format", "call-driven WASM (no emscripten_set_main_loop)"]

key-files:
  created: []
  modified:
    - engine/src/background_engine.h
    - engine/src/background_engine.cpp
    - engine/src/main.cpp

key-decisions:
  - "RGBA8Unorm via kOffscreenFormat constant replaces surfaceFormat in all 3 pipeline sites"
  - "Dead glass.wgsl.h shader file left on disk (not included anywhere) — cleanup deferred"

patterns-established:
  - "kOffscreenFormat: single source of truth for offscreen texture format"
  - "Call-driven WASM: JS owns rAF loop, calls update()+renderBackground() per frame"

requirements-completed: [DEV-03, DEV-04, DEV-05]

# Metrics
duration: 3min
completed: 2026-03-24
---

# Phase 15 Plan 01: WASM Thinning Summary

**Deleted glass shader pass from C++ engine, removed surface ownership, fixed offscreen format to RGBA8Unorm, and eliminated emscripten_set_main_loop -- WASM binary shrunk 60% (1,539,156 to 609,855 bytes)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-24T20:58:39Z
- **Completed:** 2026-03-24T21:02:18Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Removed entire glass rendering pipeline from C++ (GlassUniforms, GlassRegion, 18 glass methods, createGlassPipeline, createGlassBindGroup, lerpUniforms)
- Replaced surfaceFormat with kOffscreenFormat (RGBA8Unorm) in all 3 pipeline creation sites (noise, image blit, offscreen texture)
- Deleted MainLoop(), OnDeviceAcquired(), OnAdapterAcquired(), standalone adapter/device creation
- Renamed render() to renderBackground(), getBackgroundTexture() to getSceneTexture()
- WASM binary reduced from 1,539,156 to 609,855 bytes (60% smaller)

## Task Commits

Each task was committed atomically:

1. **Task 1: Thin background_engine.h** - `c7baa1d` (feat)
2. **Task 2: Thin background_engine.cpp** - `6226d9b` (feat)
3. **Task 3: Thin main.cpp + WASM build** - `b9fc0a3` (feat)

## Files Created/Modified
- `engine/src/background_engine.h` - Thinned class declaration: no glass structs/methods, 3-param init, renderBackground(), getSceneTexture()
- `engine/src/background_engine.cpp` - Single-pass background renderer: kOffscreenFormat constant, no glass pass, no surface.Configure()
- `engine/src/main.cpp` - External-device-only init, no MainLoop, getSceneTextureHandleJS export, stripped Embind bindings

## Deletion Counts
- **Structs deleted:** 2 (GlassUniforms, GlassRegion) + 1 constant (MAX_GLASS_REGIONS)
- **Methods deleted:** 21 (addGlassRegion, removeGlassRegion, 15 setRegionXxx, setExternalBackgroundTexture, lerpUniforms, createGlassPipeline, createGlassBindGroup)
- **Functions deleted:** 3 (MainLoop, OnDeviceAcquired, OnAdapterAcquired)
- **Embind bindings deleted:** 19 (17 glass region methods + render renamed + setExternalBackgroundTexture + getBackgroundTextureHandle renamed)
- **Private members deleted:** 10 (surface, surfaceFormat, glassSampler, glassShaderModule, glassPipeline, glassBindGroupLayout, glassBindGroup, glassUniformBuffer, regions[], uniformStride, externalBgTexture_, externalBgTextureView_)
- **Net lines removed:** ~637 lines deleted across 3 files

## New API Surface
- `init(wgpu::Device dev, uint32_t w, uint32_t h)` -- 3-param (was 5-param with surface + format)
- `renderBackground()` -- single-pass background render (was `render()` with 2-pass)
- `getSceneTexture()` -- returns offscreen RGBA8Unorm texture (was `getBackgroundTexture()`)
- `getSceneTextureHandle` -- Embind export (was `getBackgroundTextureHandle`)

## Decisions Made
- Used kOffscreenFormat constant (RGBA8Unorm) instead of hardcoding format in each site -- single source of truth
- Left glass.wgsl.h shader file on disk since it is no longer included; can be cleaned up in a later phase

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- BackgroundEngine is now a call-driven single-pass background renderer
- JS can call renderBackground() per frame and read the result via getSceneTextureHandle
- Phase 16 (GlassRenderer in JS) can consume the offscreen texture for glass compositing
- Phase 17 (Integration) can wire up the JS rAF loop calling update() + renderBackground()

---
*Phase: 15-wasm-thinning*
*Completed: 2026-03-24*

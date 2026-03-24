---
phase: 15-wasm-thinning
plan: "02"
subsystem: ui
tags: [webgpu, wasm, react, typescript, emscripten]

requires:
  - phase: 15-wasm-thinning plan 01
    provides: Thinned C++ engine with renderBackground(), getSceneTextureHandle(), initWithExternalDevice()
provides:
  - Always-external initEngine(device) in loader.ts
  - getSceneTexture() helper for reading scene texture from WASM
  - JS-owned GPUDevice lifecycle in GlassProvider
  - JS requestAnimationFrame render loop calling renderBackground()
  - Stubbed registerRegion() returning null (Phase 17 TODO)
affects: [16-glass-renderer, 17-integration]

tech-stack:
  added: []
  patterns:
    - "JS creates GPUDevice, passes handle to C++ via emdawnwebgpu"
    - "JS requestAnimationFrame loop drives engine.update() + engine.renderBackground()"
    - "Region registration stubbed to null, preserving GlassContext API"

key-files:
  created: []
  modified:
    - src/wasm/loader.ts
    - src/components/GlassProvider.tsx

key-decisions:
  - "Kept importJsTexture in WebGPU type for Phase 17 reuse"
  - "Removed observerRef region ResizeObserver since registerRegion returns null"
  - "Simplified unregisterRegion to just delete from map (no observer to unobserve)"

patterns-established:
  - "Always-external device: initEngine() requires GPUDevice, no optional path"
  - "JS rAF loop: GlassProvider owns the render loop, not C++ emscripten_set_main_loop"

requirements-completed: [DEV-01, DEV-02, DEV-04, DEV-05]

duration: 2min
completed: 2026-03-24
---

# Phase 15 Plan 02: TypeScript Layer Update Summary

**Always-external initEngine(device), JS-owned GPUDevice creation, and JS rAF loop calling renderBackground()**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-24T20:58:39Z
- **Completed:** 2026-03-24T21:00:46Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Rewrote loader.ts to always-external device mode -- initEngine() requires GPUDevice, no conditional paths
- GlassProvider creates its own GPUDevice via navigator.gpu before engine init
- JS requestAnimationFrame loop drives engine.update(dt) + engine.renderBackground()
- Region calls stubbed with TODO Phase 17 comments -- app compiles without glass overlay
- TypeScript compiles cleanly with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite loader.ts** - `a38e5a3` (feat)
2. **Task 2: Update GlassProvider** - `95f81f9` (feat)

## Files Created/Modified
- `src/wasm/loader.ts` - Always-external initEngine(device), updated EngineModule interface, getSceneTexture() helper
- `src/components/GlassProvider.tsx` - JS GPUDevice creation, JS rAF loop, stubbed regions, simplified effects

## Interface Changes

### Removed from EngineModule
- `EngineInitOptions` interface (deleted entirely)
- `getEngine().addGlassRegion()`, `removeGlassRegion()`, all `setRegionXxx()` methods
- `getEngine().render()` (replaced by `renderBackground()`)
- `setExternalDeviceMode()` (no longer needed -- always external)
- `getBackgroundTextureHandle()` (replaced by `getSceneTextureHandle()`)
- `setExternalBackgroundTexture()` (removed with glass pass)

### Added to EngineModule
- `getEngine().renderBackground()` -- renders background pass only
- `getSceneTextureHandle()` -- returns emdawnwebgpu handle to scene texture
- `getSceneTexture()` -- exported helper that resolves handle to GPUTexture

### GlassProvider Changes
- Removed `device` and `externalTexture` props
- Added JS GPUDevice creation in init useEffect
- Added JS rAF render loop useEffect
- `registerRegion()` returns null (stubbed for Phase 17)

## Decisions Made
- Kept `importJsTexture` in WebGPU type definition for Phase 17 reuse
- Removed the region ResizeObserver since registerRegion returns null -- no regions to observe
- Simplified unregisterRegion to just map deletion (no observer cleanup needed)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- loader.ts and GlassProvider.tsx fully aligned to thinned C++ API
- Phase 16 (GlassRenderer) can proceed -- getSceneTexture() is ready for consumption
- Phase 17 (Integration) will wire registerRegion() to JS GlassRenderer

---
*Phase: 15-wasm-thinning*
*Completed: 2026-03-24*

## Self-Check: PASSED

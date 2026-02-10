---
phase: 02-background-rendering
plan: 01
subsystem: engine
tags: [webgpu, wgsl, simplex-noise, fbm, embind, wasm, render-pipeline]

# Dependency graph
requires:
  - phase: 01-engine-foundation
    provides: "C++ WebGPU engine with Emscripten build, device init, surface creation"
provides:
  - "BackgroundEngine C++ class with noise render pipeline"
  - "WGSL simplex noise + fBM shader as inline C++ string"
  - "Embind bindings: getEngine() and BackgroundEngine::resize()"
  - "Uniform buffer for time + resolution per-frame updates"
affects: [02-background-rendering/plan-02, 03-react-bridge]

# Tech tracking
tech-stack:
  added: [embind-class-binding, wgsl-simplex-noise]
  patterns: [fullscreen-triangle, explicit-bind-group-layout, uniform-buffer-per-frame, delta-time-via-emscripten_get_now]

key-files:
  created:
    - engine/src/shaders/noise.wgsl.h
    - engine/src/background_engine.h
    - engine/src/background_engine.cpp
  modified:
    - engine/src/main.cpp
    - engine/CMakeLists.txt

key-decisions:
  - "Render directly to surface for Phase 2 (defer offscreen texture to Phase 3)"
  - "Use explicit BindGroupLayout instead of auto layout for future extensibility"
  - "Query surface capabilities for format instead of hardcoding BGRA8Unorm"
  - "Store adapter globally for surface capabilities query in OnDeviceAcquired"

patterns-established:
  - "BackgroundEngine class pattern: init/update/render/resize lifecycle"
  - "WGSL shader as C++ raw string literal in header file"
  - "Embind pointer exposure via getEngine() free function"
  - "Delta time via emscripten_get_now() with 0.1s cap"

# Metrics
duration: 4min
completed: 2026-02-10
---

# Phase 2 Plan 01: BackgroundEngine with Simplex Noise Shader Summary

**BackgroundEngine C++ class with simplex fBM noise shader, WebGPU render pipeline, uniform buffer, and Embind exposure for resize**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-10T19:29:52Z
- **Completed:** 2026-02-10T19:33:38Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created WGSL simplex noise shader with 6-octave fBM, fullscreen triangle rendering, and blue/teal color ramp
- Implemented BackgroundEngine class with full WebGPU render pipeline lifecycle (init, update, render, resize)
- Exposed engine to JavaScript via Embind (getEngine() + resize()) for Plan 02 canvas integration
- Clean WASM build (828KB) with zero warnings or deprecated API usage

## Task Commits

Each task was committed atomically:

1. **Task 1: Create WGSL noise shader and BackgroundEngine C++ class** - `9960505` (feat)
2. **Task 2: Update main.cpp with Embind bindings and CMakeLists** - `e66d096` (feat)

## Files Created/Modified
- `engine/src/shaders/noise.wgsl.h` - WGSL simplex noise + fBM shader as C++ raw string literal
- `engine/src/background_engine.h` - BackgroundEngine class declaration with Uniforms struct
- `engine/src/background_engine.cpp` - Full implementation: pipeline, uniforms, render pass, resize
- `engine/src/main.cpp` - Rewritten to use BackgroundEngine with Embind bindings
- `engine/CMakeLists.txt` - Added background_engine.cpp to sources

## Decisions Made
- **Direct surface rendering:** Render noise directly to surface for Phase 2, deferring offscreen texture to Phase 3. Keeps Phase 2 focused and testable.
- **Explicit BindGroupLayout:** Used explicit layout instead of auto for reliability and Phase 3 compatibility.
- **Global adapter storage:** Stored wgpu::Adapter globally to query surface capabilities for correct format (avoids hardcoding BGRA8Unorm).
- **getEngine() pattern:** Expose a free function returning pointer rather than Embind constructor, since engine lifecycle is managed by C++ main loop.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed taking address of temporary CommandBuffer**
- **Found during:** Task 2 (build verification)
- **Issue:** `&encoder.Finish()` takes address of a temporary, which is undefined behavior (Clang error)
- **Fix:** Store `encoder.Finish()` result in `wgpu::CommandBuffer commands` variable before passing address
- **Files modified:** engine/src/background_engine.cpp
- **Verification:** Build succeeds with zero errors
- **Committed in:** e66d096 (Task 2 commit)

**2. [Rule 1 - Bug] Query surface capabilities instead of hardcoding format**
- **Found during:** Task 2 (code review)
- **Issue:** Plan suggested using capabilities/format but initial code hardcoded BGRA8Unorm; adapter not available in OnDeviceAcquired
- **Fix:** Store adapter as global `g_adapter`, use `surface.GetCapabilities()` to get correct format
- **Files modified:** engine/src/main.cpp
- **Verification:** Build succeeds, matches Phase 1 capabilities query pattern
- **Committed in:** e66d096 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bug fixes)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- BackgroundEngine class is ready for Plan 02 (JS integration with ResizeObserver and canvas management)
- Embind bindings expose getEngine() and resize() for JavaScript consumption
- Surface format is properly queried from capabilities (not hardcoded)
- Phase 3 can add offscreen texture rendering by modifying the render target in BackgroundEngine

## Self-Check: PASSED

All 6 files verified present. Both task commits (9960505, e66d096) verified in git log.

---
*Phase: 02-background-rendering*
*Completed: 2026-02-10*

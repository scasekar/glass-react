---
phase: 10-shader-parameter-exposure
plan: 01
subsystem: engine
tags: [webgpu, wgsl, wasm, embind, fresnel, shader-uniforms, cpp]

# Dependency graph
requires:
  - phase: 09-image-background-engine
    provides: "Working WASM engine with glass rendering pipeline and Embind bindings"
provides:
  - "7 new shader uniform parameters (contrast, saturation, fresnelIOR, fresnelExponent, envReflectionStrength, glareAngle, blurRadius)"
  - "Physics-based Fresnel edge reflection model in WGSL shader"
  - "112-byte GlassUniforms struct (C++ and WGSL aligned)"
  - "7 Embind-registered setter methods callable from JavaScript"
  - "Silent value clamping on all new setters"
  - "Smooth morphing (lerpUniforms) for all new parameters"
affects: [10-02-typescript-react-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns: [uniform-driven-shader-params, fresnel-specular-model, silent-value-clamping]

key-files:
  created: []
  modified:
    - engine/src/background_engine.h
    - engine/src/background_engine.cpp
    - engine/src/shaders/glass.wgsl.h
    - engine/src/main.cpp

key-decisions:
  - "Fresnel edge reflection is additive on top of existing specular, not a replacement -- gives independent control"
  - "blurRadius uniform is in pixels (not normalized), JS layer computes from props"
  - "glareAngle has no clamping -- any radian value wraps naturally via cos/sin"

patterns-established:
  - "Silent clamping pattern: setters clamp values to valid ranges without error"
  - "Uniform-driven shader: all tunable values read from uniform buffer, no hardcoded constants"

requirements-completed: [SHDR-01, SHDR-02, SHDR-03, SHDR-04, SHDR-05]

# Metrics
duration: 6min
completed: 2026-02-25
---

# Phase 10 Plan 01: C++ Engine Parameter Exposure Summary

**7 new shader uniform parameters with physics-based Fresnel model, silent clamping, smooth morphing, and Embind JS bindings**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-26T02:33:26Z
- **Completed:** 2026-02-26T02:39:55Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extended GlassUniforms from 80 to 112 bytes with 7 new float parameters (contrast, saturation, fresnelIOR, fresnelExponent, envReflectionStrength, glareAngle, blurRadius)
- Replaced all hardcoded shader values (1.4 saturation, 0.85 contrast, vec2f(-0.707,-0.707) glare direction, blurIntensity*30 blur radius) with uniform reads
- Added physics-based Fresnel edge reflection model as an additive specular layer
- Implemented 7 C++ setter methods with silent value clamping and registered all via Embind
- Extended lerpUniforms for smooth morphing and addGlassRegion with Apple-calibrated defaults

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend GlassUniforms struct, C++ setters, lerpUniforms, and defaults** - `5cd8276` (feat)
2. **Task 2: Update WGSL shader, add Embind bindings, and rebuild WASM** - `e5df358` (feat)

## Files Created/Modified
- `engine/src/background_engine.h` - Extended GlassUniforms struct (112 bytes) + 7 new setter declarations
- `engine/src/background_engine.cpp` - 7 setter implementations with std::clamp + lerpUniforms extension + addGlassRegion defaults
- `engine/src/shaders/glass.wgsl.h` - Extended WGSL struct + uniform-driven shader logic + Fresnel edge reflection
- `engine/src/main.cpp` - 7 new Embind bindings for JS access

## Decisions Made
- Fresnel edge reflection is additive on top of existing coolSpec/warmSpec specular, not a replacement -- users get independent control of directional specular (via specular prop) vs edge-based Fresnel (via fresnelIOR/fresnelExponent/envReflectionStrength)
- blurRadius uniform is in absolute pixels (not the 0-1 normalized blurIntensity), JS layer will compute: blurRadius = props.blurRadius ?? (props.blur ?? 0.5) * 30
- glareAngle has no clamping because any radian value wraps naturally through cos/sin

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- WASM build cache required --clean-first to pick up header changes (cmake incremental build didn't detect struct layout change through header dependency). Resolved by forcing clean rebuild.
- Embind binding names are embedded in base64-encoded WASM binary within engine.js, not as plaintext strings -- verification adapted to decode WASM blob.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 7 setter methods are Embind-registered and callable from JavaScript
- Ready for Plan 02: TypeScript/React wiring of new parameters to component props
- WASM binary is rebuilt and functional

---
## Self-Check: PASSED

All files verified present, all commit hashes found in git log.

---
*Phase: 10-shader-parameter-exposure*
*Completed: 2026-02-25*

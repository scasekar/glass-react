---
phase: 10-shader-parameter-exposure
plan: 02
subsystem: ui
tags: [react, typescript, webgpu, shader-props, accessibility, glass-components]

# Dependency graph
requires:
  - phase: 10-shader-parameter-exposure
    plan: 01
    provides: "7 Embind-registered C++ setter methods for shader parameters"
provides:
  - "Fully typed React prop API for 7 new shader parameters (contrast, saturation, blurRadius, fresnelIOR, fresnelExponent, envReflectionStrength, glareDirection)"
  - "Complete wiring chain: GlassStyleProps -> components -> useGlassRegion -> GlassRegionHandle -> GlassProvider -> engine"
  - "Apple-calibrated defaults for all 7 parameters"
  - "Reduced-transparency accessibility mode with neutral values for all new parameters"
  - "Degree-to-radian conversion for glareDirection at the hook level"
  - "blurRadius (pixels) overrides blur (normalized) when both set"
affects: [11-visual-tuning, 12-demo-app, 13-pixel-parity]

# Tech tracking
tech-stack:
  added: []
  patterns: [flat-shader-props, degree-api-radian-engine, blur-override-precedence]

key-files:
  created: []
  modified:
    - src/wasm/loader.ts
    - src/context/GlassContext.ts
    - src/components/types.ts
    - src/hooks/useGlassRegion.ts
    - src/components/GlassProvider.tsx
    - src/components/GlassPanel.tsx
    - src/components/GlassButton.tsx
    - src/components/GlassCard.tsx

key-decisions:
  - "glareDirection uses degrees in the API, converted to radians inside useGlassRegion (developer-friendly API, shader-friendly engine)"
  - "blurRadius (pixels) takes precedence over blur (normalized) when both set; falls back to blur * 30"
  - "No hover effects on new shader params -- they are physical material properties, not interaction feedback"
  - "Same defaults across dark/light mode for new params (physical properties, not theme-dependent)"
  - "Added missing morphSpeed forwarding to GlassPanel and GlassCard (Rule 1 auto-fix)"

patterns-established:
  - "Flat prop pattern: all shader params are flat optional props on GlassStyleProps (not grouped object)"
  - "Default cascade: useGlassRegion provides Apple-calibrated defaults via ?? operator for all unset props"
  - "Accessibility neutralization: reduced-transparency mode sets all visual effect params to neutral (1.0 for multipliers, 0 for additive)"

requirements-completed: [SHDR-01, SHDR-02, SHDR-03, SHDR-04, SHDR-05]

# Metrics
duration: 3min
completed: 2026-02-25
---

# Phase 10 Plan 02: TypeScript/React Wiring Summary

**7 new shader props (contrast, saturation, blurRadius, fresnelIOR, fresnelExponent, envReflectionStrength, glareDirection) wired from React API through full engine pipeline with JSDoc, Apple defaults, and a11y support**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-26T02:44:23Z
- **Completed:** 2026-02-26T02:46:57Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Extended EngineModule, GlassRegionHandle, and GlassStyleProps interfaces with 7 new shader parameter types and comprehensive JSDoc documentation
- Wired complete prop pipeline: React components destructure and forward props -> useGlassRegion applies defaults and converts units -> GlassProvider bridges to engine setters
- Added reduced-transparency accessibility mode that neutralizes all 7 new visual effects (multipliers to 1.0, additive to 0)
- All three glass components (GlassPanel, GlassButton, GlassCard) expose identical shader prop sets

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend TypeScript interfaces and types for 7 new shader parameters** - `f7ddb93` (feat)
2. **Task 2: Wire new props through useGlassRegion, GlassProvider, and all glass components** - `7ea11a3` (feat)

## Files Created/Modified
- `src/wasm/loader.ts` - Added 7 setter methods to EngineModule getEngine() return type
- `src/context/GlassContext.ts` - Added 7 update methods to GlassRegionHandle interface
- `src/components/types.ts` - Added 7 JSDoc-documented optional props to GlassStyleProps
- `src/hooks/useGlassRegion.ts` - Props-to-engine sync with defaults, degree-to-radian conversion, blurRadius precedence, a11y neutralization
- `src/components/GlassProvider.tsx` - 7 new handle-to-engine wiring methods in registerRegion
- `src/components/GlassPanel.tsx` - Destructure and forward 7 new props + morphSpeed (was missing)
- `src/components/GlassButton.tsx` - Destructure and forward 7 new props (no hover effects on material props)
- `src/components/GlassCard.tsx` - Destructure and forward 7 new props + morphSpeed (was missing)

## Decisions Made
- glareDirection uses degrees in the API (developer-friendly: 0=right, 90=down, 315=upper-left) but converts to radians in useGlassRegion before calling the engine (which expects radians for cos/sin)
- blurRadius (absolute pixels) takes precedence over blur (normalized 0-1); when blurRadius is unset, falls back to `blur * 30` matching the previous hardcoded behavior
- New shader params have no hover/active effects in GlassButton -- they are physical material properties (IOR, contrast, saturation), not interaction feedback like specular/rim/aberration
- Same default values in dark and light mode for all 7 new params -- they describe physical glass properties, not theme-dependent appearance

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added missing morphSpeed forwarding to GlassPanel and GlassCard**
- **Found during:** Task 2 (component wiring)
- **Issue:** GlassPanel and GlassCard did not destructure or forward `morphSpeed` to `useGlassRegion`, so the prop was silently ignored on those components despite being defined on GlassStyleProps
- **Fix:** Added `morphSpeed` to destructuring and useGlassRegion call in both GlassPanel and GlassCard (GlassButton already had it)
- **Files modified:** src/components/GlassPanel.tsx, src/components/GlassCard.tsx
- **Committed in:** `7ea11a3` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary correctness fix discovered during prop forwarding audit. No scope creep.

## Issues Encountered
None - all changes compiled cleanly with zero new TypeScript errors.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 7 shader parameters are now fully exposed as React props with complete type safety
- Developers can set `contrast`, `saturation`, `blurRadius`, `fresnelIOR`, `fresnelExponent`, `envReflectionStrength`, `glareDirection` on any glass component
- Ready for Phase 11: visual tuning and demo app integration
- Phase 10 complete (both Plan 01 engine layer and Plan 02 React wiring)

---
## Self-Check: PASSED

All 8 modified files verified present on disk. Both commit hashes (f7ddb93, 7ea11a3) found in git log.

---
*Phase: 10-shader-parameter-exposure*
*Completed: 2026-02-25*

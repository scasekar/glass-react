---
phase: 12-live-tuning-ui
plan: 01
subsystem: ui
tags: [react, controls, presets, import-export, json, tuning-ui]

# Dependency graph
requires:
  - phase: 10-shader-refinement
    provides: 7 new GlassStyleProps parameters (refraction, contrast, saturation, blurRadius, fresnelIOR, fresnelExponent, envReflectionStrength, glareDirection)
provides:
  - GlassParams interface with all 16 required tunable fields
  - DEFAULTS constant with canonical default values
  - PRESETS map with Apple Clear Light and Apple Clear Dark configurations
  - SECTION_KEYS map grouping parameters into 6 UI sections
  - validateParams, exportParams, importParams utility functions
  - Full tuning ControlPanel with section resets, global reset, preset buttons, import/export
affects: [12-live-tuning-ui, 13-diff-pipeline, 14-convergence-tuning]

# Tech tracking
tech-stack:
  added: []
  patterns: [data-module-separation, section-grouped-controls, flat-json-export]

key-files:
  created:
    - demo/controls/presets.ts
  modified:
    - demo/controls/ControlPanel.tsx
    - demo/App.tsx

key-decisions:
  - "GlassParams re-exported from ControlPanel for backward compatibility with App.tsx imports"
  - "Flat JSON export format with no nesting or metadata wrapper (per locked decision)"
  - "All 16 parameters are required in GlassParams -- tuning panel always holds concrete values"

patterns-established:
  - "Data module separation: presets.ts holds interface, defaults, presets, validation, IO; ControlPanel.tsx is pure rendering"
  - "Section-grouped controls with per-section reset using SECTION_KEYS map"
  - "Toolbar pattern: presets row + actions row + divider + sections"

requirements-completed: [TUNE-01, TUNE-02, TUNE-03, TUNE-04]

# Metrics
duration: 3min
completed: 2026-02-26
---

# Phase 12 Plan 01: Presets & Control Panel Summary

**Full 16-parameter tuning UI with presets data layer, section-grouped sliders, per-section/global reset, Apple Clear Light/Dark presets, and flat JSON import/export**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-26T20:39:22Z
- **Completed:** 2026-02-26T20:42:43Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created `presets.ts` data module with GlassParams (16 fields), DEFAULTS, 2 PRESETS, SECTION_KEYS, validateParams, exportParams, importParams
- Extended ControlPanel to render all 16 shader parameters in 6 grouped sections with per-section reset, global reset, preset buttons, and import/export controls
- Updated App.tsx to use DEFAULTS and pass all Phase 10 parameters through to glass components

## Task Commits

Each task was committed atomically:

1. **Task 1: Create presets.ts data module** - `4fb9621` (feat)
2. **Task 2: Extend ControlPanel with all parameters, resets, presets, and import/export** - `f2642cb` (feat)

## Files Created/Modified
- `demo/controls/presets.ts` - Data layer: GlassParams interface, DEFAULTS, PRESETS map, SECTION_KEYS, validateParams, exportParams, importParams
- `demo/controls/ControlPanel.tsx` - Full tuning UI: 6 sections, 16 parameters, section/global reset, preset buttons, import/export
- `demo/App.tsx` - Uses DEFAULTS from presets, passes all 16 params to glass components

## Decisions Made
- GlassParams re-exported from ControlPanel.tsx via `export type { GlassParams } from './presets'` for backward compatibility with existing `import { type GlassParams } from './controls/ControlPanel'` in App.tsx
- Flat JSON export format (no nesting, no metadata wrapper) per user's locked decision
- All 16 fields are required in GlassParams -- the tuning panel always holds concrete values, unlike the optional GlassStyleProps interface

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated App.tsx to use DEFAULTS and pass all Phase 10 params**
- **Found during:** Task 2 (ControlPanel rewrite)
- **Issue:** App.tsx had a local 9-field `defaults` object typed as `GlassParams`. With GlassParams now requiring 16 fields, App.tsx would fail to compile. Also, App.tsx was not passing the 7 new Phase 10 parameters to glass components, meaning slider changes for those params would have no visible effect.
- **Fix:** Replaced local defaults with `import { DEFAULTS } from './controls/presets'` and added all 7 new props (refraction, contrast, saturation, blurRadius, fresnelIOR, fresnelExponent, envReflectionStrength, glareDirection) to GlassPanel, GlassButton, and GlassCard component invocations.
- **Files modified:** demo/App.tsx
- **Verification:** TypeScript --noEmit passes with zero demo/ errors
- **Committed in:** f2642cb (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix necessary -- without it, the demo would not compile. No scope creep.

## Issues Encountered
None -- both tasks executed cleanly. Pre-existing TypeScript errors in `src/` (wallpaper asset import, WebGPU navigator types) are unrelated and existed before this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 16 shader parameters are now controllable via the tuning panel
- Presets data layer provides the foundation for Plan 02 (live binding to C++ engine)
- Import/export enables saving/loading tuning configurations for Phase 14 convergence work

## Self-Check: PASSED

- All 3 source files exist (presets.ts, ControlPanel.tsx, App.tsx)
- SUMMARY.md exists at expected path
- Commit 4fb9621 (Task 1) found in git log
- Commit f2642cb (Task 2) found in git log

---
*Phase: 12-live-tuning-ui*
*Completed: 2026-02-26*

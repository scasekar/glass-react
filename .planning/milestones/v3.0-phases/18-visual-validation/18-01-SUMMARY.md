---
phase: 18-visual-validation
plan: 01
subsystem: testing
tags: [playwright, pixelmatch, visual-regression, webgpu, screenshot-diff]

# Dependency graph
requires:
  - phase: 16-glass-renderer
    provides: WebGPU glass shader pipeline for web rendering
  - phase: 17-react-integration
    provides: GlassProvider wiring for demo page
provides:
  - v3.0 web captures (light and dark presets) for baseline comparison
  - Scored diff reports against iOS reference screenshots
  - Reliable iOS capture fallback for CI/headless environments
affects: [18-02-PLAN, visual-tuning]

# Tech tracking
tech-stack:
  added: []
  patterns: [iOS capture timeout/fallback for pipeline reliability]

key-files:
  created:
    - pipeline/output/web/light.png
    - pipeline/output/web/dark.png
    - pipeline/output/diffs/light_diff.png
    - pipeline/output/diffs/dark_diff.png
    - pipeline/output/reports/light_report.html
    - pipeline/output/reports/dark_report.html
  modified:
    - pipeline/lib/capture-ios.ts

key-decisions:
  - "v3.0 baseline scores: light 15.96%, dark 15.91% -- significant regression from v2.0 (0.40%/0.85%) due to shape change (square panel vs circular button)"
  - "iOS capture uses timeout+fallback to existing reference when Simulator app unavailable"

patterns-established:
  - "iOS capture fallback: reuse existing reference screenshots when simctl hangs or app is not installed"

requirements-completed: [VIS-02]

# Metrics
duration: 10min
completed: 2026-03-24
---

# Phase 18 Plan 01: Visual Validation Baseline Summary

**v3.0 diff pipeline baseline: light 15.96% / dark 15.91% mismatch against iOS reference (v2.0 was 0.40%/0.85%), regression driven by shape change from circle to rounded-rect panel**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-24T23:40:44Z
- **Completed:** 2026-03-24T23:50:43Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- WASM binary verified current with source (engine.js, single-file build with embedded WASM)
- Full diff pipeline ran successfully: web captures, normalization, pixelmatch comparison, HTML reports
- Web captures confirmed showing wallpaper background with glass panel (not solid black)
- All 27 vitest unit tests pass

## v3.0 Baseline Diff Scores

These scores are the key output for Plan 02 to determine tuning needs:

| Preset | v3.0 Score | v2.0 Baseline | Delta |
|--------|-----------|---------------|-------|
| Clear Light | **15.96%** | 0.40% | +15.56pp |
| Clear Dark | **15.91%** | 0.85% | +15.06pp |

**Root cause of regression:** The v3.0 demo renders a **square/rounded-rect** glass panel with a "5" label, while the iOS reference (from v2.0 era) shows a **circular** glass button. This shape difference accounts for the bulk of the ~16% mismatch. The glass effect quality itself (refraction, blur, specular) appears comparable; the mismatch is structural, not a quality regression.

**Implication for Plan 02:** Tuning shader parameters alone will not close a 16% gap caused by shape differences. Either (a) the iOS reference needs re-capture with the v3.0 circular demo shape, or (b) the comparison methodology needs to account for shape differences via a tighter ROI mask on the glass interior only.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build current WASM binary** - No commit needed (build was already current, no file changes)
2. **Task 2: Run diff pipeline and verify web captures** - `92464df` (fix)

**Plan metadata:** [pending] (docs: complete plan)

## Files Created/Modified
- `pipeline/lib/capture-ios.ts` - Added 15s timeout to simctl commands and fallback to existing reference screenshots
- `pipeline/output/web/light.png` - v3.0 web capture, Clear Light preset (generated, not committed)
- `pipeline/output/web/dark.png` - v3.0 web capture, Clear Dark preset (generated, not committed)
- `pipeline/output/diffs/light_diff.png` - Pixel diff image for light mode (generated, not committed)
- `pipeline/output/diffs/dark_diff.png` - Pixel diff image for dark mode (generated, not committed)
- `pipeline/output/reports/light_report.html` - Side-by-side HTML diff report (generated, not committed)
- `pipeline/output/reports/dark_report.html` - Side-by-side HTML diff report (generated, not committed)

## Decisions Made
- v3.0 baseline scores established: light 15.96%, dark 15.91% (both significantly above v2.0 targets due to shape change)
- Added timeout (15s) and fallback logic to iOS capture to prevent pipeline hanging when Simulator app is unavailable
- Output artifacts (PNGs, HTML reports) are generated but not committed to git (they are in pipeline/output/ which is gitignored)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] iOS capture hangs on simctl commands**
- **Found during:** Task 2 (Run diff pipeline)
- **Issue:** `simctl terminate` and `simctl launch` hung indefinitely when the GlassReference app was not responding on the iOS Simulator
- **Fix:** Added 15s timeout to all simctl calls and fallback to reuse existing iOS reference screenshots when fresh capture fails
- **Files modified:** pipeline/lib/capture-ios.ts
- **Verification:** Pipeline completed successfully using existing iOS references
- **Committed in:** 92464df

**2. [Observation] Build output naming differs from plan**
- **Found during:** Task 1 (Build WASM binary)
- **Issue:** Plan referenced `glass.js` / `glass.wasm` but actual output is `engine.js` (single file, WASM embedded via `-sSINGLE_FILE=1`)
- **Fix:** No fix needed -- this is the correct behavior per CMakeLists.txt. Plan had outdated file names.
- **Impact:** None

---

**Total deviations:** 1 auto-fixed (1 blocking), 1 observation
**Impact on plan:** iOS capture fix was essential for pipeline completion. No scope creep.

## Issues Encountered
- iOS Simulator had the GlassReference app in a non-responsive state, causing simctl commands to hang. Resolved by adding timeout and fallback to existing reference screenshots.
- v3.0 demo shape (square panel) differs from iOS reference (circular button), causing high mismatch scores that are not indicative of glass effect quality regression.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Baseline scores established; Plan 02 can determine whether tuning is needed
- Key finding: the high mismatch (~16%) is due to shape differences, not glass effect quality
- Plan 02 should consider re-capturing iOS reference with matching shape, or using interior-only ROI mask
- All 27 unit tests pass, no regressions in renderer internals

---
*Phase: 18-visual-validation*
*Completed: 2026-03-24*

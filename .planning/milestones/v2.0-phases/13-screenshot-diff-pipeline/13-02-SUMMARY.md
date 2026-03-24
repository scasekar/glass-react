---
phase: 13-screenshot-diff-pipeline
plan: 02
subsystem: testing
tags: [pixelmatch, pngjs, sharp, ios-simulator, srgb, screenshot-diff, html-report, pipeline]

# Dependency graph
requires:
  - phase: 13-screenshot-diff-pipeline
    plan: 01
    provides: "Pipeline config, Playwright web capture, dev server lifecycle"
provides:
  - "iOS Simulator screenshot capture with crop (captureIOS)"
  - "sRGB normalization to 800x800 (normalize)"
  - "pixelmatch comparison with ROI mask (compare, CompareResult)"
  - "Self-contained HTML diff report generation (generateReport)"
  - "Unified pipeline entry point (pipeline/diff.ts)"
  - "npm run diff one-command pipeline invocation"
affects: [14-convergence-tuning, screenshot-diff-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [ios-simulator-capture, srgb-normalization, roi-mask-diffing, html-report-generation, unified-pipeline-orchestration]

key-files:
  created:
    - pipeline/lib/capture-ios.ts
    - pipeline/lib/normalize.ts
    - pipeline/lib/compare.ts
    - pipeline/lib/report.ts
    - pipeline/diff.ts
  modified:
    - package.json

key-decisions:
  - "ROI mask zeroes non-glass pixels to solid black on both images before pixelmatch comparison"
  - "Pipeline always exits 0 regardless of mismatch (report-only, no pass/fail gating)"
  - "Sequential capture (web then iOS) per mode to avoid resource contention"
  - "3s settle time after iOS appearance change for rendering completion"

patterns-established:
  - "iOS capture pattern: boot sim, launch app by bundle ID, override status bar, set appearance, wait, capture, crop"
  - "Normalization pattern: sRGB + exact resize + alpha strip before any comparison"
  - "Report pattern: self-contained HTML with base64-embedded images and color-coded mismatch indicator"
  - "Pipeline orchestration: sequential per-mode loop (capture -> normalize -> diff -> report)"

requirements-completed: [DIFF-01, DIFF-02, DIFF-03, DIFF-04]

# Metrics
duration: 3min
completed: 2026-02-26
---

# Phase 13 Plan 02: iOS Capture, Diff Pipeline & Report Summary

**iOS Simulator capture with sRGB normalization, pixelmatch diffing with ROI mask, HTML report generation, and unified npm run diff entry point**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-26T21:50:02Z
- **Completed:** 2026-02-26T21:53:22Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- iOS Simulator capture module: boots sim, launches app by bundle ID, overrides status bar, sets appearance mode, captures and crops to glass panel region
- sRGB normalization: converts any input to sRGB color space at 800x800 with no alpha channel for consistent pixelmatch comparison
- pixelmatch comparison with ROI mask: zeroes non-glass pixels to black, produces diff PNG with red/green mismatch indicators, returns structured CompareResult (count, total, percentage)
- Self-contained HTML report: base64-embedded web/iOS/diff images in 3-column grid with color-coded mismatch percentage
- Unified pipeline entry point: orchestrates full workflow (web capture, iOS capture, normalize, diff, report) for both light and dark modes
- npm run diff script for one-command pipeline invocation

## Task Commits

Each task was committed atomically:

1. **Task 1: iOS capture, sRGB normalization, and pixelmatch comparison with ROI mask** - `244f5a1` (feat)
2. **Task 2: HTML report generation, unified pipeline entry point, and npm script** - `606a841` (feat)

## Files Created/Modified
- `pipeline/lib/capture-ios.ts` - iOS Simulator screenshot capture with boot, app launch, status bar override, appearance set, crop
- `pipeline/lib/normalize.ts` - sRGB color space normalization, 800x800 resize, alpha strip
- `pipeline/lib/compare.ts` - pixelmatch comparison with ROI mask support, CompareResult interface
- `pipeline/lib/report.ts` - Self-contained HTML report with base64-embedded images, color-coded mismatch
- `pipeline/diff.ts` - Unified pipeline entry point orchestrating full workflow for light and dark modes
- `package.json` - Added "diff" npm script

## Decisions Made
- ROI mask implementation: zeroes non-glass pixels to solid black on BOTH images so they match perfectly and don't inflate mismatch count
- Pipeline always exits 0 regardless of mismatch percentage (report-only mode per locked decision)
- Sequential capture (web then iOS) per mode rather than parallel to avoid resource contention
- 3-second settle time after iOS appearance change matches capture.sh pattern for rendering completion
- App launched by bundle ID before capture to prevent capturing home screen on freshly booted simulator

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. iOS Simulator and GlassReference app must be pre-installed.

## Next Phase Readiness
- Complete screenshot diff pipeline: `npm run diff` executes end-to-end workflow
- All 7 pipeline modules in place: config, capture-web, capture-ios, dev-server, normalize, compare, report
- Phase 13 complete - ready for Phase 14 convergence tuning
- Reports generated at pipeline/output/reports/ with side-by-side comparison

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 13-screenshot-diff-pipeline*
*Completed: 2026-02-26*

---
phase: 11-swiftui-reference-app
plan: 02
subsystem: testing
tags: [bash, xcrun, simctl, screenshot, png, ios-simulator, pixel-identity]

# Dependency graph
requires:
  - phase: 11-01
    provides: "GlassReference SwiftUI app running in iOS Simulator"
provides:
  - "capture.sh script for repeatable iOS Simulator screenshots"
  - "Pixel-identity verification (3-capture comparison)"
  - "Status bar override for consistent reference images"
  - "screenshots/ output directory for reference PNGs"
affects: [13-visual-diff-pipeline, 14-automation]

# Tech tracking
tech-stack:
  added: [xcrun-simctl, sips, cmp]
  patterns: [capture-verify-compare, metadata-stripping, status-bar-override]

key-files:
  created:
    - ios-reference/capture.sh
    - ios-reference/screenshots/.gitkeep
  modified:
    - .gitignore

key-decisions:
  - "sips fallback when exiftool unavailable -- both produce pixel-identical stripped PNGs"
  - "Screenshots gitignored (large binary output), only .gitkeep tracked"
  - "In-app variant toggle is a documented limitation -- script captures current variant only"

patterns-established:
  - "Capture pipeline: status bar override -> set appearance -> wait 3s -> capture 3x -> strip metadata -> verify identity"
  - "Pixel-identity verification: 3 consecutive captures must be byte-identical after metadata stripping"

requirements-completed: [REF-04]

# Metrics
duration: 2min
completed: 2026-02-25
---

# Phase 11 Plan 02: Capture Script Summary

**Bash capture pipeline producing pixel-identical PNG screenshots from iOS Simulator with status bar override and 3-capture reproducibility verification**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-26T04:26:45Z
- **Completed:** 2026-02-26T04:28:55Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Capture script produces repeatable, pixel-identical PNG screenshots from iOS Simulator
- Both regular_light and regular_dark permutations verified PASS on first attempt
- Status bar overridden to 9:41 / full battery / no carrier for clean reference captures
- PNG metadata stripping via sips fallback produces byte-identical results across captures
- Script supports all four permutations with documented in-app variant toggle limitation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create capture script with metadata stripping and verification** - `33b627e` (feat)
2. **Task 2: Test capture script on running simulator** - `2522e78` (test)

## Files Created/Modified
- `ios-reference/capture.sh` - Executable bash script: captures screenshots, strips metadata, verifies pixel-identity
- `ios-reference/screenshots/.gitkeep` - Tracks empty screenshots output directory in git
- `.gitignore` - Added ios-reference/screenshots/*.png (large binary output artifacts)

## Decisions Made
- **sips fallback for metadata stripping:** exiftool is not installed; sips re-export successfully strips enough metadata for byte-identical comparison. Documented exiftool as recommended for thorough stripping.
- **Screenshots gitignored:** At ~2MB each, captured PNGs are output artifacts, not source. Only .gitkeep tracked.
- **In-app variant toggle limitation documented:** The script controls light/dark mode externally via simctl but cannot toggle between .regular and .clear glass variants -- that requires in-app interaction. Clearly documented in script header and "all" mode stderr output.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - both capture permutations produced PASS results on first attempt with default timing (3s settle + 1s between captures).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Capture pipeline ready for Phase 13 visual diff integration
- Two reference screenshots captured (regular_light.png, regular_dark.png) at 1206x2622 sRGB
- Phase 14 automation can build on this script to add programmatic variant toggling
- "all" mode interactive prompt designed for eventual replacement with automated UI testing

---
*Phase: 11-swiftui-reference-app*
*Completed: 2026-02-25*

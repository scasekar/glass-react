---
phase: 13-screenshot-diff-pipeline
plan: 01
subsystem: testing
tags: [playwright, webgpu, screenshot, capture, pipeline, pixelmatch]

# Dependency graph
requires:
  - phase: 12-live-tuning-ui
    provides: "Demo app with GlassParams presets, URL param injection, ControlPanel"
provides:
  - "Pipeline config (CONFIG, PipelineConfig) with preset URL serialization"
  - "Playwright web capture (captureWeb) with Chrome GPU flags for WebGPU"
  - "Vite dev server lifecycle (startDevServer/stopDevServer)"
  - "Capture mode in demo App (?capture=true hides all UI chrome)"
affects: [13-02-PLAN, screenshot-diff-pipeline]

# Tech tracking
tech-stack:
  added: [pixelmatch, pngjs, sharp, "@types/pngjs", tsx]
  patterns: [url-param-capture-mode, playwright-webgpu-screenshot, dev-server-lifecycle]

key-files:
  created:
    - pipeline/lib/config.ts
    - pipeline/lib/capture-web.ts
    - pipeline/lib/dev-server.ts
    - pipeline/output/.gitignore
  modified:
    - demo/App.tsx
    - package.json
    - package-lock.json

key-decisions:
  - "Chrome channel (not bundled Chromium) for WebGPU GPU support in Playwright"
  - "deviceScaleFactor=1 for 1:1 pixel mapping, no DPR scaling"
  - "3s settle time after canvas visible for GPU rendering completion"
  - "morphSpeed=0 in capture mode for instant parameter application"
  - "backgroundMode always 'image' in capture mode to match iOS reference"

patterns-established:
  - "Capture mode pattern: ?capture=true URL param hides all UI chrome for clean screenshots"
  - "Pipeline config pattern: centralized PipelineConfig with preset URL serialization from PRESETS"
  - "Dev server lifecycle pattern: auto-start if not running, shared across captures"

requirements-completed: [DIFF-01]

# Metrics
duration: 3min
completed: 2026-02-26
---

# Phase 13 Plan 01: Pipeline Infrastructure & Web Capture Summary

**Playwright WebGPU canvas capture with Chrome GPU flags, pipeline config with preset URL serialization, and capture-mode demo rendering**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-26T21:44:16Z
- **Completed:** 2026-02-26T21:47:25Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Pipeline config with typed PipelineConfig interface, preset URL serialization from PRESETS, ROI mask, and iOS crop regions
- Playwright web capture module using system Chrome with GPU flags (`--enable-gpu`, `--use-gl=egl`) for WebGPU headless screenshots
- Vite dev server lifecycle management with auto-start detection and graceful shutdown
- Capture mode in demo App: `?capture=true` renders only a centered GlassPanel over wallpaper with no UI chrome
- Pipeline output directory with .gitignore to exclude generated artifacts

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies, create pipeline config, add capture mode to demo App** - `d11140c` (feat)
2. **Task 2: Implement Playwright web capture and Vite dev server lifecycle** - `942a249` (feat)

## Files Created/Modified
- `pipeline/lib/config.ts` - Pipeline configuration with PipelineConfig interface, preset URL serialization, ROI mask, iOS crop region
- `pipeline/lib/capture-web.ts` - Playwright WebGPU canvas screenshot capture with Chrome GPU flags
- `pipeline/lib/dev-server.ts` - Vite dev server lifecycle management (start/stop)
- `pipeline/output/.gitignore` - Excludes generated artifacts from git
- `demo/App.tsx` - Added capture mode: ?capture=true renders clean glass panel only
- `package.json` - Added pixelmatch, pngjs, sharp, @types/pngjs, tsx devDependencies
- `package-lock.json` - Lock file updated with new dependencies

## Decisions Made
- Use system Chrome (`channel: 'chrome'`) instead of bundled Chromium for WebGPU GPU support in Playwright
- Set `deviceScaleFactor: 1` for 1:1 pixel mapping (no DPR scaling) to match iOS normalization
- 3-second settle time after canvas visible for GPU rendering completion
- `morphSpeed=0` in capture mode ensures instant parameter application (no animation delay)
- `backgroundMode="image"` always in capture mode to match iOS reference which always shows wallpaper

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Pipeline infrastructure complete: config, web capture, and dev server lifecycle are ready
- Plan 02 (iOS capture, normalization, and diff comparison) can build on these modules
- `captureWeb()` is ready to be called from the pipeline entry point
- Preset URLs correctly serialize all 16 GlassParams fields with capture=true flag

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 13-screenshot-diff-pipeline*
*Completed: 2026-02-26*

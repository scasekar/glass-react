# Phase 13: Screenshot Diff Pipeline - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

A scripted pipeline that captures matching screenshots from the web demo (Playwright) and iOS reference app (Simulator), normalizes color spaces, and produces a quantified pixel-diff comparison with region-of-interest masking. This phase builds tooling — it does not change the shader or the rendering. Phase 14 (Automated Tuning Loop) consumes this pipeline's output.

</domain>

<decisions>
## Implementation Decisions

### Capture configuration
- Fixed 800x800 square crop for both web and iOS captures
- Identical scene on both sides: same wallpaper image, same glass panel size/position, same mode
- Use the Apple preset parameters only (Apple Clear Light, Apple Clear Dark)
- Capture both light and dark mode variants — two diff comparisons per pipeline run
- Web capture uses Playwright; iOS capture uses `xcrun simctl io` against iPhone 16 Pro Simulator

### Diff output & reporting
- Terminal output: print mismatch percentage to stdout (report-only, no pass/fail threshold, exit code always 0)
- Save a visual diff PNG showing pixel differences
- Generate an HTML report showing web screenshot, iOS screenshot, and diff image
- Use pixelmatch for pixel comparison (per DIFF-03 requirement)

### Region masking
- Pipeline supports a region-of-interest mask restricting comparison to the glass panel area only (per DIFF-04)
- Mask definition approach, number of regions, clean-render mode, and mask visualization are at Claude's discretion

### Pipeline invocation
- Single unified script — one command captures web, captures iOS, normalizes, diffs, and generates the report
- Script auto-launches iPhone 16 Pro Simulator if not already running
- Pipeline language and output artifact directory are at Claude's discretion

### Claude's Discretion
- HTML report interactivity (static side-by-side vs interactive slider)
- Pipeline script language (Node.js/TypeScript recommended given Playwright and pixelmatch are JS-native)
- Output directory structure for screenshots and diffs
- Region mask definition method (fixed coordinates vs auto-detect)
- Single vs multiple comparison regions
- Whether to implement a clean capture mode (hide UI controls) vs mask-based exclusion
- Diff image mask boundary visualization

</decisions>

<specifics>
## Specific Ideas

- Phase 12 already supports URL-based parameter injection — the web capture can load specific presets via query params
- The iOS reference app (Phase 11) has a capture mode with `xcrun simctl io` scripting already working (REF-04 complete)
- Both web and iOS screenshots must be normalized to sRGB color space before comparison (DIFF-02) — solid color patches should differ by less than 1% after normalization

</specifics>

<deferred>
## Deferred Ideas

- AI-driven diff analysis: Claude examines visual differences and recommends architectural shader changes (not just parameter tuning) — potential future phase beyond Phase 14
- Pass/fail threshold gating — could be added later if needed for CI, but Phase 13 is report-only

</deferred>

---

*Phase: 13-screenshot-diff-pipeline*
*Context gathered: 2026-02-26*

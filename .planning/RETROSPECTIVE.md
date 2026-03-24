# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v2.0 — Visual Parity

**Shipped:** 2026-03-24
**Phases:** 6 | **Plans:** 13

### What Was Built
- Image background engine with sRGB-correct GPU pipeline (RGBA8UnormSrgb textures)
- 7 new shader parameters exposed as typed React props with smooth morphing
- SwiftUI reference app capturing authentic Apple Liquid Glass on iOS Simulator
- Live tuning UI with 16-parameter sliders, presets, JSON import/export, URL params
- Screenshot diff pipeline (Playwright + iOS Simulator + pixelmatch with ROI masking)
- Coordinate-descent auto-tuning loop for converging toward Apple's native glass appearance

### What Worked
- Parallel phase execution: Phases 9, 10, 11 ran independently, saving significant time
- Research agents surfaced key decisions early (JS image decode over stb_image, Chrome channel for WebGPU)
- Flat preset JSON format kept tuning pipeline simple and interoperable
- URL-based parameter injection eliminated rebuild cycles during automated tuning
- sRGB-correct pipeline caught color space issues early (50% gray test criterion)

### What Was Inefficient
- Phase 11 (SwiftUI Reference App) took 45 min for Plan 01 — Xcode project setup with iOS 26 beta quirks (`.glassEffect()` dark-on-device bug) consumed time
- REF-01/02/03 requirement checkboxes not updated in REQUIREMENTS.md despite Phase 11 completing successfully — traceability gap
- 5x5 Gaussian blur structural limitation was acknowledged but deferred — future milestone should address Dual Kawase blur

### Patterns Established
- Capture mode URL param (`?capture=true`) for headless screenshot consistency
- ROI masking pattern for region-specific visual comparison
- Coordinate descent with tint decomposition (3 independent color axes)
- sips metadata stripping as cross-platform fallback for exiftool

### Key Lessons
1. Mark requirement checkboxes complete at the same time as SUMMARY.md — traceability gaps compound
2. iOS Simulator is the only reliable reference for `.glassEffect()` in iOS 26 beta — physical devices render incorrectly
3. Persistent Playwright browser instance eliminates per-evaluation launch overhead — critical for automated tuning loops
4. Settle time matters: 2s warm / 3s cold captures prevent flaky screenshot comparisons

### Cost Observations
- Model mix: quality profile (Opus for research/roadmap, Sonnet for execution)
- Most plans completed in 2-3 min; Phase 11 Plan 01 was the outlier at 45 min
- Notable: 75 git commits across v2.0, ~15K lines changed

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 MVP | 8 | 16 | Initial project setup, core engine + React components |
| v2.0 Visual Parity | 6 | 13 | Added visual toolchain (reference app, diffing, auto-tuning) |

### Top Lessons (Verified Across Milestones)

1. AllowSpontaneous callbacks for emdawnwebgpu device init — discovered in v1.0, remained critical through v2.0
2. sRGB color space correctness must be validated early — affects both rendering and comparison pipelines

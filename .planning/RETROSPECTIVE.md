# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v3.0 — Architecture Redesign

**Shipped:** 2026-03-25
**Phases:** 5 | **Plans:** 14

### What Was Built
- Flipped device ownership: JS creates GPUDevice, passes to C++ via importJsDevice (60% WASM binary reduction)
- GlassRenderer TypeScript class with explicit bind group layouts, dynamic offset uniform buffer, 27 unit tests
- React integration preserved: same GlassPanel/GlassButton/GlassCard API, all 16 shader params, accessibility
- Plano-convex dome refraction via Snell's law — pow4 depth curve, SDF gradient surface normals, edge-focused displacement matching iOS
- Tuning page redesigned with design tokens, SectionAccordion, preset chips, Copy URL
- Visual validation pipeline updated for new architecture

### What Worked
- Parallel phases: 15+16 ran in parallel (GlassRenderer tested against synthetic texture), 18+19 ran in parallel
- Research agents caught key architecture patterns early (explicit bind group layouts, ArrayBuffer pass-through for writeBuffer)
- Incremental integration approach: each phase produced independently testable artifacts
- Guard-pattern setters for safe no-op on unknown region IDs prevented runtime errors during integration

### What Was Inefficient
- REACT-04 and VIS-01 requirement checkboxes not updated despite being delivered — recurring traceability gap from v2.0
- STATE.md progress tracking fell behind (showed 97% when all 14 plans were complete)
- v3.0 progress table in ROADMAP.md had column misalignment for phases 15-19

### Patterns Established
- JS-creates-device + preinitializedWebGPUDevice pattern for pluggable C++ engines
- Explicit bind group layouts (not layout:'auto') for multi-region texture sharing
- CSS custom property `--pct` for range track fill gradient (no JS painting needed)
- Token object as-const for TS type safety over CSS custom properties

### Key Lessons
1. Requirement checkbox tracking must happen in the same commit as SUMMARY.md — this is the third milestone with traceability gaps
2. Explicit bind group layouts are required when sharing textures across draw calls — layout:'auto' causes silent failures
3. Plano-convex dome refraction (Snell's law + SDF gradients) is the key to matching Apple's water-droplet glass aesthetic
4. ArrayBuffer pass-through for writeBuffer satisfies @webgpu/types strict typing without unsafe casts

### Cost Observations
- Model mix: quality profile (Opus for research/roadmap)
- 29 commits across v3.0, ~6,874 LOC total
- Most plans completed in 1-2 min; Phase 18-01 (visual validation) took 10 min
- Notable: Architecture redesign (5 phases) completed faster than visual toolchain (6 phases in v2.0)

---

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
| v3.0 Architecture Redesign | 5 | 14 | JS/WebGPU owns glass pipeline; C++ background-only; pluggable architecture |

### Top Lessons (Verified Across Milestones)

1. AllowSpontaneous callbacks for emdawnwebgpu device init — discovered in v1.0, remained critical through v3.0
2. sRGB color space correctness must be validated early — affects both rendering and comparison pipelines
3. Requirement checkbox tracking must happen in the same commit as SUMMARY.md — traceability gaps recurred in v2.0 and v3.0

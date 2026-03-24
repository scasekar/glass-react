# Roadmap: LiquidGlass-React-WASM

## Milestones

- ✅ **v1.0 MVP** — Phases 1-8 (shipped 2026-02-10)
- ✅ **v2.0 Visual Parity** — Phases 9-14 (shipped 2026-03-24)
- **v3.0 Architecture Redesign** — Phases 15-19 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-8) — SHIPPED 2026-02-10</summary>

- [x] Phase 1: Engine Foundation (2/2 plans) — completed 2026-02-10
- [x] Phase 2: Background Rendering (2/2 plans) — completed 2026-02-10
- [x] Phase 3: GPU Texture Bridge (2/2 plans) — completed 2026-02-10
- [x] Phase 4: Glass Shader Core (2/2 plans) — completed 2026-02-10
- [x] Phase 5: React Component API (2/2 plans) — completed 2026-02-10
- [x] Phase 6: Accessibility & Theming (2/2 plans) — completed 2026-02-10
- [x] Phase 7: Visual Polish (2/2 plans) — completed 2026-02-10
- [x] Phase 8: Library Packaging & Demo (2/2 plans) — completed 2026-02-10

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>v2.0 Visual Parity (Phases 9-14) — SHIPPED 2026-03-24</summary>

- [x] Phase 9: Image Background Engine (3/3 plans) — completed 2026-02-25
- [x] Phase 10: Shader Parameter Exposure (2/2 plans) — completed 2026-02-26
- [x] Phase 11: SwiftUI Reference App (2/2 plans) — completed 2026-02-26
- [x] Phase 12: Live Tuning UI (2/2 plans) — completed 2026-02-26
- [x] Phase 13: Screenshot Diff Pipeline (2/2 plans) — completed 2026-02-26
- [x] Phase 14: Automated Tuning Loop (2/2 plans) — completed 2026-02-26

Full details: [milestones/v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md)

</details>

### v3.0 Architecture Redesign (In Progress)

**Milestone Goal:** JS/WebGPU owns the glass shader pipeline; C++/WASM renders backgrounds only; shared GPU texture bridge enables pluggable engines.

**Parallel opportunity:** Phases 15 and 16 can execute in parallel. Phase 16 tests against a synthetic texture and does not require the thinned WASM from Phase 15. Phase 19 can parallel with Phase 18.

- [x] **Phase 15: WASM Thinning** — Slim C++ engine to background-only renderer; JS creates and owns GPUDevice (completed 2026-03-24)
- [ ] **Phase 16: JS Glass Renderer** — Build the JS/WebGPU glass pipeline in isolation against a synthetic texture
- [ ] **Phase 17: React Integration** — Wire GlassProvider to connect thinned WASM + JS GlassRenderer; preserve public API
- [ ] **Phase 18: Visual Validation** — Re-tune presets and confirm visual parity against iOS reference
- [ ] **Phase 19: Tuning Page Redesign** — Redesign dev tuning page with frontend-design + ui-ux-pro-max skills

## Phase Details

### Phase 15: WASM Thinning
**Goal**: C++ engine becomes a call-driven background renderer — JS creates GPUDevice, C++ receives it, renders backgrounds only, and exposes scene texture for JS consumption
**Depends on**: Nothing (first v3.0 phase; can run parallel with Phase 16)
**Requirements**: DEV-01, DEV-02, DEV-03, DEV-04, DEV-05
**Success Criteria** (what must be TRUE):
  1. JS successfully creates a GPUDevice via navigator.gpu and the WASM engine initializes using that externally-provided device
  2. C++ engine renders noise and image backgrounds to an offscreen texture without any glass shader code executing
  3. JS can retrieve the scene texture handle from C++ and obtain a valid GPUTexture object from it
  4. The render loop is driven by JS requestAnimationFrame — no emscripten_set_main_loop in the C++ code
  5. WASM binary size is smaller than v2.0 (glass shader code removed)
**Plans**: 3 plans

Plans:
- [ ] 15-01-PLAN.md — C++ surgery: delete glass pass, fix RGBA8Unorm format, add renderBackground(), remove surface and main loop
- [ ] 15-02-PLAN.md — TS/JS wiring: always-external loader.ts, GlassProvider JS device creation and rAF loop
- [ ] 15-03-PLAN.md — Build thinned WASM and human visual verification

### Phase 16: JS Glass Renderer
**Goal**: A standalone GlassRenderer TypeScript class renders glass effects over any GPUTexture using the verbatim-ported WGSL shader, testable in isolation with a synthetic texture
**Depends on**: Nothing (can run parallel with Phase 15; uses synthetic texture for testing)
**Requirements**: GLASS-01, GLASS-02, GLASS-03, GLASS-04, GLASS-05
**Success Criteria** (what must be TRUE):
  1. GlassRenderer renders visually correct glass refraction/blur/tint over a synthetic solid-color texture at 60FPS
  2. Multiple glass regions render simultaneously with correct per-region uniforms via dynamic buffer offsets
  3. Canvas resize triggers bind group recreation without visual artifacts or stale texture references
  4. All 16 shader parameters (contrast, saturation, Fresnel, specular, chromatic aberration, etc.) produce visible effect changes when adjusted
**Plans**: 3 plans

Plans:
- [ ] 16-01-PLAN.md — Vitest setup, glass.wgsl port, GlassRegionState.ts with buildGlassUniformData() and unit tests
- [ ] 16-02-PLAN.md — GlassRenderer core class: pipeline, explicit bind group layouts, dynamic offset uniform buffer
- [ ] 16-03-PLAN.md — Canvas context, GlassRendererHarness, Playwright screenshot verification

### Phase 17: React Integration
**Goal**: GlassProvider connects the thinned WASM background engine to the JS GlassRenderer, and React components render glass over the live C++ background with the same public API as v2.0
**Depends on**: Phase 15, Phase 16
**Requirements**: REACT-01, REACT-02, REACT-03, REACT-04
**Success Criteria** (what must be TRUE):
  1. GlassPanel, GlassButton, and GlassCard render glass effects over the live C++ noise/image background — visually comparable to v2.0
  2. All existing React props work identically to v2.0 — no breaking API changes for consumers
  3. All 16 shader parameters are functional as typed React props through the JS pipeline
  4. Accessibility features work: reduced-motion disables animation, reduced-transparency simplifies effects, dark/light mode switches correctly, WCAG contrast maintained
**Plans**: TBD

### Phase 18: Visual Validation
**Goal**: Visual parity with iOS reference is confirmed after architecture change — presets re-tuned if needed, automated diff passes
**Depends on**: Phase 17
**Requirements**: VIS-01, VIS-02
**Success Criteria** (what must be TRUE):
  1. Automated screenshot diff (npm run diff) produces convergence scores against iOS Simulator reference — not regressed from v2.0 baseline
  2. Clear Light and Clear Dark presets are tuned against iOS ground truth using coordinate-descent pipeline
**Plans**: TBD

### Phase 19: Tuning Page Redesign
**Goal**: Dev tuning page is redesigned with polished UI/UX while preserving all functional tuning capabilities
**Depends on**: Phase 17 (needs working glass pipeline; can parallel with Phase 18)
**Requirements**: PAGE-01, PAGE-02
**Success Criteria** (what must be TRUE):
  1. Tuning page has a visually polished, professional design that reflects frontend-design + ui-ux-pro-max quality
  2. All existing tuning features work: parameter sliders, preset switching, JSON import/export, URL parameter persistence
**Plans**: TBD

## Progress

**Execution Order:**
Phases 15 and 16 can execute in parallel. Phase 17 requires both. Phases 18 and 19 can execute in parallel after Phase 17.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Engine Foundation | v1.0 | 2/2 | Complete | 2026-02-10 |
| 2. Background Rendering | v1.0 | 2/2 | Complete | 2026-02-10 |
| 3. GPU Texture Bridge | v1.0 | 2/2 | Complete | 2026-02-10 |
| 4. Glass Shader Core | v1.0 | 2/2 | Complete | 2026-02-10 |
| 5. React Component API | v1.0 | 2/2 | Complete | 2026-02-10 |
| 6. Accessibility & Theming | v1.0 | 2/2 | Complete | 2026-02-10 |
| 7. Visual Polish | v1.0 | 2/2 | Complete | 2026-02-10 |
| 8. Library Packaging & Demo | v1.0 | 2/2 | Complete | 2026-02-10 |
| 9. Image Background Engine | v2.0 | 3/3 | Complete | 2026-02-25 |
| 10. Shader Parameter Exposure | v2.0 | 2/2 | Complete | 2026-02-26 |
| 11. SwiftUI Reference App | v2.0 | 2/2 | Complete | 2026-02-26 |
| 12. Live Tuning UI | v2.0 | 2/2 | Complete | 2026-02-26 |
| 13. Screenshot Diff Pipeline | v2.0 | 2/2 | Complete | 2026-02-26 |
| 14. Automated Tuning Loop | v2.0 | 2/2 | Complete | 2026-02-26 |
| 15. WASM Thinning | 3/3 | Complete    | 2026-03-24 | - |
| 16. JS Glass Renderer | v3.0 | 0/? | Not started | - |
| 17. React Integration | v3.0 | 0/? | Not started | - |
| 18. Visual Validation | v3.0 | 0/? | Not started | - |
| 19. Tuning Page Redesign | v3.0 | 0/? | Not started | - |

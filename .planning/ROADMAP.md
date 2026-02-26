# Roadmap: LiquidGlass-React-WASM

## Milestones

- ✅ **v1.0 MVP** — Phases 1-8 (shipped 2026-02-10)
- 🚧 **v2.0 Visual Parity** — Phases 9-14 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-8) — SHIPPED 2026-02-10</summary>

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

### v2.0 Visual Parity

- [ ] **Phase 9: Image Background Engine** — Load and render real images as background textures with sRGB-correct pipeline
- [ ] **Phase 10: Shader Parameter Exposure** — Expose all glass shader uniforms as typed React props with sensible defaults
- [ ] **Phase 11: SwiftUI Reference App** — Native iOS reference app capturing authentic Apple Liquid Glass for visual comparison
- [ ] **Phase 12: Live Tuning UI** — Real-time shader parameter controls with presets and JSON export/import in demo app
- [ ] **Phase 13: Screenshot Diff Pipeline** — Automated screenshot capture and pixel-diff comparison between web and iOS renders
- [ ] **Phase 14: Automated Tuning Loop** — Script-driven coordinate descent to converge shader parameters toward Apple's Liquid Glass

## Phase Details

### Phase 9: Image Background Engine
**Goal**: Users can render real photographs as the background behind glass components, replacing or switching from procedural noise
**Depends on**: Phase 8 (v1.0 complete)
**Requirements**: IMG-01, IMG-02, IMG-03, IMG-04
**Success Criteria** (what must be TRUE):
  1. User can pass a `backgroundSrc` URL to GlassProvider and see that image rendered behind glass components with correct refraction
  2. User can switch between `backgroundMode="noise"` and `backgroundMode="image"` without reloading the page, and both modes render correctly
  3. When no `backgroundSrc` is provided, the library's bundled default wallpaper image loads automatically in image mode
  4. A 50% gray test image passed through the glass pipeline with zero effects produces 50% gray output (sRGB/linear color space correctness verified)
**Plans**: 2 plans
  - [ ] 09-01-PLAN.md -- C++ image blit pipeline, mode switching, upload API, Embind bindings
  - [ ] 09-02-PLAN.md -- JS image decode/upload, GlassProvider backgroundMode prop, bundled wallpaper, demo toggle

### Phase 10: Shader Parameter Exposure
**Goal**: Users can fine-tune every aspect of the glass appearance through documented React props
**Depends on**: Phase 8 (v1.0 complete)
**Requirements**: SHDR-01, SHDR-02, SHDR-03, SHDR-04, SHDR-05
**Success Criteria** (what must be TRUE):
  1. User can set `contrast`, `saturation`, and `blurRadius` props on GlassPanel/GlassButton/GlassCard and see the visual effect change in real time
  2. User can set `fresnelIOR`, `fresnelExponent`, `envReflectionStrength`, and `glareDirection` props on glass components
  3. All shader parameter props have TypeScript types, JSDoc documentation, and sensible defaults that match v1.0 appearance when unset
  4. Changing any shader prop applies smoothly through the existing morphing/lerp system without visual discontinuities
**Plans**: TBD

### Phase 11: SwiftUI Reference App
**Goal**: A native iOS app renders authentic Apple Liquid Glass over the same wallpaper for use as the visual comparison ground truth
**Depends on**: Nothing (independent of web app phases)
**Requirements**: REF-01, REF-02, REF-03, REF-04
**Success Criteria** (what must be TRUE):
  1. Xcode project builds and runs on iPhone 16 Pro Simulator showing `.regular` and `.clear` glass variants over the bundled wallpaper
  2. Reference app displays both a glass panel and a rounded element (search bar or pill button) matching the web demo layout
  3. Reference app can be toggled between light mode and dark mode, producing visually distinct glass variants
  4. Running the capture script produces stable, repeatable PNG screenshots from the iOS Simulator (three consecutive captures are pixel-identical)
**Plans**: TBD

### Phase 12: Live Tuning UI
**Goal**: Developers can interactively adjust every shader parameter in the demo app and save/load parameter configurations
**Depends on**: Phase 9, Phase 10
**Requirements**: TUNE-01, TUNE-02, TUNE-03, TUNE-04
**Success Criteria** (what must be TRUE):
  1. Demo app displays grouped slider controls for all shader parameters, and moving any slider updates the glass appearance instantly
  2. User can click "Reset" per section or globally and all parameters return to their defaults
  3. User can select "Apple Standard" or "Apple Prominent" presets and see distinct glass appearances load instantly
  4. User can export current parameters as a JSON file and import a previously exported JSON to restore those parameters
**Plans**: TBD

### Phase 13: Screenshot Diff Pipeline
**Goal**: A scripted pipeline captures matching screenshots from web and iOS and produces a quantified pixel-diff comparison
**Depends on**: Phase 9, Phase 11
**Requirements**: DIFF-01, DIFF-02, DIFF-03, DIFF-04
**Success Criteria** (what must be TRUE):
  1. Running the Playwright capture script produces a PNG screenshot of the WebGPU canvas at the standardized pixel dimensions
  2. Both web and iOS screenshots are normalized to sRGB color space before comparison (solid color patches differ by less than 1% after normalization)
  3. Running the diff script produces a visual diff image and a mismatch percentage comparing web vs iOS glass renders
  4. Diff pipeline supports a region-of-interest mask that restricts comparison to the glass panel area only, ignoring background differences
**Plans**: TBD

### Phase 14: Automated Tuning Loop
**Goal**: A script automatically adjusts shader parameters toward minimizing the visual diff against the iOS reference
**Depends on**: Phase 12, Phase 13
**Requirements**: AUTO-01, AUTO-02, AUTO-03
**Success Criteria** (what must be TRUE):
  1. Tuning script injects parameters via URL query string and captures a screenshot without requiring a rebuild or HMR cycle
  2. Script performs coordinate descent, adjusting one parameter at a time, and the diff score decreases across iterations
  3. Script outputs a log of convergence per iteration and a final JSON file containing the best-found parameter set
**Plans**: TBD

## Progress

**Execution Order:**
Phases 9 and 10 can execute in parallel. Phase 11 can execute in parallel with 9-10. Phase 12 requires 9+10. Phase 13 requires 9+11. Phase 14 requires 12+13.

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
| 9. Image Background Engine | v2.0 | 0/2 | Planned | - |
| 10. Shader Parameter Exposure | v2.0 | 0/TBD | Not started | - |
| 11. SwiftUI Reference App | v2.0 | 0/TBD | Not started | - |
| 12. Live Tuning UI | v2.0 | 0/TBD | Not started | - |
| 13. Screenshot Diff Pipeline | v2.0 | 0/TBD | Not started | - |
| 14. Automated Tuning Loop | v2.0 | 0/TBD | Not started | - |

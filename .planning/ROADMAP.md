# Roadmap: LiquidGlass-React-WASM

## Milestones

- ✅ **v1.0 MVP** — Phases 1-8 (shipped 2026-02-10)
- ✅ **v2.0 Visual Parity** — Phases 9-14 (shipped 2026-03-24)
- ✅ **v3.0 Architecture Redesign** — Phases 15-19 (shipped 2026-03-25)
- **v4.0 Glass Control Library & Showcase** — Phases 20-25 (in progress)

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

<details>
<summary>v3.0 Architecture Redesign (Phases 15-19) — SHIPPED 2026-03-25</summary>

- [x] Phase 15: WASM Thinning (3/3 plans) — completed 2026-03-24
- [x] Phase 16: JS Glass Renderer (3/3 plans) — completed 2026-03-24
- [x] Phase 17: React Integration (3/3 plans) — completed 2026-03-24
- [x] Phase 18: Visual Validation (2/2 plans) — completed 2026-03-25
- [x] Phase 19: Tuning Page Redesign (3/3 plans) — completed 2026-03-24

Full details: [milestones/v3.0-ROADMAP.md](milestones/v3.0-ROADMAP.md)

</details>

### v4.0 Glass Control Library & Showcase (In Progress)

**Milestone Goal:** Build a pixel-perfect Apple Liquid Glass control library with functional UI widgets and a polished showcase page that demonstrates library capabilities.

- [x] **Phase 20: Foundation & Safety Rails** - Region budget, design tokens, GlassEffectContainer, new dependencies (completed 2026-03-25)
- [x] **Phase 21: Core Interactive Controls** - Toggle, slider, segmented control with spring animations (completed 2026-03-25)
- [x] **Phase 22: Core Discrete Controls** - Chip, stepper, input field (completed 2026-03-25)
- [ ] **Phase 23: Navigation Controls** - Tab bar, navigation bar, toolbar, search bar
- [ ] **Phase 24: Overlay Controls** - Action sheet, alert, sheet, popover with portals
- [ ] **Phase 25: Showcase Page** - Product landing page replacing tuning page as main entry

## Phase Details

### Phase 20: Foundation & Safety Rails
**Goal**: Infrastructure and shared primitives are in place so controls can be built without hitting GPU limits or hardcoding pixel values
**Depends on**: Phase 19 (v3.0 complete)
**Requirements**: FND-01, FND-02, FND-03
**Success Criteria** (what must be TRUE):
  1. Adding a 33rd glass region throws an error instead of corrupting the uniform buffer
  2. GlassEffectContainer wraps multiple glass children and provides a shared morph ID namespace visible in React DevTools
  3. Apple design tokens (APPLE_SPACING, APPLE_RADII, APPLE_CONTROL_SIZES) are importable from the library and match Apple HIG reference dimensions
  4. motion and @radix-ui/* packages are installed and a smoke test (spring animation + Radix Switch) renders without errors
**Plans**: 2 plans
Plans:
- [x] 20-01-PLAN.md — Region budget increase, overflow guard, dependency installation, smoke test
- [ ] 20-02-PLAN.md — Apple design tokens and GlassEffectContainer primitive

### Phase 21: Core Interactive Controls
**Goal**: Users can interact with toggle, slider, and segmented controls that feel like native Apple Liquid Glass widgets
**Depends on**: Phase 20
**Requirements**: CTRL-01, CTRL-02, CTRL-03
**Success Criteria** (what must be TRUE):
  1. GlassToggle renders at Apple's 51x31px dimensions, thumb slides with spring overshoot, and toggling updates bound state
  2. GlassSlider thumb tracks pointer drag smoothly, value updates continuously, and glass fill reflects current position
  3. GlassSegmentedControl displays a glass thumb capsule that spring-animates between segments when selection changes
  4. All three controls respect reduced-motion (no spring overshoot) and reduced-transparency (solid fallback) preferences
  5. Keyboard navigation works for all three controls (Tab to focus, Space/Arrow to operate)
**Plans**: 2 plans
Plans:
- [ ] 21-01-PLAN.md — GlassToggle and GlassSlider with types, tests, and library exports
- [ ] 21-02-PLAN.md — GlassSegmentedControl with layoutId animation and visual verification

### Phase 22: Core Discrete Controls
**Goal**: Users can interact with chip, stepper, and input controls that complete the core control palette
**Depends on**: Phase 20
**Requirements**: CTRL-04, CTRL-05, CTRL-06
**Success Criteria** (what must be TRUE):
  1. GlassChip renders as a selectable pill with glass background, toggles selected/unselected state on click
  2. GlassStepper renders +/- buttons with glass surfaces, increments and decrements a bound numeric value with min/max clamping
  3. GlassInput renders a text field with glass border that gains a visible focus ring and glass intensity change on focus
  4. All three controls are keyboard-accessible and announce state changes to screen readers
**Plans**: 2 plans
Plans:
- [ ] 22-01-PLAN.md — GlassChip and GlassStepper controls with tests
- [ ] 22-02-PLAN.md — GlassInput control, barrel exports, library wiring

### Phase 23: Navigation Controls
**Goal**: Users see familiar iOS navigation patterns (tab bar, nav bar, toolbar, search bar) rendered with Liquid Glass
**Depends on**: Phase 21 (validates composition pattern at scale)
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04
**Success Criteria** (what must be TRUE):
  1. GlassTabBar renders at screen bottom with glass background, highlights the active tab, and switching tabs updates content
  2. GlassNavigationBar renders at screen top with glass background, displays a title, and a back action triggers its callback
  3. GlassToolbar renders a row of icon buttons with glass background, each button triggers its callback on click
  4. GlassSearchBar renders a glass capsule input that expands on focus, accepts text input, and has working clear/cancel actions
  5. All navigation controls render correctly when composed together in a single viewport (no region conflicts)
**Plans**: 2 plans
Plans:
- [ ] 23-01-PLAN.md — Navigation types, GlassNavigationBar, and GlassToolbar with tests
- [ ] 23-02-PLAN.md — GlassSearchBar, GlassTabBar, and barrel exports

### Phase 24: Overlay Controls
**Goal**: Users can trigger and dismiss modal overlays (action sheets, alerts, sheets, popovers) that render with glass backgrounds above page content
**Depends on**: Phase 20 (GlassEffectContainer, design tokens), Phase 21 (button patterns for action rows)
**Requirements**: OVR-01, OVR-02, OVR-03, OVR-04
**Success Criteria** (what must be TRUE):
  1. GlassActionSheet slides up from bottom with glass option rows, each row triggers its callback, cancel dismisses the sheet
  2. GlassAlert renders centered with glass background, displays title/message, and action buttons trigger callbacks and dismiss
  3. GlassSheet renders as a half-height or full-height modal with glass background and can be dismissed by dragging down
  4. GlassPopover renders anchored to its trigger element with glass background and dismisses on outside click
  5. All overlay controls trap focus while open, return focus to trigger on dismiss, and close on Escape key
**Plans**: 2 plans
Plans:
- [ ] 24-01-PLAN.md — Overlay types, GlassAlert, and GlassActionSheet with tests
- [ ] 24-02-PLAN.md — GlassSheet, GlassPopover, and barrel export wiring

### Phase 25: Showcase Page
**Goal**: A polished product landing page replaces the tuning page as the default route, demonstrating all controls in context with professional design quality
**Depends on**: Phase 22, Phase 23, Phase 24 (all controls complete)
**Requirements**: SHOW-01, SHOW-02, SHOW-03, SHOW-04
**Success Criteria** (what must be TRUE):
  1. Loading the app shows a showcase page with hero section, contextual control demonstrations, and developer quick-start — not the tuning UI
  2. A toggle or drawer provides access to all existing tuning controls without leaving the showcase page
  3. Scrolling through the showcase page does not exceed the GPU region budget — IntersectionObserver virtualizes off-screen sections
  4. A wallpaper selector on the showcase page allows switching between background images and noise mode, updating all glass controls live
  5. The showcase page looks like a professional product landing page, not a component kitchen sink
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-8 | v1.0 | 16/16 | Complete | 2026-02-10 |
| 9-14 | v2.0 | 13/13 | Complete | 2026-03-24 |
| 15-19 | v3.0 | 14/14 | Complete | 2026-03-25 |
| 20. Foundation & Safety Rails | 2/2 | Complete   | 2026-03-25 | - |
| 21. Core Interactive Controls | 2/2 | Complete   | 2026-03-25 | - |
| 22. Core Discrete Controls | 2/2 | Complete   | 2026-03-25 | - |
| 23. Navigation Controls | 1/2 | In Progress|  | - |
| 24. Overlay Controls | 1/2 | In Progress|  | - |
| 25. Showcase Page | v4.0 | 0/TBD | Not started | - |

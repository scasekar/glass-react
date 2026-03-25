# Requirements: LiquidGlass-React-WASM v4.0

**Defined:** 2026-03-25
**Core Value:** Glass components that look and feel like Apple's Liquid Glass — pixel-perfect fidelity to Apple's HIG with functional, accessible controls.

## v4.0 Requirements

### Foundation

- [x] **FND-01**: GlassEffectContainer primitive provides shared sampling region and morph ID grouping for child controls
- [x] **FND-02**: MAX_GLASS_REGIONS increased from 16 to 32 with addRegion() guard preventing overflow
- [x] **FND-03**: Apple design tokens (spacing, radii, control sizes) defined as TypeScript const objects

### Core Controls

- [x] **CTRL-01**: GlassToggle renders as a switch with spring-animated glass thumb matching Apple's 51x31px dimensions
- [x] **CTRL-02**: GlassSlider renders continuous value control with glass track fill and glass thumb
- [x] **CTRL-03**: GlassSegmentedControl renders segments with a glass thumb capsule that slides between options via spring animation
- [x] **CTRL-04**: GlassChip renders as a selectable tag/filter pill with glass background
- [x] **CTRL-05**: GlassStepper renders +/- increment control with glass button surfaces
- [x] **CTRL-06**: GlassInput renders text field with glass border and focus state

### Navigation Controls

- [ ] **NAV-01**: GlassTabBar renders bottom tab bar with glass background and active tab indicator
- [x] **NAV-02**: GlassNavigationBar renders top navigation bar with glass background, title, and back action
- [x] **NAV-03**: GlassToolbar renders action toolbar with glass background and icon buttons
- [ ] **NAV-04**: GlassSearchBar renders search field with glass background and clear/cancel actions

### Overlay Controls

- [x] **OVR-01**: GlassActionSheet renders bottom action sheet with glass option rows and cancel button
- [x] **OVR-02**: GlassAlert renders centered dialog with glass background, title, message, and action buttons
- [x] **OVR-03**: GlassSheet renders half/full modal sheet with glass background and drag-to-dismiss
- [x] **OVR-04**: GlassPopover renders contextual popover with glass background anchored to trigger element

### Showcase Page

- [ ] **SHOW-01**: Showcase page replaces tuning page as main landing with professional product layout
- [ ] **SHOW-02**: TuningDrawer provides slide-in access to all existing tuning controls from showcase
- [ ] **SHOW-03**: IntersectionObserver-based section virtualization keeps active GPU regions within budget
- [ ] **SHOW-04**: Wallpaper selector allows switching background image/noise from showcase page

## Future Requirements

### P2 Controls (v4.x)

- **P2-01**: GlassFloatingActionButton with expand-to-sub-actions morph animation
- **P2-02**: GlassContextMenu with long-press trigger and glass option rows
- **P2-03**: GlassMediaControls (play/pause/seek with glass background)
- **P2-04**: GlassNotificationBanner (top-edge toast with glass background)
- **P2-05**: GlassProgressBar (determinate/indeterminate with glass track)
- **P2-06**: Touch-point illumination shimmer shader uniform

## Out of Scope

| Feature | Reason |
|---------|--------|
| Glass on content cells/lists | Apple HIG: glass is navigation-layer only — never on content |
| CSS backdrop-filter fallback | Already handled by WebGPU GlassRenderer — would cause double-blur |
| Web font packages (Inter, Geist) | System font stack (-apple-system) is correct for Apple fidelity |
| React Router | Single-page showcase with anchor navigation, no routing needed |
| Server-side rendering | WebGPU is client-only |
| WebGL fallback | WebGPU-only is the value proposition |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01 | Phase 20 | Complete |
| FND-02 | Phase 20 | Complete |
| FND-03 | Phase 20 | Complete |
| CTRL-01 | Phase 21 | Complete |
| CTRL-02 | Phase 21 | Complete |
| CTRL-03 | Phase 21 | Complete |
| CTRL-04 | Phase 22 | Complete |
| CTRL-05 | Phase 22 | Complete |
| CTRL-06 | Phase 22 | Complete |
| NAV-01 | Phase 23 | Pending |
| NAV-02 | Phase 23 | Complete |
| NAV-03 | Phase 23 | Complete |
| NAV-04 | Phase 23 | Pending |
| OVR-01 | Phase 24 | Complete |
| OVR-02 | Phase 24 | Complete |
| OVR-03 | Phase 24 | Complete |
| OVR-04 | Phase 24 | Complete |
| SHOW-01 | Phase 25 | Pending |
| SHOW-02 | Phase 25 | Pending |
| SHOW-03 | Phase 25 | Pending |
| SHOW-04 | Phase 25 | Pending |

**Coverage:**
- v4.0 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-25 after roadmap creation*

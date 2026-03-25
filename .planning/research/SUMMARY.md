# Project Research Summary

**Project:** LiquidGlass-React — Apple Liquid Glass UI Control Library
**Domain:** WebGPU-powered Apple Liquid Glass component library and showcase page (iOS 26 / macOS Tahoe 26 parity)
**Researched:** 2026-03-25
**Confidence:** HIGH (stack + architecture derived from live codebase; features from WWDC25 official transcripts; pitfalls from source analysis)

## Executive Summary

This v4.0 milestone builds a full Apple Liquid Glass UI control catalog and a product-quality showcase page on top of an already-shipped WebGPU rendering pipeline. The architectural foundation is solid: the existing `GlassProvider`, `GlassRenderer`, `GlassPanel`, `GlassButton`, and `useGlassRegion` system handles GPU device ownership, per-region uniform buffers, and React integration. v4.0's work is entirely additive — new control components compose the existing primitives; the GPU pipeline is untouched. The two recommended technical additions are `motion` (v12, formerly Framer Motion) for spring physics animations that are non-negotiable for Apple-authentic controls, and `@radix-ui/*` individual packages for WAI-ARIA accessibility primitives that would be prohibitively expensive to build from scratch.

The feature target is 11 P1 controls for v4.0 launch (GlassButton update, GlassToggle, GlassSlider, GlassSegmentedControl, GlassTabBar, GlassNavigationBar, GlassActionSheet, GlassSheet update, GlassAlert, GlassSearchBar, GlassToolbar) plus a `GlassEffectContainer` coordination primitive that enables morphing transitions. The architecture is layered bottom-up: Layer 0 primitives are already shipped, Layer 1 independent controls compose those primitives, Layer 2 overlay controls add portal positioning, and Layers 3-5 assemble the showcase page. This dependency ordering maps naturally to phases and reduces integration risk.

The primary risks are the `MAX_GLASS_REGIONS = 16` hard cap in `GlassRenderer.ts` (which the showcase page will exceed if all sections mount simultaneously), glass mask misalignment when interactive controls change DOM geometry during interaction, and the showcase page degenerating into an unstructured component kitchen sink. All three are preventable with upfront architectural decisions in the first phase: add an `addRegion()` guard, establish the region topology for each control before implementation, and produce an information architecture document for the showcase page before writing any showcase code.

## Key Findings

### Recommended Stack

The existing production stack (React 19, Vite 6.4, TypeScript strict, WebGPU/WASM pipeline, Playwright, inline styles) requires no changes. Two new runtime dependencies are required for v4.0. See `.planning/research/STACK.md` for full details.

`motion` (^12.38.0, rebranded from `framer-motion`, import path `motion/react`) is the animation layer. Spring physics are non-negotiable for Apple-authentic controls — CSS transitions cannot produce damped spring overshoot, and Motion's `layoutId` layout animations are the only viable mechanism for the segmented control floating indicator morphing between segments. React Spring has no equivalent capability. `@radix-ui/*` individual packages provide WAI-ARIA behavior (roles, keyboard navigation, focus management) at tree-shakeable granularity. Radix's `asChild` pattern allows any primitive to render as a `GlassPanel`-wrapped element without breaking ARIA behavior.

**Core technologies:**
- `motion` ^12.38.0 — spring animation and layout morphing — only library with `layoutId` for segmented control indicator
- `@radix-ui/react-switch` ^1.2.6 — WAI-ARIA switch role for GlassToggle
- `@radix-ui/react-slider` ^1.3.6 — range slider ARIA for GlassSlider
- `@radix-ui/react-toggle-group` ^1.1.11 — roving tabindex for GlassSegmentedControl
- `@radix-ui/react-dialog` ^1.1.15 — focus trap, portal, scroll lock for GlassModal/GlassAlert
- `@radix-ui/react-popover` ^1.1.15 — anchor positioning, outside-click dismiss for GlassPopover
- Inline styles + TypeScript `const` design tokens (`APPLE_SPACING`, `APPLE_RADII`, `APPLE_CONTROL_SIZES`) — existing project convention, required for prop-driven glass parameterization
- SF Pro via `-apple-system` system font stack — only legal approach; Apple prohibits web embedding

**Explicit avoid:** CSS `backdrop-filter` for glass effects (double-blur over WebGPU pipeline), Tailwind CSS, styled-components, `framer-motion` (deprecated), React Spring (no layout animations), React Router (single-page showcase needs anchor scroll only), any external icon library, any external web font.

### Expected Features

Apple's Liquid Glass enforces a strict navigation-layer-only rule: glass belongs on controls that float above content, never on content cells, list rows, or full-screen backgrounds. Two material variants exist (`.regular` adaptive, `.clear` media-rich only). Interactive controls must implement touch-point illumination via a `vec2f touchPosition` uniform passed to the glass shader. See `.planning/research/FEATURES.md` for full details including Apple HIG specifications per control.

**Must have (table stakes) — P1 v4.0 launch:**
- GlassButton (update) — `.glass`/`.glassProminent` styles, shimmer from touch point, spring press; foundation for all other controls
- GlassToggle — glass-lens capsule thumb, spring snap with overshoot; most recognizable Apple control
- GlassSlider — momentum preservation, stretch at min/max boundaries, thumbless variant; high differentiation from CSS alternatives
- GlassSegmentedControl — opaque container + glass-material thumb sliding between segments; container is NOT glass (common mistake)
- GlassTabBar — scroll-minimize behavior, item cluster grouping; most-recognized iOS 26 surface
- GlassNavigationBar — button cluster grouping, bold left-aligned titles, push transition
- GlassActionSheet — button-to-sheet morph; most distinctively iOS 26 behavior; requires GlassEffectContainer
- GlassSheet (update existing GlassPanel) — concentric corner radius, remove custom backgrounds, compact/expanded adaptation
- GlassAlert — completes modal family, low cost, high perceived completeness
- GlassSearchBar — capsule input with inactive/active states; expected in any app showcase
- GlassToolbar — same button-cluster pattern as navigation bar

**Should have (competitive differentiators) — P2 v4.x:**
- GlassFloatingActionButton — expand-to-radial-menu morph; demonstrated explicitly at WWDC25
- GlassContextMenu — long-press morph with content preview
- GlassMediaControls — play/pause button group with shared GlassEffectContainer blending
- GlassProgressBar — trivial after GlassSlider (thumbless variant)
- GlassPopover — anchored overlay, spawns from source element in iOS 26
- GlassNotificationBanner — compact pill to card morph

**Defer (v5+):**
- GlassTextField — keyboard avoidance, validation states; not pure showcase material
- GlassDatePicker — high gesture complexity, niche for web
- Mouse-position-as-light-source gyroscope analog
- CSS-only fallback mode (explicitly out of scope)

**Critical anti-features:** glass on content cells, stacked glass (sampling glass), fully opaque tinting everywhere, CSS blur-only glass (defeats WebGPU pipeline), custom modal corner radius overrides.

### Architecture Approach

v4.0 is strictly additive. The `GlassProvider`/`GlassRenderer`/`useGlassRegion` triad is unchanged. New controls are thin functional wrappers around existing primitives: a `GlassToggle` renders `GlassPanel` (track) + `GlassButton` (thumb); a `GlassSlider` renders `GlassPanel` (track) + `GlassPanel` (fill) + CSS-only thumb. Controls never call `useGlassRegion` directly — they compose primitives, which self-register GPU regions. This ensures accessibility preferences, morph defaults, and future primitive changes propagate automatically. See `.planning/research/ARCHITECTURE.md` for full details.

**Major components:**
1. `src/components/controls/` — New functional controls composing GlassPanel/GlassButton; each exported from `src/index.ts`
2. `GlassEffectContainer` — New coordination primitive enabling shared sampling namespace for morphing transitions (ActionSheet, FAB, ContextMenu)
3. `src/hooks/useOverlayPosition.ts` — New hook for anchor-relative positioning shared by GlassModal and GlassPopover
4. `src/showcase/` — ShowcasePage, TuningDrawer, section components; NOT exported from `index.ts` (app code, not library)
5. `ShowcasePage` / `TuningDrawer` — Showcase app shell; TuningDrawer is always-mounted, hidden via CSS transform to preserve tuning state

The GPU region budget is the critical scaling constraint: `MAX_GLASS_REGIONS = 16` (hard cap in `GlassRenderer.ts`, uniform buffer allocated at `17 * 256 = 4352 bytes`). Mitigation: `IntersectionObserver`-based section virtualization (mount section children only when within one viewport of scroll position) or raising `MAX_GLASS_REGIONS` to 32 (one-line change in `GlassRenderer.ts` plus matching buffer allocation update). State management is deliberately minimal — each showcase section holds its own `useState`; no global store; only `tuningDrawerOpen: boolean` is page-level shared state.

### Critical Pitfalls

See `.planning/research/PITFALLS.md` for full details including recovery strategies, phase mapping, and "looks done but isn't" checklist.

1. **MAX_GLASS_REGIONS exceeded silently (C1)** — Beyond 16 simultaneous glass regions, controls corrupt unallocated uniform buffer memory with no error. Add `addRegion()` guard before building any showcase content; if the showcase needs more than 16 regions simultaneously, raise the cap and update the buffer allocation in the same commit. Address in Phase 1.

2. **Glass mask lag on interactive controls (C4)** — When a control's DOM geometry changes during interaction (toggle thumb sliding, slider drag), the glass mask updates one rAF frame later, causing visible misalignment at 60FPS. Prevention: register one glass region on the stable outer container; animate inner elements with CSS-only transforms, never give the draggable slider thumb its own glass region. Address in Phase 2 before each control ships.

3. **Accessibility contract broken by direct `handle.updateXxx()` calls (C6)** — Direct calls from event handlers bypass `useGlassRegion`'s `reducedTransparency` guard. All glass parameter updates must flow through props into `useGlassRegion`'s `useEffect`. Follow the exact `GlassButton` pattern: compute `effectiveBlur`, `effectiveSpecular`, `effectiveRim` from state and pass as props. Address throughout Phase 2.

4. **Showcase page as kitchen sink (C8)** — Building the showcase incrementally produces a component grid with no narrative. Plan the showcase's information architecture as a product landing page before writing code: hero section, feature highlights in context, interactive demo, developer section. Address in Phase 3 before any showcase layout code is written.

5. **Per-control parameter fragility on non-reference backgrounds (C3)** — v3.0 tuned parameters are optimized for the bundled wallpaper. Each new control needs independently tuned defaults because the ratio of rim area to interior area differs at different control sizes. Do not inherit panel defaults directly. Address in Phase 2 visual tuning step per control.

## Implications for Roadmap

The dependency graph is bottom-up and maps cleanly to a 4-phase v4.0 structure followed by a v4.x P2 controls phase. The GPU region budget constraint is the highest-priority cross-cutting concern and must be resolved in Phase 1 before any controls are built.

### Phase 1: Foundation and Safety Rails

**Rationale:** Three architectural decisions must be made before any control is implemented. Getting these wrong mid-implementation requires restructuring multiple components. They are low-cost upfront but expensive to fix retroactively.
**Delivers:** `addRegion()` guard with warning/sentinel return; `GlassEffectContainer` coordination primitive design (spike); `useOverlayPosition` hook; `IntersectionObserver` section virtualization wrapper; design token constants (`APPLE_SPACING`, `APPLE_RADII`, `APPLE_CONTROL_SIZES` in `src/showcase/tokens.ts`); `motion` and required `@radix-ui/*` dependencies installed and version-locked; region budget audit for the planned showcase layout.
**Addresses:** Region budget constraint (C1), showcase layout safety (C2), animation dependency decision
**Avoids:** Silent rendering corruption, glass misalignment in scroll containers, mid-implementation structural rewrites

### Phase 2: Core Independent Controls (Layer 1)

**Rationale:** Layer 1 controls have no inter-control dependencies — each composes only the existing Layer 0 primitives. Building them in this phase validates the composition pattern and fills the most-expected showcase slots before tackling high-complexity navigation and overlay controls.
**Delivers:** GlassButton update (`.glass`/`.glassProminent`, shimmer, spring press), GlassToggle, GlassSlider, GlassSegmentedControl — each with independent visual tuning against Apple reference, accessibility audit (`axe-core` + keyboard-only interaction test), and reduced-transparency validation.
**Uses:** `motion` spring animations; `@radix-ui/react-switch`, `@radix-ui/react-slider`, `@radix-ui/react-toggle-group`; Glass Primitive Composition pattern; Controlled Component Interface pattern
**Avoids:** Glass lag on interactive controls (C4), accessibility regression (C6), per-control parameter fragility (C3)

### Phase 3: Navigation and Overlay Controls (Layer 2)

**Rationale:** GlassTabBar, GlassNavigationBar, and GlassActionSheet are higher-complexity controls that depend on Phase 2 patterns being stable. GlassActionSheet requires GlassEffectContainer (Phase 1). Overlay controls (GlassModal, GlassSheet update, GlassAlert, GlassSearchBar, GlassToolbar) require the portal pattern and `useOverlayPosition` from Phase 1. These controls complete the P1 control catalog.
**Delivers:** Full P1 control set; GlassTabBar with scroll-minimize behavior; GlassActionSheet morph animation; GlassSheet with concentric corner radius; GlassAlert, GlassSearchBar, GlassToolbar.
**Uses:** `@radix-ui/react-dialog`, `@radix-ui/react-popover`; Overlay Portal pattern; GlassEffectContainer
**Avoids:** Glass-on-glass stacking artifact, custom corner radius overrides (anti-feature)

### Phase 4: Showcase Page (Layers 3-5)

**Rationale:** The showcase page depends on all P1 controls being complete. It must be designed as a product landing page (not a component grid) to avoid the kitchen-sink failure mode. The TuningDrawer wraps the existing tuning UI — the tuning UI is preserved, not deleted.
**Delivers:** `ShowcasePage` with hero section, contextual control demonstrations, interactive demo, developer section (install command, GitHub link); `TuningDrawer` slide-in panel; anchor-based navigation; `IntersectionObserver` section virtualization active; performance benchmarked at <5ms shader time on throttled GPU profile.
**Addresses:** Showcase IA (C8), cognitive overload (C5), mobile GPU performance (C7)
**Avoids:** React Router dependency, global state store, mounting all sections at page load, deleting the existing tuning page

### Phase 5: P2 Controls and Polish (v4.x)

**Rationale:** GlassFloatingActionButton, GlassContextMenu, and GlassMediaControls require GlassEffectContainer to be proven stable with the P1 controls before adding more morphing complexity. These are the "wow factor" differentiators that elevate the library once the catalog is complete.
**Delivers:** GlassFloatingActionButton expand-to-radial morph, GlassContextMenu long-press morph, GlassMediaControls play/pause group, GlassProgressBar (thumbless slider variant), GlassNotificationBanner pill-to-card morph, GlassPopover.
**Uses:** GlassEffectContainer (proven from Phases 1 and 3), staggered spring animations with `motion`

### Phase Ordering Rationale

- Phase 1 before all others: the `MAX_GLASS_REGIONS` guard and design tokens must exist before any control allocates regions or hardcodes pixel values; GlassEffectContainer must be designed before controls that depend on it
- Phase 2 before Phase 3: navigation controls (TabBar, NavBar) visually demonstrate rows of Phase 2 controls; validating toggles and sliders first confirms the region topology pattern works at scale
- GlassActionSheet (Phase 3) requires GlassEffectContainer (Phase 1) — enforces Phase 1 completeness as a hard prerequisite
- Showcase (Phase 4) deliberately last: a showcase demonstrating broken or incomplete controls is worse than no showcase; all P1 controls must pass accessibility and visual audits before the showcase is assembled
- P2 controls (Phase 5) after the showcase proves the architecture at scale

### Research Flags

Phases needing deeper research during planning:
- **Phase 3 (GlassTabBar):** Scroll-minimize behavior specification is MEDIUM confidence — exact minimization trigger threshold and spring animation curve need iOS Simulator observation before implementation; consider a `/gsd:research-phase` spike
- **Phase 3 (GlassActionSheet morph):** GlassEffectContainer web equivalent has no established precedent in the community; the architecture for shared sampling namespace is architecturally novel — needs a design spike in Phase 1 before committing to implementation
- **Phase 4 (Showcase IA):** The information architecture document should be treated as a design deliverable, not an engineering task — needs wireframe review before code; consider `/gsd:research-phase` or a dedicated design step

Phases with standard, well-documented patterns (skip `/gsd:research-phase`):
- **Phase 1 (dependencies):** `motion` and `@radix-ui/*` integration is fully documented with official examples; no ambiguity
- **Phase 2 (independent controls):** GlassToggle, GlassSlider, GlassSegmentedControl have clear WWDC25 specifications (HIGH confidence) and the Glass Primitive Composition pattern is established
- **Phase 2 (accessibility):** Radix primitives handle WAI-ARIA; the `asChild` + glass wrapper integration is straightforward

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | npm versions verified 2026-03-25; `motion` import path confirmed from official docs; Radix compatibility with React 19 confirmed; all alternatives rigorously evaluated |
| Features | HIGH (catalog) / MEDIUM (dimensions) | P1 control catalog from WWDC25 official transcripts; exact pixel measurements (toggle 51×31px, slider track 4px, segmented height 32px) from community reference implementations, not official Apple numerical spec |
| Architecture | HIGH | Derived directly from live codebase read of GlassRenderer.ts, useGlassRegion.ts, GlassButton.tsx; region budget is exact; all component boundaries and data flows verified |
| Pitfalls | HIGH (GPU/React) / MEDIUM (design/UX) | C1-C4, C6-C7 from source code analysis and WebGPU spec; C5, C8 from NNGroup/Infinum usability research and community audit |

**Overall confidence:** HIGH

### Gaps to Address

- **Exact iOS control dimensions:** Apple's HIG portal is JavaScript-gated and could not be rendered. Toggle (51×31px), slider track (4px), segmented height (32px) are from community reference implementations. Validate against iOS Simulator at 1x logical resolution before finalizing design tokens in Phase 1.
- **GlassEffectContainer web equivalent:** Apple's SwiftUI `GlassEffectContainer` ensures multiple glass elements share a sampling region. The web equivalent is architecturally novel in this project. Needs a design spike in Phase 1 before implementation of GlassActionSheet.
- **MAX_GLASS_REGIONS actual showcase count:** The exact count of simultaneous glass regions on the showcase primary view is unknown until the showcase layout is designed. The decision to raise the cap to 32 (or use virtualization, or both) must be made in Phase 1 after a region audit of the planned layout.
- **GlassTabBar scroll-minimize trigger threshold:** MEDIUM confidence on the exact scroll offset and spring parameters. Needs iOS Simulator observation.

## Sources

### Primary (HIGH confidence)
- Project source: `src/renderer/GlassRenderer.ts`, `src/hooks/useGlassRegion.ts`, `src/components/GlassButton.tsx`, `src/components/GlassPanel.tsx` — region budget (MAX_GLASS_REGIONS = 16, UNIFORM_STRIDE = 256), accessibility contract (reducedTransparency guard pattern), interaction state pattern
- `.planning/PROJECT.md` — v4.0 milestone goals and key architecture decisions
- WWDC25 session 219 "Meet Liquid Glass" — https://developer.apple.com/videos/play/wwdc2025/219/
- WWDC25 session 284 "Build a UIKit app with the new design" — UISwitch, UISlider, UISegmentedControl specifications
- WWDC25 session 356 "Get to know the new design system" — shape types, action sheets, scroll edge effects
- WWDC25 session 323 "Build a SwiftUI app with the new design" — FAB pattern, GlassEffectContainer
- Apple Newsroom: "Apple introduces a delightful and elegant new software design" — https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/
- npm registry (direct query, 2026-03-25) — `motion` 12.38.0, all `@radix-ui/*` versions verified
- motion.dev/docs/react — official Motion v12 React docs, `motion/react` import path
- radix-ui.com/primitives/docs — WAI-ARIA roles, keyboard behavior per component

### Secondary (MEDIUM confidence)
- Donny Wals: Exploring tab bars on iOS 26 with Liquid Glass — https://www.donnywals.com/exploring-tab-bars-on-ios-26-with-liquid-glass/
- Donny Wals: Designing custom UI with Liquid Glass on iOS 26 — https://www.donnywals.com/designing-custom-ui-with-liquid-glass-on-ios-26/
- DEV: Understanding GlassEffectContainer in iOS 26 — https://dev.to/arshtechpro/understanding-glasseffectcontainer-in-ios-26-2n8p
- NNGroup: Liquid Glass Is Cracked and Usability Suffers — https://www.nngroup.com/articles/liquid-glass/
- Infinum: Apple's iOS 26 Liquid Glass — Sleek, Shiny, and Questionably Accessible — contrast ratio audit (1.5:1 found in beta)
- iOS 26.4 "Reduce Bright Effects" — 9to5Mac — confirms touch-point illumination is significant enough for user-controlled toggle
- Fatbobman: Grow on iOS 26 — real-world implementation notes on sheets and scroll edge
- LiquidGlassReference GitHub (conorluddy) — community reference for GlassEffectContainer constraints

### Tertiary (LOW confidence)
- Apple HIG exact pixel measurements for toggle (51×31), slider (4px), segmented (32px) — sourced from community reference implementations; official numerical spec not publicly accessible (JS-gated HIG portal)

---
*Research completed: 2026-03-25*
*Ready for roadmap: yes*

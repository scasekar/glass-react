# Roadmap: LiquidGlass-React-WASM

## Overview

This roadmap delivers a React component library implementing Apple's Liquid Glass aesthetic through a hybrid C++/WASM + WebGPU architecture. The journey follows a strict dependency chain: first proving that C++ can render to a GPU texture that JavaScript can sample (the architectural bet), then building the procedural background engine, bridging it to React, implementing glass refraction shaders, wrapping them in React components, adding accessibility and visual polish, and finally packaging for npm distribution with a showcase demo. The 8 phases reflect genuine technical dependencies -- the WASM pipeline must exist before the engine, the engine before the bridge, the bridge before shaders, and shaders before components.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Engine Foundation** - Emscripten build pipeline and proof-of-concept GPU device sharing between C++ and JavaScript
- [x] **Phase 2: Background Rendering** - Procedural noise simulation running in C++ at 60FPS as a full-canvas animated background
- [x] **Phase 3: GPU Texture Bridge** - Zero-copy texture sharing and synchronized render pipeline between WASM engine and React
- [x] **Phase 4: Glass Shader Core** - WGSL refraction and frosted glass shaders that sample the background texture through glass UI regions
- [x] **Phase 5: React Component API** - GlassPanel, GlassButton, GlassCard components with configurable props and GlassProvider context
- [x] **Phase 6: Accessibility & Theming** - Reduced-motion, reduced-transparency, WCAG contrast, and dark/light mode adaptation
- [x] **Phase 7: Visual Polish** - Chromatic aberration, specular highlights, rim lighting, refraction modes, and morphing transitions
- [x] **Phase 8: Library Packaging & Demo** - npm-publishable package with demo page and API documentation

## Phase Details

### Phase 1: Engine Foundation
**Goal**: C++ code compiles to WASM via Emscripten, initializes WebGPU, and shares a GPU device with JavaScript -- proving the core architectural bet
**Depends on**: Nothing (first phase)
**Requirements**: BUILD-01, BUILD-02, BUILD-03, BUILD-04, BRIDGE-01
**Research flag**: NEEDS RESEARCH -- Emscripten + emdawnwebgpu device sharing is cutting-edge with sparse documentation
**Success Criteria** (what must be TRUE):
  1. Running `emcmake cmake` and `make` produces a .wasm binary and .js glue file without errors
  2. Vite dev server loads the WASM module and the browser console confirms WebGPU device acquisition
  3. A minimal C++ function renders a solid color to a GPUTexture, and JavaScript code on the same page reads that texture and displays the color on a canvas -- proving shared device access
  4. Changing C++ source code triggers Vite hot-reload and the updated WASM loads without manual browser refresh
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md -- C++ engine source and CMake build configuration with emdawnwebgpu
- [x] 01-02-PLAN.md -- Vite + React scaffold, WASM loading, hot-reload, and browser verification

### Phase 2: Background Rendering
**Goal**: A procedural noise animation runs in C++ at 60FPS, rendering an animated full-canvas background to a WebGPU texture
**Depends on**: Phase 1
**Requirements**: ENGINE-01, ENGINE-02, ENGINE-03, ENGINE-04
**Research flag**: STANDARD PATTERNS -- Perlin/simplex noise and render loops are well-documented
**Success Criteria** (what must be TRUE):
  1. Opening the dev page shows a full-canvas animated procedural noise background running smoothly (no visible stuttering or frame drops)
  2. The C++ engine exposes init(), update(), getTexture(), and resize() functions callable from JavaScript
  3. Resizing the browser window causes the background to smoothly adapt to the new canvas dimensions without crashes, distortion, or black frames
  4. DevTools Performance panel confirms the animation holds 60FPS on target hardware
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md -- C++ BackgroundEngine class with simplex noise WGSL shader, render pipeline, and Embind API
- [x] 02-02-PLAN.md -- Full-viewport canvas, ResizeObserver integration, and visual verification

### Phase 3: GPU Texture Bridge
**Goal**: The C++ engine's background texture is consumable by React components via zero-copy GPU sharing with proper lifecycle management
**Depends on**: Phase 2
**Requirements**: BRIDGE-02, BRIDGE-03, BRIDGE-04
**Research flag**: NEEDS RESEARCH -- React + WebGPU lifecycle integration patterns are non-standard
**Success Criteria** (what must be TRUE):
  1. A React component can bind the C++ engine's background texture as a sampled texture in its own render pipeline without copying data between CPU and GPU
  2. Unmounting and remounting the React app (or navigating away and back) cleans up all GPU resources without memory leaks -- verified via WebGPU error scoping and DevTools memory timeline
  3. The background animation and React UI rendering stay synchronized at 60FPS with no visible tearing or frame-skip artifacts
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md -- Two-pass C++ render architecture (noise to offscreen texture, blit to surface)
- [x] 03-02-PLAN.md -- React lifecycle management with destroyEngine and human verification

### Phase 4: Glass Shader Core
**Goal**: WGSL shaders produce a convincing glass refraction effect by sampling the background texture at distorted UVs with configurable blur, opacity, and rounded corners
**Depends on**: Phase 3
**Requirements**: GLASS-01, GLASS-02, GLASS-03, GLASS-04, GLASS-05
**Success Criteria** (what must be TRUE):
  1. A rectangular region on the canvas shows the background visibly refracted/distorted through it -- the distortion is clearly different from the surrounding unmodified background
  2. Increasing the blur intensity parameter produces a progressively frosted appearance; setting it to zero shows sharp refraction only
  3. Adjusting the opacity parameter smoothly transitions the glass region between fully transparent (invisible) and fully opaque (solid tint)
  4. The glass region renders with rounded corners and smooth, anti-aliased edges -- no visible jaggies or hard pixelated borders at any size
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md -- Glass WGSL shader and C++ pipeline integration replacing blit pass
- [x] 04-02-PLAN.md -- Embind API, TypeScript types, React integration, and visual verification

### Phase 5: React Component API
**Goal**: Developers can use GlassPanel, GlassButton, and GlassCard as React components with familiar props to place glass UI elements in their applications
**Depends on**: Phase 4
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-05
**Success Criteria** (what must be TRUE):
  1. Wrapping an app in `<GlassProvider>` initializes WebGPU and the WASM engine automatically -- no manual setup code required
  2. Rendering `<GlassPanel>`, `<GlassButton>`, and `<GlassCard>` each shows a glass-effect UI element refracting the procedural background
  3. Passing blur, opacity, cornerRadius, and tint props to any glass component visibly changes its appearance in real-time without page reload
  4. TypeScript autocomplete in an IDE shows all available props with types and JSDoc descriptions for every glass component
**Plans**: 2 plans

Plans:
- [x] 05-01-PLAN.md -- Multi-region C++ engine with dynamic uniform buffer offsets and Embind API
- [x] 05-02-PLAN.md -- React GlassProvider, hooks, GlassPanel/GlassButton/GlassCard components, and visual verification

### Phase 6: Accessibility & Theming
**Goal**: Glass components respect user accessibility preferences and adapt to dark/light mode automatically
**Depends on**: Phase 5
**Requirements**: A11Y-01, A11Y-02, A11Y-03, A11Y-04
**Success Criteria** (what must be TRUE):
  1. With prefers-reduced-transparency enabled in OS settings, glass components render as near-opaque surfaces instead of transparent -- content behind them is not visible
  2. With prefers-reduced-motion enabled in OS settings, the animated procedural background freezes to a static state
  3. Text rendered on top of any glass component meets WCAG 2.1 AA contrast ratio (4.5:1 minimum) in both light and dark modes
  4. Switching the OS between dark mode and light mode causes glass components to adapt their tint/appearance without any code changes
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md -- C++ engine setPaused/setReducedTransparency methods, useAccessibilityPreferences hook, and GlassContext/Provider a11y wiring
- [x] 06-02-PLAN.md -- Dark/light mode tint adaptation, reduced-transparency overrides, contrast-safe text styles, and visual verification

### Phase 7: Visual Polish
**Goal**: Glass components gain premium visual effects -- chromatic aberration, specular highlights, rim lighting, multiple refraction modes, and smooth morphing transitions
**Depends on**: Phase 5 (Phase 6 is not a dependency -- polish and accessibility are independent)
**Requirements**: GLASS-06, GLASS-07, GLASS-08, GLASS-09, GLASS-10
**Research flag**: NEEDS RESEARCH -- Chromatic aberration and rim lighting shader techniques need investigation
**Success Criteria** (what must be TRUE):
  1. Enabling chromatic aberration on a glass component produces visible RGB color fringing at edges, with adjustable intensity
  2. A specular highlight is visible on glass components as a bright reflection spot from a static light source
  3. Glass component edges show a subtle rim lighting glow that distinguishes them from the background
  4. Switching between "standard" and "prominent" refraction modes produces visually distinct glass appearances
  5. Changing a glass component's state (e.g., hover, active, size) triggers a smooth morphing animation rather than an instant snap
**Plans**: 2 plans

Plans:
- [x] 07-01-PLAN.md -- Expose shader effects as adjustable props (aberration, specular, rim) and add refraction modes (standard/prominent)
- [x] 07-02-PLAN.md -- CPU-side exponential decay lerp for morphing transitions, GlassButton hover/active states, and demo update

### Phase 8: Library Packaging & Demo
**Goal**: The library is installable via npm and a demo page showcases every glass component and effect with interactive controls
**Depends on**: Phase 6, Phase 7
**Requirements**: BUILD-05, DEMO-01, DEMO-02, DEMO-03
**Success Criteria** (what must be TRUE):
  1. Running `npm install liquidglass-react` (or the chosen package name) in a fresh project and importing GlassProvider + components works without additional setup beyond a WebGPU-capable browser
  2. The demo page displays all glass components (Panel, Button, Card) with the procedural background, and every visual effect (blur, refraction, chromatic aberration, specular, rim lighting) is visible
  3. Interactive controls on the demo page allow adjusting glass parameters (blur, opacity, tint, aberration intensity, refraction mode) and the glass components update in real-time
  4. API documentation covers all public components, their props, types, and usage examples
**Plans**: 2 plans

Plans:
- [x] 08-01-PLAN.md -- Library packaging: SINGLE_FILE WASM, barrel export, Vite library mode, package.json npm config
- [x] 08-02-PLAN.md -- Demo page with interactive controls, API documentation, and human verification

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8
(Phases 6 and 7 can execute in parallel after Phase 5; Phase 8 depends on both.)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Engine Foundation | 2/2 | Complete | 2026-02-10 |
| 2. Background Rendering | 2/2 | Complete | 2026-02-10 |
| 3. GPU Texture Bridge | 2/2 | Complete | 2026-02-10 |
| 4. Glass Shader Core | 2/2 | Complete | 2026-02-10 |
| 5. React Component API | 2/2 | Complete | 2026-02-10 |
| 6. Accessibility & Theming | 2/2 | Complete | 2026-02-10 |
| 7. Visual Polish | 2/2 | Complete | 2026-02-10 |
| 8. Library Packaging & Demo | 2/2 | Complete | 2026-02-10 |

# Requirements: LiquidGlass-React-WASM

**Defined:** 2026-02-10
**Core Value:** Glass components that look and feel like Apple's Liquid Glass — refraction of a dynamic background through UI elements must be visually convincing at 60FPS.

## v1 Requirements

### Build Pipeline

- [ ] **BUILD-01**: C++ engine compiles to WASM via Emscripten with WebGPU support
- [ ] **BUILD-02**: emdawnwebgpu bindings integrated and functional
- [ ] **BUILD-03**: CMake build system with `emcmake` produces .wasm + .js glue
- [ ] **BUILD-04**: Vite dev server loads and hot-reloads WASM module
- [ ] **BUILD-05**: Library publishable to npm with .wasm assets included

### Background Engine

- [ ] **ENGINE-01**: Procedural noise simulation runs in C++ at 60FPS
- [ ] **ENGINE-02**: Full-canvas background rendering to WebGPU texture
- [ ] **ENGINE-03**: Engine exposes `init()`, `update()`, `getTexture()`, `resize()` API
- [ ] **ENGINE-04**: Canvas resize handled without crashes or distortion

### GPU Texture Bridge

- [ ] **BRIDGE-01**: Single shared GPUDevice between C++ engine and React UI
- [ ] **BRIDGE-02**: Zero-copy texture sharing — C++ renders, JS samples same GPUTexture
- [ ] **BRIDGE-03**: Proper GPU resource lifecycle (no leaks, clean teardown)
- [ ] **BRIDGE-04**: Render pipeline synchronization at 60FPS

### Glass Visual Effects

- [ ] **GLASS-01**: Background refraction/distortion via WGSL fragment shader
- [ ] **GLASS-02**: Frosted glass blur with configurable intensity
- [ ] **GLASS-03**: Configurable opacity/transparency per component
- [ ] **GLASS-04**: Rounded corners via SDF or clip
- [ ] **GLASS-05**: Anti-aliased edges on glass components
- [ ] **GLASS-06**: Chromatic aberration effect with adjustable intensity
- [ ] **GLASS-07**: Specular highlights from static light source
- [ ] **GLASS-08**: Edge rim lighting effect
- [ ] **GLASS-09**: Multiple refraction modes (standard, prominent)
- [ ] **GLASS-10**: Morphing transitions between glass states

### React Components

- [ ] **COMP-01**: GlassProvider context wrapper initializes WebGPU + WASM engine
- [ ] **COMP-02**: GlassPanel component with glass refraction effect
- [ ] **COMP-03**: GlassButton component with glass refraction effect
- [ ] **COMP-04**: GlassCard component with glass refraction effect
- [ ] **COMP-05**: Components accept style props (blur, opacity, cornerRadius, tint)

### Accessibility

- [ ] **A11Y-01**: Respects prefers-reduced-transparency (falls back to opaque)
- [ ] **A11Y-02**: Respects prefers-reduced-motion (disables animated background)
- [ ] **A11Y-03**: Text on glass meets WCAG 2.1 AA contrast ratio (4.5:1)
- [ ] **A11Y-04**: Dark/light mode adaptation via CSS media queries

### Demo & Documentation

- [ ] **DEMO-01**: Full demo page showcasing all glass components
- [ ] **DEMO-02**: Demo includes interactive controls for glass parameters
- [ ] **DEMO-03**: API documentation for all public components and props

## v2 Requirements

### Interaction

- **INTER-01**: Pointer/mouse-driven specular response
- **INTER-02**: Gyroscope/device tilt interaction
- **INTER-03**: 3D tilt on hover effect

### Advanced Features

- **ADV-01**: Nested glass (child components sample parent glass output)
- **ADV-02**: Content-blur mode (frosted glass over DOM content)
- **ADV-03**: Multiple simulation modes (noise, fluid, custom)
- **ADV-04**: Video refraction

## Out of Scope

| Feature | Reason |
|---------|--------|
| WebGL fallback | WebGPU-only is the value proposition; doubles shader work |
| Server-side rendering | WebGPU is client-only |
| CSS-only glassmorphism mode | Defeats purpose of GPU pipeline |
| Non-WebGPU browser support | Target modern browsers only |
| Mobile gyroscope | Deferred to v2 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUILD-01 | Phase 1 | Pending |
| BUILD-02 | Phase 1 | Pending |
| BUILD-03 | Phase 1 | Pending |
| BUILD-04 | Phase 1 | Pending |
| BUILD-05 | Phase 8 | Pending |
| ENGINE-01 | Phase 2 | Pending |
| ENGINE-02 | Phase 2 | Pending |
| ENGINE-03 | Phase 2 | Pending |
| ENGINE-04 | Phase 2 | Pending |
| BRIDGE-01 | Phase 1 | Pending |
| BRIDGE-02 | Phase 3 | Pending |
| BRIDGE-03 | Phase 3 | Pending |
| BRIDGE-04 | Phase 3 | Pending |
| GLASS-01 | Phase 4 | Pending |
| GLASS-02 | Phase 4 | Pending |
| GLASS-03 | Phase 4 | Pending |
| GLASS-04 | Phase 4 | Pending |
| GLASS-05 | Phase 4 | Pending |
| GLASS-06 | Phase 7 | Pending |
| GLASS-07 | Phase 7 | Pending |
| GLASS-08 | Phase 7 | Pending |
| GLASS-09 | Phase 7 | Pending |
| GLASS-10 | Phase 7 | Pending |
| COMP-01 | Phase 5 | Pending |
| COMP-02 | Phase 5 | Pending |
| COMP-03 | Phase 5 | Pending |
| COMP-04 | Phase 5 | Pending |
| COMP-05 | Phase 5 | Pending |
| A11Y-01 | Phase 6 | Pending |
| A11Y-02 | Phase 6 | Pending |
| A11Y-03 | Phase 6 | Pending |
| A11Y-04 | Phase 6 | Pending |
| DEMO-01 | Phase 8 | Pending |
| DEMO-02 | Phase 8 | Pending |
| DEMO-03 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 33 total
- Mapped to phases: 33
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-10*
*Last updated: 2026-02-10 after initial definition*

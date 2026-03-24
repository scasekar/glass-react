# Requirements: LiquidGlass-React-WASM v3.0

**Defined:** 2026-03-24
**Core Value:** Glass components that look and feel like Apple's Liquid Glass — visually convincing refraction at 60FPS, now with a pluggable architecture where any C++ WebGPU engine can provide the background texture.

## v3.0 Requirements

### Device & Engine

- [ ] **DEV-01**: JS creates GPUDevice via navigator.gpu.requestAdapter/requestDevice before WASM initialization
- [ ] **DEV-02**: JS injects GPUDevice into C++ WASM engine via importJsDevice/initWithExternalDevice pattern
- [ ] **DEV-03**: C++ engine renders only background (noise/image) to offscreen texture — all glass shader code removed
- [ ] **DEV-04**: C++ exposes scene texture handle via getSceneTextureHandle() for JS consumption
- [ ] **DEV-05**: JS owns the requestAnimationFrame render loop — emscripten_set_main_loop removed, C++ becomes call-driven

### Glass Pipeline

- [ ] **GLASS-01**: WGSL glass shader ported verbatim from C++ glass.wgsl.h to JS-loaded module (no algorithmic changes)
- [ ] **GLASS-02**: GPURenderPipeline created with explicit bind group layouts (not layout:'auto') for multi-region texture sharing
- [ ] **GLASS-03**: Per-region uniform buffers with 256-byte dynamic offset stride, written via device.queue.writeBuffer()
- [ ] **GLASS-04**: JS-owned canvas context configured with GPU.getPreferredCanvasFormat()
- [ ] **GLASS-05**: Bind groups invalidated and recreated when C++ recreates offscreen texture on resize

### React Integration

- [ ] **REACT-01**: GlassContext and GlassRegionHandle internals re-backed by JS GlassRenderer class
- [ ] **REACT-02**: Public React API unchanged — GlassPanel, GlassButton, GlassCard props identical to v2.0
- [ ] **REACT-03**: All 16 shader parameters functional as typed React props through JS pipeline
- [ ] **REACT-04**: Accessibility features preserved (reduced-motion, reduced-transparency, WCAG contrast, dark/light mode)

### Visual Validation

- [ ] **VIS-01**: Re-tune presets against iOS Simulator ground truth using coordinate-descent pipeline
- [ ] **VIS-02**: Automated diff confirms convergence against iOS reference (not v2.0 baseline)

### Tuning Page

- [ ] **PAGE-01**: Dev tuning page redesigned using frontend-design + ui-ux-pro-max skills
- [ ] **PAGE-02**: All existing tuning features preserved (sliders, presets, JSON import/export, URL params)

## Future Requirements

### Pluggability

- **PLUG-01**: Typed BackgroundEngine TypeScript interface for pluggable C++ engines
- **PLUG-02**: Zero-arg glass pipeline — externalTexture prop support without WASM
- **PLUG-03**: Integration with sc/scTarsiusWeb engine

### Resilience

- **RES-01**: GPUDevice loss recovery — recreate adapter, device, and all resources on loss
- **RES-02**: Graceful fallback when WebGPU unavailable

### Showcase

- **SHOW-01**: Production showcase/landing page (beyond dev tuning tool)

## Out of Scope

| Feature | Reason |
|---------|--------|
| sc engine integration | Architecture supports it; integration deferred to later milestone |
| Showcase/landing page | Deferred until after re-tuning validated |
| Device loss recovery | v3.x follow-on; architecture enables it but not required for migration |
| Zero-arg pipeline (no WASM) | v3.x follow-on; pluggable interface deferred |
| Gyroscope/device tilt interaction | Deferred — get architecture right first |
| Content-blur mode | Requires additional compositor |
| WebGL fallback | WebGPU-only is the value proposition |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEV-01 | — | Pending |
| DEV-02 | — | Pending |
| DEV-03 | — | Pending |
| DEV-04 | — | Pending |
| DEV-05 | — | Pending |
| GLASS-01 | — | Pending |
| GLASS-02 | — | Pending |
| GLASS-03 | — | Pending |
| GLASS-04 | — | Pending |
| GLASS-05 | — | Pending |
| REACT-01 | — | Pending |
| REACT-02 | — | Pending |
| REACT-03 | — | Pending |
| REACT-04 | — | Pending |
| VIS-01 | — | Pending |
| VIS-02 | — | Pending |
| PAGE-01 | — | Pending |
| PAGE-02 | — | Pending |

**Coverage:**
- v3.0 requirements: 18 total
- Mapped to phases: 0
- Unmapped: 18

---
*Requirements defined: 2026-03-24*
*Last updated: 2026-03-24 after initial definition*

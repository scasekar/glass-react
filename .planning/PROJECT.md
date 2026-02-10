# LiquidGlass-React-WASM

## What This Is

A React component library implementing Apple's "Liquid Glass" visual aesthetic using a shared WebGPU context between a C++20/WASM background engine and React UI components. The C++ engine renders procedural noise/fluid simulations to a GPU texture, and React glass components sample that texture through refraction/reflection shaders to create a polished, premium glass effect.

## Core Value

Glass components that look and feel like Apple's Liquid Glass — the refraction of a dynamic background through UI elements must be visually convincing and performant at 60FPS.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] C++ background engine compiled to WASM via Emscripten with WebGPU rendering
- [ ] Procedural noise/fluid simulation running as full-canvas background
- [ ] Zero-copy texture sharing between WASM engine and React components
- [ ] Glass refraction/reflection WGSL shaders for UI components
- [ ] GlassButton, GlassPanel, GlassCard React components
- [ ] Morphing transitions between glass states
- [ ] Full demo page showcasing all glass components
- [ ] Specular highlights (static light source for v1)
- [ ] npm-publishable package structure

### Out of Scope

- Gyroscope/device tilt interaction — deferred to v2, get static visuals right first
- Content-blur mode (frosted glass over page content) — v2, procedural backgrounds only for v1
- Server-side rendering — WebGPU is client-only
- Fallback for non-WebGPU browsers — target modern browsers only for v1

## Context

- Target aesthetic: Apple's Liquid Glass design language (WWDC 2025)
- Architecture: C++ engine renders base texture to GPU → React components receive texture handle → custom WGSL pipeline composites glass UI on top, sampling base texture for refraction
- Triple purpose: component library for own app, open-source package, and portfolio/demo piece
- WebGPU is the graphics API (not WebGL) — newer, more capable, but narrower browser support
- Emscripten provides the C++→WASM compilation toolchain with WebGPU bindings (dawn)

## Constraints

- **Graphics API**: WebGPU only — no WebGL fallback, simplifies architecture
- **Build toolchain**: Emscripten for C++→WASM compilation
- **C++ standard**: C++20 minimum
- **React version**: React 19+
- **Performance**: 60FPS target for background + glass compositing
- **v1 interaction**: Static lighting only — pointer/gyro interaction deferred

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| WebGPU over WebGL | Modern API with compute shaders, better texture sharing, future-proof | — Pending |
| C++/WASM for background engine | Performance-critical fluid sim benefits from native-speed computation | — Pending |
| Procedural background only for v1 | Simpler architecture, content-blur requires additional compositor complexity | — Pending |
| Static visuals for v1 | Focus on getting the glass effect right before adding interaction | — Pending |

---
*Last updated: 2026-02-10 after initialization*

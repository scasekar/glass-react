# LiquidGlass-React-WASM

## What This Is

A React component library implementing Apple's "Liquid Glass" visual aesthetic using a shared WebGPU context between a C++20/WASM background engine and React UI components. The C++ engine renders either procedural simplex noise or a loaded image to a GPU texture via a two-pass architecture, and React glass components (GlassPanel, GlassButton, GlassCard) sample that texture through refraction/blur/tint shaders with premium visual effects including chromatic aberration, specular highlights, rim lighting, and smooth morphing transitions.

## Current Milestone: v2.0 Visual Parity

**Goal:** Achieve pixel-level visual parity with Apple's native Liquid Glass by adding image backgrounds, exposing all shader parameters, building a live tuning UI, creating a native iOS reference app for comparison, and automating screenshot-based visual diffing to converge on matching parameters.

**Target features:**
- Image background mode (load photo as background texture, keep noise as option)
- Expose all glass shader uniforms as tweakable React props
- Live controls panel in demo app for real-time shader parameter tuning
- SwiftUI reference app (separate repo) with same wallpaper + glass panel + rounded element, targeting iPhone 16 Pro Simulator
- Automated screenshot capture and pixel-diff comparison against iOS Simulator reference
- Auto-iteration loop: adjust shader params → capture → diff → repeat until converged
- Bundled default wallpaper image shipped with the library

## Core Value

Glass components that look and feel like Apple's Liquid Glass — the refraction of a dynamic background through UI elements must be visually convincing and performant at 60FPS.

## Requirements

### Validated

- ✓ C++ background engine compiled to WASM via Emscripten with WebGPU rendering — v1.0
- ✓ Procedural noise simulation running as full-canvas background at 60FPS — v1.0
- ✓ Zero-copy texture sharing between WASM engine and React components — v1.0
- ✓ Glass refraction/blur WGSL shaders for UI components — v1.0
- ✓ GlassPanel, GlassButton, GlassCard React components with GlassProvider — v1.0
- ✓ Chromatic aberration, specular highlights, rim lighting effects — v1.0
- ✓ Morphing transitions between glass states — v1.0
- ✓ Accessibility (reduced-motion, reduced-transparency, WCAG contrast, dark/light mode) — v1.0
- ✓ npm-publishable package with embedded WASM and interactive demo — v1.0

### Active

- [ ] Image background mode as alternative to procedural noise
- [ ] All glass shader parameters exposed as React component props
- [ ] Live controls UI in demo app for real-time shader tuning
- [ ] SwiftUI reference app with glass panel + rounded element on same wallpaper
- [ ] Automated screenshot-based visual diffing against iOS Simulator reference
- [ ] Auto-tuning loop to converge shader params toward Apple's Liquid Glass look
- [ ] Bundled default wallpaper image

### Out of Scope

- Gyroscope/device tilt interaction — deferred to v2, get static visuals right first
- Content-blur mode (frosted glass over page content) — v2, procedural backgrounds only for v1
- Server-side rendering — WebGPU is client-only
- WebGL fallback — WebGPU-only is the value proposition; doubles shader work
- CSS-only glassmorphism mode — defeats purpose of GPU pipeline
- Non-WebGPU browser support — target modern browsers only

## Context

Shipped v1.0 with 2,727 LOC across C++, TypeScript, and WGSL.
Tech stack: React 19, Vite 6.4, Emscripten 4.0.16, emdawnwebgpu, C++20, WebGPU.
Architecture: C++ engine renders simplex noise to offscreen texture → glass shader samples with refraction/blur → multi-region rendering with dynamic uniform buffer offsets → React components track DOM positions via rAF.
Package: ESM bundle with SINGLE_FILE embedded WASM (~674KB), peer dependency on React ^18/^19.

## Constraints

- **Graphics API**: WebGPU only — no WebGL fallback, simplifies architecture
- **Build toolchain**: Emscripten for C++→WASM compilation
- **C++ standard**: C++20 minimum
- **React version**: React 18+ (peer dependency)
- **Performance**: 60FPS target for background + glass compositing
- **Interaction**: Static lighting only — pointer/gyro interaction deferred
- **Reference device**: iPhone 16 Pro Simulator for visual comparison
- **Reference app**: Separate directory (not inside glass-react repo)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| WebGPU over WebGL | Modern API with compute shaders, better texture sharing, future-proof | ✓ Good — enabled zero-copy texture sharing |
| C++/WASM for background engine | Performance-critical noise sim benefits from native-speed computation | ✓ Good — 60FPS achieved with headroom |
| Procedural background only for v1 | Simpler architecture, content-blur requires additional compositor complexity | ✓ Good — clean separation of concerns |
| Static visuals for v1 | Focus on getting the glass effect right before adding interaction | ✓ Good — shipped polished static effects |
| emdawnwebgpu over raw Dawn | Header-only C++ bindings, simpler build via `--use-port` | ✓ Good — clean integration |
| AllowSpontaneous callbacks for device init | Double WaitAny corrupts emdawnwebgpu Instance reference | ✓ Good — critical discovery, resolved device init |
| Two-pass render (noise → glass) | Glass shader replaces blit pass, samples offscreen texture | ✓ Good — single texture, no extra copy |
| Multi-region via dynamic uniform buffer offsets | Supports up to 16 glass regions without pipeline recreation | ✓ Good — efficient GPU instancing |
| SINGLE_FILE WASM embedding | Eliminates separate .wasm file distribution complexity | ✓ Good — single JS import, ~674KB |
| Exponential decay lerp for morphing | Frame-rate independent transitions, works with reduced-motion | ✓ Good — smooth transitions at any FPS |
| useSyncExternalStore for a11y preferences | Concurrent-safe media query detection without useEffect race conditions | ✓ Good — stable React 18/19 compatible |
| GlassProvider owns canvas element | Removes canvas from index.html, component controls full lifecycle | ✓ Good — clean encapsulation |
| Image + noise background modes | Users need real images for visual parity comparison; noise stays as option | — Pending |
| Separate Xcode project for reference | Keep iOS reference app outside glass-react repo to avoid polluting npm package | — Pending |
| Automated visual diffing | Screenshot capture + pixel diff enables objective convergence toward Apple's look | — Pending |

---
*Last updated: 2026-02-25 after v2.0 milestone start*

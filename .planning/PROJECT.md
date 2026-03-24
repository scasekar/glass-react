# LiquidGlass-React-WASM

## What This Is

A React component library implementing Apple's "Liquid Glass" visual aesthetic using a shared WebGPU context between a C++20/WASM background engine and React UI components. The C++ engine renders either procedural simplex noise or a loaded image to a GPU texture via a two-pass architecture, and React glass components (GlassPanel, GlassButton, GlassCard) sample that texture through refraction/blur/tint shaders with premium visual effects including chromatic aberration, specular highlights, rim lighting, and smooth morphing transitions. Includes a full visual parity toolchain: SwiftUI reference app, automated screenshot diffing, and coordinate-descent tuning loop for converging toward Apple's native Liquid Glass appearance.

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
- ✓ Image background mode with sRGB-correct pipeline as alternative to procedural noise — v2.0
- ✓ All glass shader parameters (contrast, saturation, Fresnel, env reflection, glare, blur) exposed as typed React props — v2.0
- ✓ Live tuning UI with grouped sliders, presets (Clear Light/Dark), JSON import/export — v2.0
- ✓ SwiftUI reference app rendering `.clear` glass variant for iOS visual comparison — v2.0
- ✓ Automated screenshot-based visual diffing (Playwright + iOS Simulator + pixelmatch) — v2.0
- ✓ Coordinate-descent auto-tuning loop to converge shader params toward Apple's Liquid Glass — v2.0
- ✓ Bundled default wallpaper image — v2.0

### Active

(None — planning next milestone)

### Out of Scope

- Gyroscope/device tilt interaction — deferred, get static visuals right first
- Content-blur mode (frosted glass over page content) — requires additional compositor
- Server-side rendering — WebGPU is client-only
- WebGL fallback — WebGPU-only is the value proposition; doubles shader work
- CSS-only glassmorphism mode — defeats purpose of GPU pipeline
- Non-WebGPU browser support — target modern browsers only
- Physical device reference screenshots — iOS 26 `.glassEffect()` renders dark on device (confirmed bug)

## Context

Shipped v2.0 with ~18K lines changed across C++, TypeScript, WGSL, and Swift.
Tech stack: React 19, Vite 6.4, Emscripten 4.0.16, emdawnwebgpu, C++20, WebGPU, Playwright, pixelmatch.
Architecture: C++ engine renders noise or image to offscreen texture → glass shader samples with refraction/blur/Fresnel/env reflection → multi-region rendering with dynamic uniform buffer offsets → React components track DOM positions via rAF.
Tuning toolchain: Playwright captures web screenshots, xcrun simctl captures iOS Simulator, sRGB normalization + pixelmatch diffing with ROI masking, coordinate-descent optimizer.
Package: ESM bundle with SINGLE_FILE embedded WASM, peer dependency on React ^18/^19.

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
| Image + noise background modes | Users need real images for visual parity comparison; noise stays as option | ✓ Good — sRGB pipeline works correctly |
| Separate Xcode project for reference | Keep iOS reference app outside glass-react repo to avoid polluting npm package | ✓ Good — clean separation |
| Automated visual diffing | Screenshot capture + pixel diff enables objective convergence toward Apple's look | ✓ Good — measurable convergence achieved |
| JS image decode + C++ upload | Leverage browser's image decoding; avoids bundling stb_image in WASM | ✓ Good — smaller WASM, sRGB-correct |
| Embind free functions for image API | uintptr_t support for WASM heap pixel transfer | ✓ Good — clean JS→C++ bridge |
| Fresnel as additive specular layer | Physics-based edge reflection on top of existing specular, not replacement | ✓ Good — visually accurate |
| Chrome channel for Playwright WebGPU | Bundled Chromium lacks GPU; system Chrome with --enable-gpu flags works | ✓ Good — reliable headless captures |
| Coordinate descent with tint decomposition | Tint split into 3 independent axes for per-channel optimization | ✓ Good — converges efficiently |

---
*Last updated: 2026-03-24 after v2.0 milestone completion*

# Features Research: LiquidGlass-React-WASM

## Competitive Landscape

Existing glass-effect libraries analyzed:
- **liquid-glass-react** (rdev) — WebGL-based, multiple refraction modes, chromatic aberration
- **liquid-glass-js** (dashersw) — WebGL 2.0, edge refraction, rim lighting, nested glass
- **liquidGL** (naughtyduk) — WebGL, beveled edges, specular highlights, 3D tilt
- **GlassyUI-Components** — CSS-only glassmorphism, no GPU acceleration

**Key insight:** All existing libraries use WebGL or CSS. None use WebGPU. None use C++/WASM for the background engine. This is a genuine differentiator.

## Table Stakes (Must Have)

| Feature | Complexity | Dependencies |
|---------|-----------|-------------|
| Background refraction/distortion | High | Background texture, WGSL fragment shader |
| Frosted glass blur | Medium | Gaussian blur in shader or compute pass |
| Configurable blur intensity | Low | Shader uniform |
| Configurable opacity/transparency | Low | Shader uniform |
| Border radius / rounded corners | Low | SDF or clip in shader |
| Anti-aliased edges | Medium | SDF-based edge smoothing |
| Dark/light mode adaptation | Low | CSS variables + shader tint uniform |
| prefers-reduced-transparency support | Low | CSS media query, fallback to opaque |

## Differentiators (Competitive Advantage)

| Feature | Complexity | Dependencies |
|---------|-----------|-------------|
| Real-time procedural background (C++/WASM) | High | Emscripten pipeline, WebGPU compute |
| Zero-copy GPU texture sharing | High | Shared GPUDevice, texture architecture |
| Chromatic aberration | Medium | Per-channel refraction offset in shader |
| Specular highlights (static light) | Medium | Normal map + light position uniform |
| Edge rim lighting | Medium | SDF edge detection + highlight |
| Morphing transitions between states | High | Animated SDF or interpolated uniforms |
| Multiple refraction modes | Medium | Shader variants |
| Nested glass (child samples parent) | High | Multi-pass rendering, texture chain |
| 60FPS with multiple glass components | High | Efficient GPU pipeline, batching |

## Anti-Features (Do NOT Build for v1)

| Feature | Reason |
|---------|--------|
| Gyroscope/tilt interaction | Deferred to v2, get static visuals right first |
| Content-blur (frosted glass over DOM) | Requires DOM capture, html2canvas dependency, performance killer |
| WebGL fallback | Doubles shader work, WebGPU-only is the value proposition |
| CSS-only glassmorphism mode | Defeats the purpose of the GPU pipeline |
| 3D tilt on hover | Interaction deferred to v2 |
| Video refraction | Complex, out of scope |

## Accessibility Considerations

- `prefers-reduced-transparency: reduce` — increase opacity to near-opaque
- `prefers-reduced-motion: reduce` — disable animated backgrounds
- Ensure text on glass meets WCAG 2.1 AA contrast (4.5:1)
- Glass components must have visible borders/outlines for discoverability
- Support `prefers-color-scheme` for dark/light tint adaptation

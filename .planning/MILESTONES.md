# Milestones

## v3.0 Architecture Redesign (Shipped: 2026-03-25)

**Phases completed:** 5 phases (15-19), 14 plans

**Delivered:** Full architectural redesign — JS/WebGPU owns the glass shader pipeline while C++/WASM only handles background rendering. Plano-convex dome refraction matching Apple's Liquid Glass water-droplet effect.

**Key accomplishments:**
1. Flipped device ownership: JS creates GPUDevice, passes to C++ via importJsDevice (60% WASM binary reduction)
2. GlassRenderer TypeScript class with explicit bind group layouts, dynamic offset uniform buffer, 27 unit tests
3. React integration preserved: same GlassPanel/GlassButton/GlassCard API, all 16 shader params, accessibility
4. Plano-convex dome refraction via Snell's law — pow4 depth curve, SDF gradient surface normals, edge-focused displacement matching iOS
5. Tuning page redesigned with design tokens, SectionAccordion, preset chips, Copy URL
6. Visual validation pipeline updated for new architecture

---

## v2.0 Visual Parity (Shipped: 2026-03-24)

**Phases completed:** 6 phases (9-14), 13 plans
**Files changed:** 90 files, +15,393 / -2,084 lines
**Git range:** 75 commits (2026-02-10 → 2026-03-01)

**Delivered:** Image background rendering, full shader parameter exposure, SwiftUI reference app for iOS visual comparison, live tuning UI with presets, automated screenshot-diff pipeline, and coordinate-descent tuning loop for converging toward Apple's native Liquid Glass.

**Key accomplishments:**
1. Image background engine with sRGB-correct pipeline (RGBA8UnormSrgb textures, linear shader math)
2. 7 new shader parameters exposed as typed React props (contrast, saturation, Fresnel IOR/exponent, env reflection, glare direction, blur radius)
3. SwiftUI reference app with `.clear` glass variant, capture script producing pixel-identical screenshots
4. Live tuning UI with 16 parameter sliders, grouped sections, presets (Clear Light/Dark), JSON import/export
5. Screenshot diff pipeline: Playwright web capture + iOS Simulator capture + sRGB normalization + pixelmatch with ROI masking
6. Automated coordinate-descent tuning loop minimizing visual diff against iOS reference

**Known Gaps:**
- REF-01, REF-02, REF-03: SwiftUI reference requirements unchecked in REQUIREMENTS.md (functionality delivered in Phase 11 but checkboxes not updated)

---

## v1.0 MVP (Shipped: 2026-02-10)

**Phases completed:** 8 phases, 16 plans
**Lines of code:** 2,727 (C++/TypeScript/WGSL)
**Git range:** `feat(engine)` → `feat(08-02)` (25 commits)

**Delivered:** A React component library implementing Apple's Liquid Glass aesthetic through a C++/WASM + WebGPU hybrid architecture, with procedural noise backgrounds, glass refraction shaders, and npm-publishable packaging.

**Key accomplishments:**
1. C++ WebGPU engine with Emscripten build pipeline and AllowSpontaneous device initialization
2. Procedural simplex noise background rendering at 60FPS with two-pass architecture
3. Zero-copy GPU texture bridge between C++ engine and React with proper lifecycle management
4. Glass refraction shaders (SDF masking, 9-tap Gaussian blur, barrel distortion, tint compositing)
5. React component library (GlassProvider, GlassPanel, GlassButton, GlassCard) with multi-region rendering
6. Accessibility support (reduced-motion, reduced-transparency, WCAG AA contrast, dark/light mode)
7. Visual polish: chromatic aberration, specular highlights, rim lighting, morphing transitions
8. npm-publishable ESM package with embedded WASM (SINGLE_FILE) and interactive demo app

---


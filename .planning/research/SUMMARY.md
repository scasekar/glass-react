# Project Research Summary

**Project:** LiquidGlass-React-WASM
**Domain:** React Component Library with GPU-accelerated Graphics
**Researched:** 2026-02-10
**Confidence:** HIGH

## Executive Summary

LiquidGlass-React-WASM is a React component library that delivers GPU-accelerated glassmorphism effects using a hybrid C++/WASM + TypeScript architecture. The core technical innovation is a C++ background engine (compiled to WASM via Emscripten) that renders procedural animated backgrounds using WebGPU, sharing textures zero-copy with React components that apply real-time refraction shaders. This architecture is inspired by how Figma uses C++/WASM for performance-critical rendering while maintaining a JavaScript UI layer.

The recommended approach prioritizes getting the foundational GPU device sharing working before anything else — this is the critical architecture decision that makes or breaks the entire system. Build in strict dependency order: Emscripten pipeline first, then WebGPU device creation and C++/JS sharing, then the background engine, then React integration, and finally polish features like chromatic aberration and edge lighting. The primary risk is ASYNCIFY binary bloat (80%+ size increase), mitigated by limiting instrumented functions and using streaming instantiation.

This is a genuine market differentiator. All existing glass-effect libraries (liquid-glass-react, liquid-glass-js, liquidGL) use WebGL or CSS-only approaches. None use WebGPU. None use C++/WASM for the background engine. The value proposition is superior visual quality and performance at the cost of browser compatibility (WebGPU is Chrome/Safari 26+/Firefox 141+).

## Key Findings

### Recommended Stack

The stack is built around Emscripten 5.x for C++ to WASM compilation, targeting WebGPU via emdawnwebgpu (Dawn's official bindings). On the frontend, React 19+ with TypeScript 5.x and Vite 6+ provides the component layer. The build uses CMake 3.22+ with emcmake for the C++ side and tsup for the TypeScript library packaging.

**Core technologies:**
- **Emscripten 5.x + emdawnwebgpu**: Compiles C++ to WASM with WebGPU bindings — official Dawn bindings replace unmaintained USE_WEBGPU flag
- **C++20 + ASYNCIFY**: Modern C++ for background engine with async device initialization — ASYNCIFY enables synchronous C++ code to call async browser APIs
- **React 19 + TypeScript 5**: Component framework and type safety — industry standard for UI libraries
- **Vite 6 + vite-plugin-wasm**: Fast bundler with WebAssembly ESM integration — replaces slower Webpack
- **WGSL (plain)**: Shader language for refraction effects — no preprocessor needed, standardized syntax
- **CMake + tsup**: Dual build system for C++ and TypeScript — CMake for WASM, tsup for library packaging

**Critical stack decisions:**
- **Use emdawnwebgpu, NOT -sUSE_WEBGPU**: The built-in flag is unmaintained and being removed
- **ASYNCIFY trade-off**: Increases binary size ~80% but necessary for device init — mitigate with ASYNCIFY_ONLY
- **No WebGL fallback**: WebGPU-only is the value proposition, doubling shader work defeats the purpose

### Expected Features

The competitive landscape shows all existing libraries use WebGL or CSS-only approaches. This creates a clear opportunity for differentiation through WebGPU + C++/WASM. Feature research reveals a split between table stakes (basic glass effects expected by users) and competitive differentiators (unique capabilities enabled by the architecture).

**Must have (table stakes):**
- Background refraction/distortion — core glass effect, users expect this
- Frosted glass blur with configurable intensity — essential for glassmorphism aesthetic
- Configurable opacity/transparency — users need control over effect strength
- Border radius and anti-aliased edges — modern UI expectation
- Dark/light mode adaptation — accessibility and design system integration
- prefers-reduced-transparency support — accessibility requirement

**Should have (competitive advantages):**
- Real-time procedural background (C++/WASM) — unique selling point over static backgrounds
- Zero-copy GPU texture sharing — architectural enabler for performance
- Chromatic aberration — visual polish, seen in high-end glass libraries
- Specular highlights and edge rim lighting — realistic glass appearance
- Multiple refraction modes — flexibility for different visual styles
- 60FPS with multiple glass components — performance promise

**Defer (v2+):**
- Gyroscope/tilt interaction — get static visuals right first
- Content-blur over DOM — requires html2canvas, performance killer
- WebGL fallback — doubles shader work, contradicts value proposition
- 3D tilt on hover — interaction deferred to v2

**Accessibility non-negotiables:**
- prefers-reduced-transparency increases opacity to near-opaque
- prefers-reduced-motion disables animated backgrounds
- WCAG 2.1 AA contrast (4.5:1) for text on glass
- Visible borders/outlines for component discoverability

### Architecture Approach

The architecture revolves around a single shared GPUDevice used by both the C++ WASM engine and the React/TypeScript layer. This is non-negotiable — WebGPU does not support cross-device texture sharing. The recommended pattern (Approach A) has JavaScript create the device and pass it to C++ via `emscripten_webgpu_import_device()`, making JS the lifecycle owner while C++ acts as a "renderer service."

**Major components:**
1. **BackgroundEngine (C++)** — owns noise/fluid simulation, renders to GPUTexture with RENDER_ATTACHMENT + TEXTURE_BINDING usage, exposes init/update/getTexture/resize API via Embind
2. **Bridge Layer (TypeScript)** — WebGPUContext singleton manages device/queue, WASMBridge loads module and marshals device handle, TextureProvider React context provides background texture to children
3. **Component Layer (React)** — GlassProvider wraps app and initializes WebGPU + WASM, GlassCanvas owns render loop, GlassPanel/GlassButton/GlassCard consume texture context and apply refraction shaders

**Render pipeline:**
Per frame, C++ engine updates the fluid simulation and renders to backgroundTexture (RENDER_ATTACHMENT). Then JS compositing pass binds backgroundTexture as sampled texture and draws fullscreen quads with refraction shaders for each glass component, sampling at distorted UVs. Finally, output to canvas swap chain texture and present.

**Critical dependencies:**
The build order is strictly enforced: Emscripten pipeline must work before anything else, then WebGPU device creation, then C++ background engine, then texture sharing bridge, then React WebGPU context, then glass shaders, then React components, finally demo page. Attempting to parallelize these phases will fail.

### Critical Pitfalls

Research identified 8 pitfalls across criticality levels. The top 5 that directly impact roadmap planning:

1. **GPU Device Sharing Failure (CRITICAL)** — If C++ and JS create separate devices, textures cannot be shared, causing fundamental architecture failure with no workaround. Must establish device sharing pattern in Phase 1, verify with simple "render solid color in C++, sample in JS" before adding complexity.

2. **ASYNCIFY Binary Size Explosion (HIGH)** — Enabling ASYNCIFY can increase WASM binary 80% (10MB → 18MB), bloating download and slowing startup. Mitigate with ASYNCIFY_ONLY to limit instrumented functions, use emscripten_set_main_loop for render loop instead of ASYNCIFY, consider wasm-opt optimization and streaming instantiation.

3. **WASM Signature Mismatch → GPU Crashes (HIGH)** — Incorrect types passed to WASM functions that forward to WebGPU cause GPU driver crashes with no useful errors. Use strongly-typed Embind bindings (not raw extern "C"), validate all parameters at JS/WASM boundary, test incrementally with WebGPU validation enabled.

4. **Buffer/Texture Per-Frame Allocation (MEDIUM)** — Creating new GPUBuffers or GPUTextures every frame causes memory leaks and GC pressure. Pre-allocate uniform buffers at init and reuse via writeBuffer(), use double/triple buffering for dynamic data, create background texture once and resize only on canvas resize.

5. **React Re-renders Disrupting GPU Pipeline (MEDIUM)** — React state changes can destroy/recreate canvas elements or WebGPU contexts, breaking the render pipeline. Use useRef for canvas element (never let React control canvas DOM), initialize WebGPU context in useEffect with proper cleanup, run render loop via requestAnimationFrame outside React's render cycle, separate GPU state (refs) from React state.

**Additional considerations:**
- Browser compatibility: WebGPU ships in Chrome, Firefox 141+, Safari 26+, but implementations differ (Safari has 256MB buffer limit, Firefox macOS requires Apple Silicon)
- Canvas resize handling: ResizeObserver with debouncing, recreate swap chain configuration
- WASM loading latency: Use WebAssembly.instantiateStreaming (1.8x faster), show loading indicator, optimize binary with wasm-opt

## Implications for Roadmap

Based on research, the roadmap must follow strict dependency order with no parallelization of foundational phases. The architecture is fragile during bootstrapping — GPU device sharing, WASM loading, and texture bridging must be 100% solid before building features on top.

### Phase 1: Engine Foundation

**Rationale:** Nothing works without the C++ → WASM → WebGPU pipeline. This is the most critical phase — if device sharing fails here, the entire project fails. Build the skeleton that proves C++ can render to a GPUTexture that JS can sample.

**Delivers:**
- Emscripten build pipeline with CMake + emcmake
- WebGPU device creation in JavaScript
- Device handle passed to C++ via emscripten_webgpu_import_device()
- Minimal C++ BackgroundEngine that renders solid color to GPUTexture
- Proof-of-concept JS sampler that reads the C++ texture
- Streaming WASM instantiation with loading indicator

**Addresses features:**
- Zero-copy GPU texture sharing (differentiator)
- Foundation for real-time procedural background

**Avoids pitfalls:**
- P2 (GPU Device Sharing Failure) — verified with simple test before complexity
- P1 (ASYNCIFY bloat) — ASYNCIFY_ONLY limits instrumentation
- P3 (Signature mismatch) — Embind bindings enforced from start
- P8 (WASM loading latency) — streaming instantiation implemented early

**Research flag:** NEEDS RESEARCH — Complex Emscripten + WebGPU integration, sparse documentation on device sharing patterns. Use `/gsd:research-phase` for Embind + emscripten_webgpu_import_device() specifics.

### Phase 2: Background Rendering

**Rationale:** With device sharing proven, implement the actual procedural background. This is the visual differentiator but depends entirely on Phase 1 infrastructure. Keep it simple (Perlin noise or animated gradients) to validate the architecture before adding complexity.

**Delivers:**
- C++ noise/fluid simulation (basic Perlin or simplex noise)
- Animated background texture updated per frame
- C++ engine.update(dt) API for time-based animation
- Proper texture usage flags (RENDER_ATTACHMENT + TEXTURE_BINDING)
- ResizeObserver integration with debounced C++ resize() calls

**Uses stack:**
- C++20 for simulation code
- WGSL for background rendering shaders
- emscripten_set_main_loop for render loop

**Implements architecture:**
- BackgroundEngine component with init/update/getTexture/resize API

**Avoids pitfalls:**
- P4 (Per-frame allocation) — texture created once, reused
- P7 (Canvas resize) — ResizeObserver + debouncing pattern established

**Research flag:** STANDARD PATTERNS — Noise algorithms and render loops are well-documented. Skip research-phase, use standard Perlin/simplex implementations.

### Phase 3: React WebGPU Bridge

**Rationale:** Bridge the WASM engine to React's lifecycle. This phase makes the background consumable by React components. Must handle React's re-render behavior without disrupting GPU pipeline.

**Delivers:**
- WebGPUContext singleton managing GPUDevice and GPUQueue
- WASMBridge TypeScript wrapper for C++ engine
- TextureProvider React context exposing background texture
- GlassProvider component initializing WebGPU + WASM
- GlassCanvas component owning the canvas element and render loop
- Proper cleanup in useEffect hooks

**Addresses features:**
- Foundation for all React glass components

**Avoids pitfalls:**
- P5 (React re-renders) — useRef for canvas, GPU state in refs not state, render loop outside React cycle

**Research flag:** NEEDS RESEARCH — React + WebGPU lifecycle integration patterns are non-standard. Use `/gsd:research-phase` for best practices on WebGPU context management in React.

### Phase 4: Glass Shader Core

**Rationale:** Implement the actual glass effect shaders that consume the background texture. This is the user-facing visual result. Start with basic refraction before adding chromatic aberration or lighting.

**Delivers:**
- WGSL fragment shader sampling background texture at distorted UVs
- Basic Gaussian blur for frosted glass effect
- Configurable blur intensity and opacity via uniforms
- Border radius via SDF or clip in shader
- Anti-aliased edges via SDF smoothing
- Uniform buffer management (pre-allocated, reused)

**Addresses features:**
- Background refraction/distortion (table stakes)
- Frosted glass blur (table stakes)
- Configurable blur intensity (table stakes)
- Configurable opacity (table stakes)
- Border radius and anti-aliased edges (table stakes)

**Avoids pitfalls:**
- P4 (Per-frame allocation) — uniform buffers pre-allocated, written via writeBuffer()

**Research flag:** STANDARD PATTERNS — Gaussian blur and refraction shaders are well-documented in WebGPU samples. Skip research-phase.

### Phase 5: React Component API

**Rationale:** Wrap the shaders in user-friendly React components. This is the public API surface. Design for composability and TypeScript ergonomics.

**Delivers:**
- GlassPanel component with props for blur, opacity, borderRadius
- GlassButton and GlassCard variants
- TypeScript types for all props
- Prop validation and sensible defaults
- Component bounds passed to shaders via uniform buffers

**Addresses features:**
- Complete table stakes feature set
- Foundation for dark/light mode and accessibility

**Avoids pitfalls:**
- P5 (React re-renders) — components designed to minimize re-render impact on GPU

**Research flag:** STANDARD PATTERNS — React component design is well-understood. Skip research-phase.

### Phase 6: Accessibility & Theming

**Rationale:** Non-negotiable accessibility features and theming support. Must be done before public release.

**Delivers:**
- prefers-reduced-transparency media query increasing opacity
- prefers-reduced-motion disabling animated backgrounds
- Dark/light mode adaptation via CSS variables + shader tint
- WCAG 2.1 AA contrast validation for text on glass
- Visible borders/outlines for discoverability

**Addresses features:**
- Dark/light mode adaptation (table stakes)
- prefers-reduced-transparency support (table stakes)
- All accessibility considerations from feature research

**Research flag:** STANDARD PATTERNS — Accessibility media queries and WCAG are well-documented. Skip research-phase.

### Phase 7: Visual Polish

**Rationale:** Differentiator features that leverage the GPU pipeline. These are "nice to have" enhancements that can be added incrementally without architectural risk.

**Delivers:**
- Chromatic aberration via per-channel refraction offset
- Specular highlights with static light position uniform
- Edge rim lighting via SDF edge detection
- Multiple refraction modes as shader variants

**Addresses features:**
- Chromatic aberration (differentiator)
- Specular highlights (differentiator)
- Edge rim lighting (differentiator)
- Multiple refraction modes (differentiator)

**Research flag:** NEEDS RESEARCH — Chromatic aberration and rim lighting implementation details sparse. Use `/gsd:research-phase` for shader techniques.

### Phase 8: Library Packaging & Demo

**Rationale:** Make the library consumable by external projects and showcase all features.

**Delivers:**
- tsup build outputting CJS + ESM
- Custom WASM asset copying to dist/
- TypeScript declaration files
- Demo page showcasing all glass components
- Documentation site with usage examples

**Uses stack:**
- tsup for library packaging
- Vite for demo page

**Research flag:** STANDARD PATTERNS — TypeScript library packaging is well-documented. Skip research-phase.

### Phase Ordering Rationale

**Why this order:**
- **Phases 1-3 cannot be reordered** — strict dependencies: WASM pipeline → device sharing → React integration
- **Phase 4 depends on Phase 3** — shaders need texture from bridge
- **Phase 5 depends on Phase 4** — components wrap shaders
- **Phases 6-8 are parallel-izable** — accessibility, polish, and packaging are independent

**Why this grouping:**
- **Engine Foundation (1-2)** groups C++ concerns
- **Bridge (3)** isolates integration layer
- **React Layer (4-5)** groups component concerns
- **Polish (6-7)** separates "must have" from "nice to have"
- **Release (8)** is final integration

**How this avoids pitfalls:**
- Phase 1 validates P2 (device sharing) before committing to architecture
- Phases 1-2 establish P4 (allocation) patterns early
- Phase 3 enforces P5 (React re-renders) before components exist
- Progressive complexity prevents P3 (signature mismatch) debugging hell

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 1 (Engine Foundation)** — Emscripten + WebGPU device sharing is cutting-edge, sparse documentation, needs `/gsd:research-phase` for emscripten_webgpu_import_device() and JsValStore patterns
- **Phase 3 (React WebGPU Bridge)** — React + WebGPU lifecycle integration is non-standard, needs `/gsd:research-phase` for context management best practices
- **Phase 7 (Visual Polish)** — Chromatic aberration and rim lighting shader techniques need `/gsd:research-phase` for implementation details

**Phases with standard patterns (skip research-phase):**
- **Phase 2 (Background Rendering)** — Perlin/simplex noise algorithms well-documented
- **Phase 4 (Glass Shader Core)** — Gaussian blur and refraction are standard WebGPU patterns
- **Phase 5 (React Component API)** — React component design is well-understood
- **Phase 6 (Accessibility & Theming)** — Media queries and WCAG are standardized
- **Phase 8 (Library Packaging)** — TypeScript library tooling is mature

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Emscripten + emdawnwebgpu is official path (verified via Dawn docs), Vite + tsup is industry standard, C++20 and React 19 are stable |
| Features | HIGH | Competitive analysis covered 4 major glass libraries, table stakes vs differentiators clearly delineated, accessibility requirements from WCAG spec |
| Architecture | HIGH | Shared GPUDevice pattern verified as WebGPU requirement, render pipeline based on Figma's public talks about C++/WASM + WebGPU architecture |
| Pitfalls | MEDIUM-HIGH | ASYNCIFY bloat and device sharing documented in Emscripten issues/forums, React + WebGPU patterns inferred from community examples (less official guidance) |

**Overall confidence:** HIGH

The stack and architecture confidence is very high — these are based on official documentation (Emscripten, WebGPU spec, emdawnwebgpu) and proven patterns (Figma's architecture). Features confidence is high due to thorough competitive analysis. Pitfalls confidence is slightly lower for React-specific integration patterns, which rely more on community best practices than official guidance.

### Gaps to Address

**Gaps identified during research:**

- **Embind vs JsValStore for device passing** — Architecture research mentions both mechanisms but doesn't specify which is preferred. Need to validate during Phase 1 planning which API is more stable/ergonomic. Address via Phase 1 research-phase.

- **ASYNCIFY_ONLY function list** — Stack research recommends limiting ASYNCIFY instrumentation but doesn't specify exact function list for adapter/device requests. Need to identify minimal set during Phase 1 implementation. Document in implementation notes.

- **Safari 256MB buffer limit impact** — Pitfalls research notes Safari has Metal-imposed buffer limits but doesn't quantify whether this affects the background texture use case. Test on Safari during Phase 1 and document any necessary texture size constraints.

- **React render loop outside component lifecycle** — Architecture suggests requestAnimationFrame outside React's render cycle but doesn't detail the exact pattern. Phase 3 research-phase should investigate whether to use useLayoutEffect, useEffect with cleanup, or a separate singleton manager.

- **Chromatic aberration shader implementation** — Phase 7 feature but no specific WGSL code examples found. Research-phase in Phase 7 planning should look for WebGPU shader samples or port from WebGL implementations.

- **Browser testing matrix** — Pitfalls identify Chrome/Safari/Firefox differences but don't specify minimum versions beyond "Safari 26+, Firefox 141+". During Phase 1, establish CI testing matrix with specific versions (Chrome Canary, Safari Technology Preview, Firefox Nightly).

## Sources

### Primary (HIGH confidence)
- Emscripten Documentation — Emscripten 5.x compilation, ASYNCIFY, emscripten_set_main_loop, emcmake
- emdawnwebgpu GitHub & Docs — Official Dawn WebGPU bindings, device import/export APIs
- WebGPU Specification (W3C) — Texture usage flags, device creation, render pipeline
- MDN Web Docs — WebGPU browser compatibility, WGSL syntax
- React Documentation — React 19 hooks, context API, useEffect lifecycle
- Vite Documentation — vite-plugin-wasm configuration, ESM integration

### Secondary (MEDIUM confidence)
- Figma Blog (Evan Wallace) — C++/WASM + WebGPU architecture patterns at scale
- liquid-glass-react, liquid-glass-js, liquidGL — Competitive analysis, WebGL approaches
- Emscripten GitHub Issues — ASYNCIFY binary size, optimization techniques
- WebGPU Samples Repository — Gaussian blur shaders, texture sampling patterns

### Tertiary (LOW confidence, needs validation)
- Reddit r/webgpu — React + WebGPU integration anecdotes
- Stack Overflow — emscripten_webgpu_import_device() usage examples (sparse)
- Twitter/X @chairmanglb (Brandon Jones) — WebGPU browser implementation details

---
*Research completed: 2026-02-10*
*Ready for roadmap: yes*

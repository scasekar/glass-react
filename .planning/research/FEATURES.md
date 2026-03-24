# Feature Research: v3.0 JS WebGPU Glass Pipeline

**Domain:** JS/WebGPU owned glass shader pipeline — pluggable overlay library over C++/WASM background engine
**Researched:** 2026-03-24
**Confidence:** HIGH (architecture is well-defined from PROJECT.md + existing codebase; WebGPU API patterns are stable and verified against MDN/toji.dev)

---

## Context: What This Milestone Is

v3.0 flips the rendering ownership. Currently C++ creates the GPUDevice and owns the glass shader pipeline. After v3.0:

- **JS creates GPUDevice** and passes it to C++ via `preinitializedWebGPUDevice` / `importJsDevice`
- **C++ engine** renders only background (noise or image) to an offscreen texture
- **JS/WebGPU** owns the glass shader pipeline: WGSL shaders compiled and run in TypeScript
- **React components** drive the JS glass renderer instead of calling C++ embind methods
- **Same public API** — GlassPanel, GlassButton, GlassCard keep their props unchanged

The glass library becomes pluggable: any C++ engine (or no C++ at all) can provide a scene texture, and the JS glass pipeline composites over it.

---

## Feature Landscape

### Table Stakes (Architecture Cannot Work Without These)

These are blockers. The v3.0 architecture is non-functional if any of these is missing.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| JS GPUDevice creation and adapter request | All WebGPU resources must share a device. Device must be created in JS and passed to C++ so they share the same GPU context — different devices cannot share textures. | LOW | `navigator.gpu.requestAdapter()` → `adapter.requestDevice()`. Must happen before WASM loads. Already partially implemented in GlassProvider (external `device` prop path). |
| Device injection into C++ engine via emdawnwebgpu | C++ engine needs the same GPUDevice to create its background render texture. The `importJsDevice` + `initWithExternalDevice(handle)` path already exists in the codebase but needs to be the primary path, not a fallback. | LOW | `module.WebGPU.importJsDevice(device)` then `module.initWithExternalDevice(handle)`. Pattern confirmed working in current `loader.ts`. |
| C++ engine exposes scene texture to JS | JS glass pipeline needs to read the background texture rendered by C++. C++ must export the texture handle so JS can wrap it into a `GPUTexture`. | LOW | C++ `getBackgroundTextureHandle()` already exists. JS side uses `module.WebGPU.getJsObject(handle)` to recover the GPUTexture. Path confirmed in GlassProvider's `externalTexture` prop. |
| JS WGSL glass shader module | The entire glass effect (refraction, blur, Fresnel, specular, chromatic aberration, rim lighting) must be ported from the C++ `glass.wgsl.h` string into a `.wgsl` file or TypeScript template literal loaded by JS. | MEDIUM | All shader logic exists in `engine/src/shaders/glass.wgsl.h`. Port to `src/shaders/glass.wgsl` or a TS string. No algorithmic changes — direct port. |
| GPURenderPipeline creation in JS | JS must compile the WGSL shader modules into a `GPURenderPipeline` with explicit `GPUPipelineLayout` + `GPUBindGroupLayout` (not `layout: 'auto'`) so the scene texture bind group can be shared across multiple glass region draw calls. | MEDIUM | Must use explicit bind group layouts (HIGH confidence from toji.dev best practices — `layout: 'auto'` prevents cross-pipeline bind group sharing which is required for multi-region rendering). |
| Per-region uniform buffer management in JS | Each glass region (GlassPanel, GlassButton, GlassCard) has 16 shader parameters stored in a uniform buffer. JS must manage creation, writes, and lifecycle of these buffers — currently done in C++. | MEDIUM | Each region needs a `GPUBuffer` with `UNIFORM | COPY_DST` usage. Write via `device.queue.writeBuffer()`. With dynamic offsets for multi-region batching, or one buffer per region for simplicity. Dynamic offsets require 256-byte alignment per region block. |
| DOM position tracking → UV rect calculation | The glass shader receives a normalized UV rect `[x, y, w, h]` for each glass region, derived from the component's DOM position relative to the canvas. This sync loop must exist in JS (currently in GlassProvider via ResizeObserver). | LOW | Already implemented. Port the ResizeObserver sync logic from GlassProvider's C++ callback calls to JS WebGPU uniform buffer writes. |
| Frame render loop in JS | JS must drive the per-frame command buffer: begin render pass, draw each glass region, submit. Currently C++ runs its own requestAnimationFrame loop. JS must take over the glass render pass within that loop or run a separate post-pass. | MEDIUM | Two options: (a) C++ runs rAF, calls back into JS after background pass; (b) JS runs rAF, calls C++ render, then runs its own glass pass. Option (b) is cleaner for ownership. |
| Canvas context configuration | JS must configure the canvas `GPUCanvasContext` with the correct texture format. Use `navigator.gpu.getPreferredCanvasFormat()` which returns `bgra8unorm` or `rgba8unorm` depending on platform. Must match what C++ background texture outputs. | LOW | MEDIUM confidence: canvas format must match or texture view format conversion must be explicit. `getPreferredCanvasFormat()` is the correct API (verified MDN 2025). |
| Unchanged public React API | GlassPanel, GlassButton, GlassCard must keep identical TypeScript props (GlassStyleProps). Users upgrading from v2.0 to v3.0 must not change code. | LOW | Props already defined in `src/components/types.ts`. The backing implementation changes but the interface stays frozen. |
| GlassContext updated for JS renderer | GlassContext currently distributes C++ engine handles. It must distribute JS WebGPU renderer handles instead. Region registration, rect updates, and param updates must route to JS uniform buffer writes rather than C++ embind calls. | MEDIUM | Replace `GlassRegionHandle` internals. The external shape of `registerRegion` / `unregisterRegion` stays the same — only the backing implementation changes. |

### Differentiators (Competitive Advantage for Pluggability)

These make the library genuinely pluggable and distinct from CSS glassmorphism alternatives.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Zero-argument glass pipeline (no C++ required) | Accept an arbitrary `GPUTexture` from outside — no WASM required. A Three.js app, a Babylon.js scene, or any WebGPU renderer can pass its scene texture and get glass compositing for free. | MEDIUM | `GlassProvider` already has an `externalTexture` prop. When set, C++ background pass is skipped. This path needs to be first-class, not a workaround. |
| Explicit bind group layout for texture sharing | Using explicit (not auto) `GPUBindGroupLayout` allows the scene texture bind group to be set once per frame and reused across all glass region draw calls. Critical for efficient multi-region rendering without N texture bind calls. | MEDIUM | Architecture decision documented in toji.dev best practices. Group 0: per-frame (scene texture + sampler), Group 1: per-region (uniform buffer). This matches the update-frequency grouping pattern (HIGH confidence). |
| Morph transitions through JS animation loop | Smooth parameter interpolation (exponential decay lerp) is already implemented in C++. Moving this to JS enables frame-rate independent transitions without WASM round-trips. | LOW | Port the `lerp` accumulation logic from C++ to a JS animation frame callback. `targetParams → currentParams` delta per rAF frame. |
| Device loss recovery | When the GPU device is lost (driver crash, GPU hot-unplug), a well-behaved library recovers automatically rather than freezing. JS device ownership enables proper handling: listen to `device.lost`, reinitialize, re-create all WebGPU resources, re-inject into WASM. | HIGH | Pattern documented in toji.dev device-loss article (HIGH confidence). Requires: (1) attach handler immediately on device creation; (2) on loss, request new adapter + device; (3) reinitialize WASM with new device; (4) re-create all pipelines/buffers/textures. |
| TypeScript-typed shader parameter constants | Export `DEFAULT_GLASS_PARAMS`, `PRESET_CLEAR_LIGHT`, `PRESET_CLEAR_DARK` as typed constants. Library consumers can compose presets without touching internals. | LOW | Already exists as tuning presets. Formalize into exported TypeScript constants with full type coverage. |
| DPR-aware rendering without prop threading | Handle `devicePixelRatio` changes (display scaling, moving between screens) automatically via a `matchMedia` listener, updating uniforms without requiring user code changes. | LOW | Already implemented in GlassProvider. Port forward to the JS renderer. `dpr` is already a shader uniform. |
| Accessibility integration into JS renderer | `prefers-reduced-motion` pauses the render loop. `prefers-reduced-transparency` switches to reduced-effect mode. Both handled at the JS renderer level, not requiring C++ changes. | LOW | Already implemented via `useAccessibilityPreferences`. Port forward — JS renderer checks prefs and skips frame or reduces blur/opacity. |
| React 18/19 StrictMode compatibility | StrictMode double-invokes effects in development. The initialization and cleanup lifecycle must be idempotent: double `useEffect` → double init → engine destroyed on first cleanup → clean single-instance in production. | LOW | Already solved in v2.0 using `cancelled` flag pattern. Port forward to JS renderer lifecycle. |
| Pluggable background engine interface | Define a narrow TypeScript interface: `{ getSceneTexture(): GPUTexture; render(deltaMs: number): void; resize(w: number, h: number): void; destroy(): void }`. Both WASM engine and pure-JS engines implement it. | MEDIUM | This interface is implicit in the current architecture. Making it explicit as a TypeScript type enables typed integration with `sc` engine and other future engines without coupling to embind specifics. |

### Anti-Features (Explicitly Out of Scope for This Milestone)

| Anti-Feature | Why Requested | Why Problematic for This Milestone | Alternative |
|--------------|---------------|------------------------------------|-------------|
| Rewriting glass shader effects | Shader logic already achieves <1% pixel diff from iOS reference. Changing effects during architecture migration risks losing the tuned values. | Conflates two risks: architecture change + visual regression. Fix architecture first, tune after. | Port WGSL shader verbatim from `glass.wgsl.h`. Keep every coefficient and formula identical. Re-tune in a follow-up phase. |
| Content-blur (frosted glass over DOM content) | Very commonly requested — CSS `backdrop-filter: blur()` users expect this. | Requires `html2canvas` or DOM-to-texture capture: completely different pipeline, defeats zero-copy architecture. Apple's glass refracts wallpaper, not DOM content. | Remain a wallpaper-refraction library. Document clearly that content-blur is out of scope. |
| WebGL fallback | WebGPU has ~85% desktop browser coverage as of 2025. Some users ask for wider compat. | Doubles all shader work (GLSL + WGSL), different API idioms, different pipeline lifecycle. The v3.0 goal is architectural simplicity, not coverage expansion. | Document WebGPU requirement clearly. Let browsers catch up. |
| CSS glassmorphism fallback | Graceful degradation with `backdrop-filter: blur()` + `rgba()` tint. | Produces completely different visual output — no refraction, no Fresnel, no chromatic aberration. Would require accepting two drastically different quality tiers. | Instead: detect WebGPU unavailability and surface a clear error message in development. In production, render nothing (transparent fallback) rather than a fake glass look. |
| Integrate `sc` engine | Architecture is designed to support this. But integrating a specific external engine is a separate milestone (per PROJECT.md). | Requires `sc` codebase access, its own device-passing protocol, possibly different texture formats. Adds scope that blocks v3.0 shipping. | Ship v3.0 with WASM engine only, define the `BackgroundEngine` interface that `sc` will implement. |
| Dev tuning page redesign | Planned in PROJECT.md but listed as a separate deliverable. | UI redesign is independent of the rendering pipeline change. Coupling them means the tuning page blocks ship. | Redesign tuning page as its own phase after JS pipeline is validated working. |
| Automated visual diffing re-run | Must happen after architecture change, but is a validation step, not a build step. | Running tuning during the architecture phase conflates "make it work" with "make it look right". | Make JS pipeline produce correct output, then run visual diff + re-tuning as a follow-up phase. |
| Server-side rendering support | React Server Components users sometimes ask. | WebGPU is browser-only. No GPU on server. Entirely different problem space. | Document that GlassProvider is client-only. Add `'use client'` directive for Next.js app router compatibility (LOW complexity, HIGH value for Next.js users). |
| Multi-instance GlassProvider | Multiple simultaneous glass scenes with separate devices. | Vastly complicates device lifecycle management and WASM module singleton constraints. | One GlassProvider per page. Document this constraint clearly. |

---

## Feature Dependencies

```
JS GPUDevice Creation
    |
    +--requires--> Device Injection into C++ WASM
    |                   |
    |                   +--requires--> C++ Exposes Scene Texture
    |                                       |
    |                                       +--requires--> JS WGSL Glass Shader Module
    |                                                           |
    |                                                           +--requires--> GPURenderPipeline (explicit layout)
    |                                                                               |
    |                                                                               +--requires--> Per-Region Uniform Buffers
    |                                                                               |                   |
    |                                                                               |                   +--requires--> DOM Position Tracking
    |                                                                               |
    |                                                                               +--requires--> Frame Render Loop
    |                                                                               |
    |                                                                               +--requires--> Canvas Context Configuration

JS GPURenderPipeline (explicit layout)
    |
    +--enables--> Bind Group Sharing (scene texture reused across all regions)
    |                   |
    |                   +--enables--> Zero-Arg Glass Pipeline (external GPUTexture)
    |
    +--enables--> TypeScript-Typed BackgroundEngine Interface

GlassContext Updated for JS Renderer
    |
    +--requires--> Per-Region Uniform Buffers
    |
    +--requires--> DOM Position Tracking
    |
    +--enables--> React API Unchanged
    |
    +--enables--> Morph Transitions in JS
    |
    +--enables--> Accessibility Integration
    |
    +--enables--> DPR-Aware Rendering

JS GPUDevice Creation
    |
    +--enables--> Device Loss Recovery (can't handle loss without owning device creation)
```

### Dependency Notes

- **Device injection requires JS device creation first:** You cannot inject a device you don't yet have. This is the entry point for the entire v3.0 architecture.
- **Explicit bind group layout must be decided before pipeline creation:** Changing from `layout: 'auto'` after the fact requires recreating all pipelines. Must be explicit from the start.
- **Scene texture exposure enables zero-arg pipeline:** Once C++ exposes the texture handle and JS can recover it as a `GPUTexture`, the external texture path (no C++) is functionally the same code path.
- **GlassContext update unlocks React API stability:** All three React components depend on `GlassContext` for their rendering calls. Context must be updated before components work at all.
- **Device loss recovery is independent but architected in:** It does not block v3.0 shipping but must be considered in the device creation lifecycle (attach the listener immediately).

---

## MVP Definition

### Launch With (v3.0)

The minimum set to validate JS WebGPU pipeline ownership:

- [ ] **JS GPUDevice creation** — `navigator.gpu.requestAdapter()` + `requestDevice()` in GlassProvider, before WASM loads
- [ ] **Device injection into C++ WASM** — `importJsDevice` + `initWithExternalDevice` as the primary code path (not fallback)
- [ ] **C++ exposes scene texture** — `getBackgroundTextureHandle()` + JS wraps it via `getJsObject()`
- [ ] **WGSL glass shader ported to JS** — verbatim port of `glass.wgsl.h` into TypeScript / `.wgsl` file, no algorithmic changes
- [ ] **GPURenderPipeline with explicit bind group layouts** — group 0: scene texture + sampler (per-frame); group 1: uniform buffer (per-region)
- [ ] **Per-region uniform buffers in JS** — `GPUBuffer` per region, written via `device.queue.writeBuffer()`
- [ ] **Frame render loop in JS** — rAF-driven command encoding: begin pass, draw N regions, submit, present
- [ ] **Canvas context configured by JS** — `getPreferredCanvasFormat()` for correct texture format
- [ ] **GlassContext updated** — `registerRegion` / `updateRect` / `updateParams` write to JS uniform buffers
- [ ] **Unchanged public API** — GlassPanel, GlassButton, GlassCard props identical to v2.0

### Add After Validation (v3.x)

Features to add once the JS pipeline renders correctly at all:

- [ ] **Device loss recovery** — attach `device.lost` listener, reinitialize on loss, re-inject into WASM
- [ ] **Zero-arg glass pipeline** — first-class support for external `GPUTexture` from non-WASM engines
- [ ] **TypeScript BackgroundEngine interface** — formal typed contract for pluggable engines
- [ ] **Dev tuning page redesign** — once visual parity is confirmed post-migration

### Future Consideration (v4+)

- [ ] **`sc` engine integration** — plug the `scTarsiusWeb` engine as a `BackgroundEngine` implementation
- [ ] **Gyroscope / pointer tilt interaction** — light source moves with device orientation
- [ ] **Content-blur mode** — requires separate DOM-to-texture compositor (entirely different architecture)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| JS GPUDevice creation | HIGH (blocks everything) | LOW | P1 |
| Device injection into C++ | HIGH (blocks everything) | LOW | P1 |
| C++ exposes scene texture | HIGH (blocks everything) | LOW | P1 |
| WGSL shader ported to JS | HIGH (core effect) | MEDIUM | P1 |
| GPURenderPipeline explicit layout | HIGH (multi-region) | MEDIUM | P1 |
| Per-region uniform buffers | HIGH (parameters) | MEDIUM | P1 |
| Frame render loop in JS | HIGH (rendering) | MEDIUM | P1 |
| Canvas context configuration | HIGH (display) | LOW | P1 |
| GlassContext updated | HIGH (React bridge) | MEDIUM | P1 |
| Unchanged public API | HIGH (no breaking change) | LOW | P1 |
| Morph transitions in JS | MEDIUM (smoothness) | LOW | P2 |
| DPR-aware rendering | MEDIUM (Retina quality) | LOW | P2 |
| Accessibility integration | MEDIUM (a11y) | LOW | P2 |
| Device loss recovery | MEDIUM (robustness) | HIGH | P2 |
| Zero-arg glass pipeline | HIGH (pluggability) | MEDIUM | P2 |
| BackgroundEngine interface | MEDIUM (future-proofing) | LOW | P2 |
| Dev tuning page redesign | MEDIUM (developer UX) | MEDIUM | P3 |
| `sc` engine integration | HIGH (future use case) | HIGH | P3 |

**Priority key:**
- P1: Must have for v3.0 to function at all
- P2: Should have, add before shipping v3.0
- P3: Future milestone

---

## Competitor Feature Analysis

Glass overlay libraries in the JS ecosystem as of 2025:

| Feature | liquid-glass-react (rdev) | CSS glassmorphism libs | glass-react (this project) |
|---------|--------------------------|----------------------|---------------------------|
| Rendering backend | WebGL canvas (SVG filter fallback) | CSS backdrop-filter | WebGPU + C++/WASM |
| Background source | Page content behind component | Page content | Offscreen GPU texture (wallpaper or noise) |
| Refraction | Displacement map shader | None | SDF lens displacement WGSL |
| Chromatic aberration | Yes (aberrationIntensity prop) | No | Yes (per-region prop) |
| Fresnel edges | No | No | Yes (IOR + exponent props) |
| Specular highlights | No | No | Yes (directional glare) |
| Multi-region batching | No (per-component canvas) | N/A | Yes (shared GPU pipeline, N regions 1 pass) |
| Pluggable background engine | No | No | Yes (v3.0 goal) |
| Safari/Firefox support | Partial (displacement invisible) | Full | Chrome/Edge only (WebGPU) |
| Visual parity target | Apple-inspired | Generic glassmorphism | Apple Liquid Glass (measured diff <1%) |
| Animation | Spring physics (elasticity prop) | CSS transitions | Exponential decay lerp (frame-rate independent) |

**Key differentiator:** This project is the only one targeting measured visual parity with Apple's native Liquid Glass (using automated pixel diffing). All others are "inspired by" rather than validated against reference.

---

## Sources

- [WebGPU Bind Group Best Practices — toji.dev](https://toji.dev/webgpu-best-practices/bind-groups.html) — explicit layout requirement; group-by-update-frequency pattern (HIGH confidence, official author of WebGPU spec)
- [WebGPU Device Loss Best Practices — toji.dev](https://toji.dev/webgpu-best-practices/device-loss.html) — recovery strategy, always request fresh adapter (HIGH confidence)
- [GPUDevice: lost — MDN](https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/lost) — device loss promise API (HIGH confidence)
- [GPU.getPreferredCanvasFormat() — MDN](https://developer.mozilla.org/en-US/docs/Web/API/GPU/getPreferredCanvasFormat) — correct canvas format selection (HIGH confidence)
- [WebGPU Multiple Render Passes — Medium](https://matthewmacfarquhar.medium.com/webgpu-rendering-part-6-multiple-render-passes-b42157dfbcb5) — render-to-texture pattern for multi-pass compositing (MEDIUM confidence)
- [WebGPU Renderer Structure — Ryosuke](https://whoisryosuke.com/blog/2025/structure-of-a-webgpu-renderer/) — pipeline caching, bind group hierarchy, resource lifecycle (MEDIUM confidence)
- [Mixed JS/WASM WebGPU — emscripten-core/emscripten#13888](https://github.com/emscripten-core/emscripten/issues/13888) — JsValStore pattern for JS↔WASM object marshalling (HIGH confidence, official Emscripten issue)
- [liquid-glass-react — rdev](https://github.com/rdev/liquid-glass-react) — competitor analysis: WebGL, displacement map, aberration (HIGH confidence, read source)
- [Current codebase: glass.wgsl.h, GlassProvider.tsx, loader.ts, types.ts] — direct inspection of existing implementation (HIGH confidence)

---

*Feature research for: JS WebGPU glass rendering pipeline — v3.0 architecture redesign*
*Researched: 2026-03-24*

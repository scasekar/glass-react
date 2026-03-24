# Project Research Summary

**Project:** glass-react v3.0 — JS/WebGPU Glass Rendering Pipeline
**Domain:** WebGPU rendering library — WASM/JS hybrid pipeline split
**Researched:** 2026-03-24
**Confidence:** HIGH

## Executive Summary

glass-react v3.0 is a surgical architectural flip: JS takes ownership of the `GPUDevice` and the glass shader pipeline, while the C++ WASM engine is slimmed to render background only (noise or image to an offscreen texture). The two sides share the same GPU device via emdawnwebgpu's object table (`WebGPU.importJsDevice` / `WebGPU.getJsObject`), enabling zero-copy texture access — C++ renders the background, JS composites glass over it without any GPU memory duplication. Every required API pattern is already partially implemented in the v2.0 codebase (`loader.ts` lines 75–89, `main.cpp` `initWithExternalDevice`); this is a targeted migration, not a ground-up rewrite. No new npm packages are needed.

The recommended approach is a strict phase order: thin the C++ engine first (delete the glass pass and expose the scene texture handle), then build the JS `GlassRenderer` class in isolation against a synthetic texture, then wire `GlassProvider` to connect both systems, and finally re-run visual diffing to confirm parity. Phases 1 and 2 can run in parallel because `GlassRenderer` can be tested without the thinned WASM. The public React API (`GlassPanel`, `GlassButton`, `GlassCard`, `useGlassRegion`) is entirely unchanged at the interface level — only the backing implementation changes.

The primary risks are specific to the WASM-JS boundary: stale emdawnwebgpu object handles (C++ holding a handle to a GC'd JS texture), texture format mismatch between C++ offscreen texture and JS sampler expectations (BGRA vs RGBA on macOS), uniform buffer byte-offset errors when porting the 112-byte `GlassUniforms` struct to a `Float32Array`, and UV/DPR convention drift during the WGSL shader port. Each is well-understood with a concrete prevention strategy and maps to an explicit phase gate. The known emdawnwebgpu double-WaitAny corruption bug must not be reintroduced during C++ restructuring — preserve `AllowSpontaneous` chained callbacks.

---

## Key Findings

### Recommended Stack

See `.planning/research/STACK.md` for full details.

No new packages are required. The v3.0 migration uses the existing stack: WebGPU browser API typed via `@webgpu/types@^0.1.69`, emdawnwebgpu interop bridge bundled with the WASM build (`--use-port=emdawnwebgpu`), TypeScript 5.7, and Vite with the existing plugin set. WGSL shaders migrate from `engine/src/shaders/glass.wgsl.h` (C++ header string) to `src/renderer/glass.wgsl` (Vite `?raw` import) or a TypeScript template literal — both are production-equivalent; `?raw` is preferred for IDE WGSL syntax support.

**Core technologies:**
- **WebGPU (browser API):** JS-side device creation, render pipelines, bind groups, texture reads — no wrapper library needed; already typed
- **emdawnwebgpu interop (`WebGPU.importJsDevice` / `WebGPU.getJsObject`):** JS-to-C++ device handoff and C++-to-JS texture bridge — already implemented in `loader.ts`, validated in v2.0
- **`@webgpu/types@^0.1.69`:** TypeScript types for all WebGPU descriptors — already installed and configured in `tsconfig.json`
- **WGSL (inline or `?raw` import):** Glass shader verbatim-ported from `engine/src/shaders/glass.wgsl.h` — no algorithmic changes
- **`createRenderPipelineAsync()`:** Mandatory for production pipeline compilation — compile once at init, cache, never recreate per-frame or per-resize

**Critical version requirements:**
- Emscripten >= 4.0.10 for emdawnwebgpu interop; project uses 4.0.16 (already correct)
- `--use-port=emdawnwebgpu` must be in BOTH compile AND link flags (already correct in CMakeLists.txt)
- Chrome 113+ / Edge 113+ for WebGPU; Safari 18+ partial support

### Expected Features

See `.planning/research/FEATURES.md` for full details.

The v3.0 feature set is a migration of existing functionality, not a feature expansion. All P1 table-stakes features are direct ports of C++ subsystems to TypeScript; differentiators (device loss recovery, zero-arg pipeline, typed `BackgroundEngine` interface) are v3.x follow-ons.

**Must have — table stakes (v3.0, all P1):**
- JS `GPUDevice` creation (`navigator.gpu.requestAdapter` + `requestDevice`) — entry point that blocks everything else
- Device injection into C++ WASM via `importJsDevice` + `initWithExternalDevice` — already tested code path, made primary instead of fallback
- C++ exposes scene texture handle — `getBackgroundTextureHandle()` already exists; rename and promote to primary export
- WGSL glass shader ported to JS — verbatim port from `glass.wgsl.h`; no algorithmic changes, no visual regression
- `GPURenderPipeline` with explicit bind group layouts (NOT `layout: 'auto'`) — required for scene texture sharing across multiple regions in one draw sequence
- Per-region uniform buffers in JS with 256-byte dynamic offset stride — `GPUBuffer UNIFORM | COPY_DST`, written via `device.queue.writeBuffer()`
- JS-owned `requestAnimationFrame` render loop — C++ becomes call-driven; `emscripten_set_main_loop` deleted
- Canvas context configured by JS — `GPU.getPreferredCanvasFormat()` for correct swap chain texture format
- `GlassContext` / `GlassRegionHandle` internals updated — implementations switch from C++ embind calls to `GlassRenderer` method calls
- Unchanged public React API — `GlassPanel`, `GlassButton`, `GlassCard` props identical to v2.0

**Should have — differentiators (v3.x, P2):**
- Device loss recovery — attach `device.lost` handler at creation; recreate adapter + device + all resources on loss; re-inject into WASM
- Zero-arg glass pipeline — first-class `externalTexture` prop support (any external `GPUTexture`, no WASM required)
- Typed `BackgroundEngine` TypeScript interface — formal contract for pluggable engines (`getSceneTexture`, `render`, `resize`, `destroy`)
- Dev tuning page redesign — after visual parity confirmed post-migration

**Defer to v4+ (P3):**
- `sc` engine integration — separate milestone; requires `sc` codebase access and its own device-passing protocol
- Gyroscope / pointer tilt interaction
- Content-blur over DOM — entirely different architecture (DOM-to-texture capture), explicitly out of scope

### Architecture Approach

See `.planning/research/ARCHITECTURE.md` for full details.

The v3.0 architecture introduces a `GlassRenderer` TypeScript class as the central new component. C++ shrinks to a call-driven background renderer (Pass 1 only). JS takes Pass 2 (glass compositor). The single `requestAnimationFrame` loop is owned by `GlassProvider` and drives both: `engine.update(dt)` → `engine.renderBackground()` → `glassRenderer.render()`. Five subsystems migrate from C++ to TypeScript: `GlassUniforms` struct, `GlassRegion` struct, `lerpUniforms()` (morph lerp), region management methods, and the glass WGSL pipeline.

**Major components:**
1. **`GlassRenderer` (NEW TypeScript class)** — owns `GPUDevice` reference, compiles `glass.wgsl` with explicit bind group layouts (group 0: scene texture + sampler per-frame; group 1: uniform buffer per-region), manages morph lerp state in TypeScript, drives command encoding and submit
2. **`GlassProvider` (MODIFIED)** — acquires `GPUDevice` via `navigator.gpu`, passes it to both WASM bridge and `GlassRenderer`, owns the single rAF loop, handles `ResizeObserver` texture refresh (must re-call `getSceneTexture()` and `renderer.setSceneTexture()` after every resize)
3. **`loader.ts` / WASM bridge (SIMPLIFIED)** — always uses external device path; adds `getSceneTexture()` helper wrapping `getSceneTextureHandleJS()` → `WebGPU.getJsObject()`; removes standalone adapter/device init branch
4. **`BackgroundEngine` C++ (SLIMMED)** — Pass 1 only (noise/image → offscreenTexture); all glass pipeline code, region management, and morph lerp deleted; `getSceneTextureHandle()` promoted as primary export; device always received from JS
5. **`GlassContext` / `GlassRegionHandle` (API UNCHANGED)** — internal implementations switch from C++ embind calls to `GlassRenderer` method calls; external interface shape is identical to v2.0

**Key patterns:**
- Single JS-owned rAF loop — eliminates tearing from two independent render loops
- Bind group cache: store `GPUTexture` reference; rebuild bind group only on resize, not every frame
- 256-byte uniform stride for dynamic offset multi-region rendering (16 regions × 256 bytes = 4 KB, well within WebGPU limits)
- Cleanup order enforced: `destroyEngine()` before `device.destroy()` — prevents stale handle crashes

### Critical Pitfalls

See `.planning/research/PITFALLS.md` for full details.

1. **Stale emdawnwebgpu object handles (C1)** — C++ holds an integer handle to a JS `GPUDevice` or `GPUTexture`; if JS GCs or explicitly destroys the object while C++ still uses it, crashes or silent wrong-renders occur. Prevention: keep JS WebGPU objects alive in `useRef` for the entire engine lifetime; always call `module.destroyEngine()` before `device.destroy()`.

2. **Double WaitAny corrupts emdawnwebgpu Instance (C3)** — known v2.0 issue; using `WaitAny()` twice in sequence in C++ corrupts emdawnwebgpu's internal Instance reference. Must not be reintroduced during v3.0 C++ restructuring. Prevention: use only `AllowSpontaneous` chained callbacks for any C++ async init; in the JS-creates-device path, C++ receives an already-resolved device and does not need to WaitAny at all.

3. **Offscreen texture format mismatch (C5)** — `GPU.getPreferredCanvasFormat()` returns `bgra8unorm` on macOS/Chrome; if C++ creates its offscreen texture using the surface format and JS samples it expecting `rgba8unorm`, R/B channels swap. Prevention: use explicit `wgpu::TextureFormat::RGBA8Unorm` for all C++ offscreen textures; reserve canvas-preferred format for the swap chain surface only.

4. **Uniform buffer byte-offset errors (C7)** — the 112-byte `GlassUniforms` struct has WGSL alignment padding (vec3f fields padded to 16 bytes). Positional `Float32Array` fills without explicit byte-offset tracking silently corrupt all shader parameters. Prevention: implement `buildGlassUniformData()` with indexed assignments keyed to documented byte offsets from `background_engine.h`; unit-test all 28 float fields before any visual work.

5. **UV/DPR convention drift during WGSL port (C4 + C6)** — Y-flip convention, pixel-space SDF computation, and DPR scaling (at uniform offset 108, retrofitted from `_pad7`) are inter-dependent; omitting any one causes mirrored, displaced, or Retina-incorrect glass. Prevention: copy `glass.wgsl.h` verbatim as starting point; include the `dpr` uniform from the first working render; gate Phase 2 completion on position regression tests at 1x and 2x DPR.

---

## Implications for Roadmap

The architecture research defines a clear 4-phase dependency order. Phases 1 and 2 have a partial parallel opportunity (GlassRenderer can be tested against a synthetic texture). Phase 3 is a hard dependency on both. Phase 4 is a hard dependency on Phase 3.

### Phase 1: WASM Thinning — Slim C++ to Background-Only

**Rationale:** C++ currently owns both background rendering and the glass pass. These conflict — both cannot write to the surface simultaneously. Deleting the glass pass from C++ is the critical path blocker for all downstream work.
**Delivers:** A WASM binary that does background rendering only, exposing `renderBackground()` and `getSceneTextureHandle()` as the clean interface boundary. C++ becomes call-driven (no `emscripten_set_main_loop`). Device is always received from JS — standalone adapter/device init deleted from `main.cpp`.
**Addresses:** Device injection path made primary, scene texture exposure, canvas surface ownership transfer
**Avoids:** C2 (do not reintroduce deprecated `emscripten_webgpu_get_device`), C3 (preserve `AllowSpontaneous` in any remaining C++ async init; JS-created device means C++ needs no WaitAny at all), C5 (fix offscreen texture format to explicit `wgpu::TextureFormat::RGBA8Unorm`)
**Research flag:** Standard patterns — all changes are enumerated deletions and renames from architecture analysis; no new research needed

### Phase 2: JS GlassRenderer Core — Build the JS Glass Pipeline in Isolation

**Rationale:** Can begin in parallel with Phase 1. `GlassRenderer` can be developed and unit-tested against a synthetic `device.createTexture()` — no thinned WASM required. Building in isolation reduces integration surface during Phase 3.
**Delivers:** `GlassRenderer.ts` with compiling `glass.wgsl` pipeline (explicit bind group layouts), dynamic uniform buffer management, TypeScript morph lerp, and working per-region glass render output against a synthetic scene texture
**Uses:** WebGPU JS API (`createRenderPipelineAsync`, explicit `GPUBindGroupLayout`, 256-byte dynamic uniform offsets); `glass.wgsl` verbatim-ported from `glass.wgsl.h`; `GlassRegionState.ts` and `morphLerp.ts` TypeScript ports of C++ structs and `lerpUniforms()`
**Avoids:** C4 (verbatim WGSL port preserves Y-flip and pixel-space SDF conventions), C6 (DPR uniform populated at offset 108 from first working render), C7 (explicit-offset uniform buffer helper unit-tested before visual work), C8 (render loop ordering documented: C++ `queue.submit` before JS glass `queue.submit` in same rAF tick)
**Research flag:** Standard patterns — WebGPU JS pipeline creation is well-documented (toji.dev, MDN, webgpufundamentals.org); emdawnwebgpu interop already validated in v2.0

### Phase 3: GlassProvider Wiring — Full Stack Integration

**Rationale:** Hard dependency on both Phase 1 (WASM exposes `renderBackground()` / `getSceneTextureHandle()`) and Phase 2 (GlassRenderer accepts a scene texture). This phase connects both systems and replaces all C++ embind region calls with `GlassRenderer` calls via `GlassRegionHandle`.
**Delivers:** Full end-to-end stack — React components render glass over C++ background; single JS-owned rAF loop drives both systems; `ResizeObserver` correctly refreshes scene texture handle and bind group; public React API unchanged from v2.0
**Avoids:** C1 (explicit cleanup order enforced: `destroyEngine()` before `device.destroy()`; scene texture reference kept alive in `useRef`), C8 (single rAF loop ordering: `engine.update` → `engine.renderBackground` → `glassRenderer.render`; no concurrent async submits)
**Research flag:** Standard patterns — `GlassProvider` restructuring is well-defined given architecture analysis; all emdawnwebgpu interop patterns are validated

### Phase 4: Visual Validation and Re-Tuning

**Rationale:** Architecture change may shift shader pipeline coordinates or GPU rounding subtly. Visual parity must be confirmed against the iOS reference before declaring v3.0 complete. Re-tuning with the coordinate-descent script may be needed if any preset drifts.
**Delivers:** Passing `npm run diff` with pixel match score within 2% of v2.0 baseline; coordinate-descent tuner run if any preset drifts; v3.0 tagged as release-ready
**Avoids:** Shipping an architecture-correct but visually regressed build
**Research flag:** Skip — tuning process is established (coordinate-descent, pixelmatch); no new research needed

### Phase Ordering Rationale

- Phase 1 must precede Phase 3: C++ glass pass and JS glass pass cannot coexist — both write to the surface; C++ glass pass must be deleted first
- Phase 2 can run in parallel with Phase 1: `GlassRenderer` only needs a `GPUDevice` and a synthetic texture to develop and test against
- Phase 3 requires Phase 1 + Phase 2 complete: needs both `renderBackground()` / `getSceneTextureHandle()` from WASM and a working `GlassRenderer` that accepts a scene texture
- Phase 4 requires Phase 3 visually stable: tuning against a broken render produces meaningless coefficients

### Research Flags

Phases needing deeper research during planning:
- None — all four phases have fully defined scope from direct codebase analysis and validated WebGPU API patterns

Phases with standard patterns (skip `/gsd:research-phase`):
- **Phase 1:** C++ refactoring scope fully enumerated in ARCHITECTURE.md; changes are deletions and renames, not novel integrations
- **Phase 2:** WebGPU JS pipeline patterns are authoritative (toji.dev, MDN, webgpufundamentals.org); emdawnwebgpu interop already validated in production
- **Phase 3:** Wire-up of two independently validated systems; all boundary contracts are defined
- **Phase 4:** Established tuning workflow from v2.0; no new tooling required

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Entire stack is already in the codebase; interop patterns verified against live implementation and emdawnwebgpu source; no new packages needed |
| Features | HIGH | Feature scope is a migration of existing functionality, not new work; public API is frozen; P1/P2/deferred split is unambiguous |
| Architecture | HIGH | Based on direct analysis of v2.0 source code; component responsibilities, data flows, and deletion list are fully enumerated with no gaps |
| Pitfalls | HIGH | Core pitfalls verified against emdawnwebgpu source, WebGPU spec, and project history; several already encountered and solved in v2.0 |

**Overall confidence:** HIGH

### Gaps to Address

- **Canvas surface ownership during Phase 3:** In v2.0, C++ configures the `wgpu::Surface` from the canvas HTML selector. In v3.0, JS must configure `GPUCanvasContext` for the swap chain. The exact handoff — whether C++ still creates a `wgpu::Surface` internally or JS takes over `canvas.getContext('webgpu')` entirely — needs one explicit decision at Phase 3 kickoff. The architecture research identifies this as a key contract point but does not prescribe the exact API call ordering.

- **`externalDeviceMode` flag scope in `loader.ts`:** Currently set only in the `if (options?.device)` branch. In v3.0 this branch becomes the only path. Verify no C++ startup code branches on the absence of `externalDeviceMode` in a way that would silently fail when the standalone path is removed.

- **WGSL shader authoring approach:** Template literal vs. `?raw` import — both work; settle this at Phase 2 kickoff. Recommendation: use `?raw` for IDE WGSL syntax support during development.

---

## Sources

### Primary (HIGH confidence)
- Live codebase: `src/wasm/loader.ts`, `engine/src/main.cpp`, `engine/src/background_engine.h/.cpp`, `engine/src/shaders/glass.wgsl.h` — primary source of truth for all interop patterns and struct layouts
- [MDN: GPU.requestAdapter / GPUAdapter.requestDevice / GPUDevice.lost / createRenderPipelineAsync](https://developer.mozilla.org/en-US/docs/Web/API/GPU) — standard WebGPU device lifecycle APIs
- [emdawnwebgpu README](https://dawn.googlesource.com/dawn/+/refs/heads/main/src/emdawnwebgpu/pkg/README.md) — `--use-port=emdawnwebgpu` requirements, deprecation of `--use-port=webgpu`
- [WebGPU Fundamentals: Uniforms](https://webgpufundamentals.org/webgpu/lessons/webgpu-uniforms.html) — `minUniformBufferOffsetAlignment = 256`; Float32Array layout rules
- [WebGPU Bind Group Best Practices — toji.dev](https://toji.dev/webgpu-best-practices/bind-groups.html) — explicit layout requirement; group-by-update-frequency pattern
- [WebGPU Device Loss Best Practices — toji.dev](https://toji.dev/webgpu-best-practices/device-loss.html) — recovery strategy; always request fresh adapter on loss
- Project MEMORY.md — `AllowSpontaneous` vs double `WaitAny` known issue; emdawnwebgpu header-only requirement; `--use-port` placement rules

### Secondary (MEDIUM confidence)
- [Emscripten issue #13888](https://github.com/emscripten-core/emscripten/issues/13888) — `importJsDevice`, `getJsObject`, `JsValStore` mechanism (GitHub issue, Chrome WebGPU team author)
- [Emscripten issue #24265](https://github.com/emscripten-core/emscripten/issues/24265) — `preinitializedWebGPUDevice` removal confirmation
- [WebGPU Multiple Render Passes — matthewmacfarquhar.medium.com](https://matthewmacfarquhar.medium.com/webgpu-rendering-part-6-multiple-render-passes-b42157dfbcb5) — multi-pass texture ordering

### Tertiary (LOW confidence)
- None — all significant findings have primary or secondary backing

---
*Research completed: 2026-03-24*
*Ready for roadmap: yes*

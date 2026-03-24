# Architecture Research

**Domain:** JS/WebGPU glass rendering pipeline with WASM background engine
**Researched:** 2026-03-24
**Confidence:** HIGH — based on direct codebase analysis of v2.0 source

## Standard Architecture

### System Overview: v2.0 (Current — To Be Dismantled)

```
┌────────────────────────────────────────────────────────────────────┐
│                         React Layer                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  GlassPanel  │  │  GlassButton │  │  GlassCard   │             │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
│         └─────────────────┴─────────────────┘                      │
│                           │ useGlassRegion hook                     │
│                           ▼                                         │
│                  ┌─────────────────┐                                │
│                  │  GlassProvider  │  (owns canvas, lifecycle)      │
│                  └────────┬────────┘                                │
├────────────────────────────────────────────────────────────────────┤
│                         WASM Bridge (loader.ts)                     │
│                  ┌─────────────────┐                                │
│                  │  initEngine()   │  (preinitializedWebGPUDevice   │
│                  │  EngineModule   │   path exists but underused)   │
│                  └────────┬────────┘                                │
├────────────────────────────────────────────────────────────────────┤
│                     C++ BackgroundEngine (WASM)                     │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  Pass 1: Noise/Image → offscreenTexture (RGBA8Unorm)     │      │
│  │  Pass 2: offscreenTexture → Surface (glass shader)       │      │
│  │          (refraction, blur, tint, Fresnel, specular,     │      │
│  │           chromatic aberration, rim, morph lerp)         │      │
│  └──────────────────────────────────────────────────────────┘      │
│  Device owned by C++ (RequestAdapter → RequestDevice in main())    │
└────────────────────────────────────────────────────────────────────┘
```

Key problem with v2.0: C++ owns the GPUDevice AND runs the glass shader. Glass is a web UI
concern and cannot be shared with other platforms. The C++ engine is not pluggable.

---

### System Overview: v3.0 (Target Architecture)

```
┌────────────────────────────────────────────────────────────────────┐
│                         React Layer                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  GlassPanel  │  │  GlassButton │  │  GlassCard   │             │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
│         └─────────────────┴─────────────────┘                      │
│                           │ useGlassRegion hook (UNCHANGED API)     │
│                           ▼                                         │
│                  ┌─────────────────┐                                │
│                  │  GlassProvider  │  (owns device, canvas,         │
│                  └────────┬────────┘   JS glass renderer lifecycle) │
├────────────────────────────────────────────────────────────────────┤
│                    JS WebGPU Glass Pipeline (NEW)                   │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  GlassRenderer (TypeScript)                              │      │
│  │  - Owns GPUDevice reference (acquired by GlassProvider)  │      │
│  │  - Creates surface, configures swap chain                │      │
│  │  - Compiles glass.wgsl from string at runtime            │      │
│  │  - GlassUniformBuffer (dynamic offsets, up to 16 regions)│      │
│  │  - Per-frame: write uniforms → draw background blit →    │      │
│  │    draw each active region with alpha blend              │      │
│  │  - Morph lerp in TypeScript (replaces C++ lerpUniforms)  │      │
│  └──────────────────────┬───────────────────────────────────┘      │
│                         │ reads sceneTexture (GPUTexture)           │
│                         │ passes device handle to WASM              │
├────────────────────────────────────────────────────────────────────┤
│                     WASM Bridge (loader.ts — MODIFIED)              │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  initEngine({ device: GPUDevice })                       │      │
│  │  - Always uses preinitializedWebGPUDevice path           │      │
│  │  - WebGPU.importJsDevice(device) → handle                │      │
│  │  - initWithExternalDevice(handle)                        │      │
│  │  - getSceneTexture(): GPUTexture  (NEW export)           │      │
│  └──────────────────────┬───────────────────────────────────┘      │
├────────────────────────────────────────────────────────────────────┤
│                C++ BackgroundEngine (WASM — SLIMMED)                │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  Pass 1 ONLY: Noise/Image → offscreenTexture             │      │
│  │  glass.wgsl.h DELETED                                    │      │
│  │  GlassRegion / GlassUniforms structs DELETED             │      │
│  │  glassPipeline / glassBindGroup DELETED                  │      │
│  │  surface.GetCurrentTexture() render DELETED              │      │
│  │  NEW: getSceneTextureHandle() → uintptr_t                │      │
│  │  Device received from JS (NOT self-created)              │      │
│  └──────────────────────────────────────────────────────────┘      │
└────────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

| Component | v2.0 Responsibility | v3.0 Responsibility | Change |
|-----------|---------------------|---------------------|--------|
| `main.cpp` | RequestAdapter/RequestDevice OR externalDeviceMode shim | Always external device; delete standalone adapter/device init | SHRINKS |
| `BackgroundEngine` | Pass 1 (noise/image) + Pass 2 (glass) + morph lerp + region mgmt | Pass 1 only; expose `getSceneTextureHandle()` | MAJOR CUT |
| `glass.wgsl.h` | Glass shader embedded in C++ | Delete — shader moves to `src/renderer/glass.wgsl` | DELETE |
| `GlassRegion`/`GlassUniforms` structs | C++ per-region state | Delete — TypeScript equivalent owns this | DELETE |
| `loader.ts` / `initEngine()` | Optional external device path | Always external device; add `getSceneTexture()` helper | SIMPLIFY |
| `GlassRenderer` (NEW) | — | JS class: device init, glass pipeline, uniform buffer, render loop | CREATE |
| `GlassProvider` | Calls `initEngine`, owns canvas, proxies region calls to C++ | Creates GPUDevice, constructs GlassRenderer, wires initEngine, owns rAF | MODIFIED |
| `GlassContext` / `GlassRegionHandle` | Interface for React components to C++ engine | Same interface — implementations switch from C++ to JS GlassRenderer calls | API UNCHANGED |
| `useGlassRegion` | Maps props to C++ engine calls | Maps props to GlassRenderer calls via same GlassRegionHandle interface | INTERNAL ONLY |
| React components (GlassPanel, etc.) | Use `useGlassRegion` | Use `useGlassRegion` — zero changes | NO CHANGE |

---

## Data Flow

### Initialization Flow

```
GlassProvider mounts
    │
    ├─ navigator.gpu.requestAdapter()
    ├─ adapter.requestDevice()
    │      │
    │      ▼
    │  GPUDevice (JS-owned)
    │      │
    ├──────┼─────────────────────────────────────────────────────┐
    │      ▼ (pass to WASM)                                      ▼ (pass to GlassRenderer)
    │  initEngine({ device })                          new GlassRenderer(device, canvas)
    │      │                                                      │
    │      ├─ WebGPU.importJsDevice(device) → handle             ├─ compile glass.wgsl pipeline
    │      ├─ initWithExternalDevice(handle)                      ├─ createUniformBuffer()
    │      └─ BackgroundEngine.init(device, ...)                  └─ createSampler()
    │             └─ Pass 1 only: noise/image → offscreenTexture
    │
    ├─ getSceneTexture() returns offscreenTexture as GPUTexture
    │      └─ GlassRenderer.setSceneTexture(sceneTexture)
    │             └─ rebuild glass bind group with new texture view
    │
    └─ setReady(true) → React components can register regions
```

### Per-Frame Render Flow (rAF)

```
requestAnimationFrame (owned by GlassProvider)
    │
    ├─ 1. engine.update(dt)             [C++: advance time, noise animation]
    ├─ 2. engine.renderBackground()     [C++: Pass 1 only — noise/image → offscreenTexture]
    │
    └─ 3. glassRenderer.render()        [JS: Pass 2 — glass compositor]
           ├─ morphLerp all active regions (TypeScript exponential decay)
           ├─ writeBuffer: blit passthrough uniforms → draw (background blit)
           └─ for each active region: writeBuffer uniforms → draw with alpha blend
```

Note: Single rAF loop is owned by GlassProvider. The C++ `emscripten_set_main_loop(MainLoop)`
is removed. C++ becomes call-driven — it renders only when JS invokes it.

### Region Parameter Flow

```
GlassPanel prop change (e.g. blur=0.5 → 0.8)
    │
    ▼
useGlassRegion (useEffect dependency fires)
    │
    ▼
GlassRegionHandle.updateBlurRadius(24)    [JS interface — SAME as v2.0]
    │
    ▼
GlassRenderer.setRegionBlurRadius(id, 24) [JS implementation — NEW]
    │
    ▼
regions[id].target.blurRadius = 24        [TypeScript GlassRegion state]
    │
    ▼ (next rAF)
morphLerp(regions[id].current, regions[id].target, t)
    │
    ▼
GPUQueue.writeBuffer(uniformBuffer, offset, uniformData)
    │
    ▼
glass.wgsl reads GlassUniforms at dynamic offset
```

### Texture Bridge Flow

```
C++ BackgroundEngine
    offscreenTexture (wgpu::Texture, RenderAttachment | TextureBinding)
    │
    ▼
getSceneTextureHandle() → uintptr_t   [via clone.MoveToCHandle()]
    │
    ▼ (in loader.ts)
WebGPU.getJsObject(handle) → GPUTexture (JS handle, same GPU allocation)
    │
    ▼
GlassRenderer.setSceneTexture(gpuTexture)
    │
    ▼
glassBindGroup rebuilt with new GPUTextureView
    │
    ▼
glass.wgsl textureSample(texBackground, ...)
```

---

## Recommended Project Structure

```
src/
├── renderer/                       # NEW — JS WebGPU glass pipeline
│   ├── GlassRenderer.ts            # Core: device, pipeline, uniform buffer, render()
│   ├── glass.wgsl                  # Glass shader (moved from engine/src/shaders/glass.wgsl.h)
│   ├── GlassRegionState.ts         # TypeScript port of C++ GlassRegion/GlassUniforms
│   └── morphLerp.ts                # TypeScript port of C++ lerpUniforms()
│
├── components/                     # UNCHANGED API
│   ├── GlassProvider.tsx           # MODIFIED: creates device, wires GlassRenderer + WASM
│   ├── GlassPanel.tsx
│   ├── GlassButton.tsx
│   ├── GlassCard.tsx
│   └── types.ts                    # UNCHANGED
│
├── context/
│   └── GlassContext.ts             # UNCHANGED (GlassRegionHandle interface survives)
│
├── hooks/
│   ├── useGlassRegion.ts           # UNCHANGED (calls same GlassRegionHandle interface)
│   ├── useGlassEngine.ts           # UNCHANGED
│   └── useAccessibilityPreferences.ts  # UNCHANGED
│
└── wasm/
    └── loader.ts                   # MODIFIED: always external device; add getSceneTexture()

engine/src/
├── main.cpp                        # MODIFIED: delete standalone adapter/device path
├── background_engine.cpp           # MODIFIED: delete glass pass; add getSceneTextureHandle()
├── background_engine.h             # MODIFIED: delete glass structs and methods
└── shaders/
    ├── noise.wgsl.h                # UNCHANGED
    ├── image_blit.wgsl.h           # UNCHANGED
    └── glass.wgsl.h                # DELETED (shader moves to src/renderer/glass.wgsl)
```

---

## Architectural Patterns

### Pattern 1: preinitializedWebGPUDevice (Device Handoff)

**What:** JS creates `GPUDevice` via `navigator.gpu`, injects it into the emdawnwebgpu object
table via `WebGPU.importJsDevice(device)`, then passes the resulting `uintptr_t` handle to
`initWithExternalDevice(handle)` in C++. C++ calls `wgpu::Device::Acquire(handle)`.

**When to use:** Any time JS must own the GPU device lifecycle (to share it, control teardown,
or use it in JS WebGPU code simultaneously).

**Trade-offs:** Requires `Module.externalDeviceMode = true` before WASM `main()` runs (via
`moduleOptions` in `createEngineModule`). The existing `loader.ts` already implements this
path when `options?.device` is supplied. In v3.0 this path becomes the only path — the
standalone adapter/device path in `main.cpp` is deleted entirely.

**Existing code to keep:** `loader.ts` lines 75–89 (the `if (options?.device)` block).
The `moduleOptions.externalDeviceMode = true` pre-run flag and `WebGPU.importJsDevice` →
`initWithExternalDevice` sequence is already correct and tested.

### Pattern 2: Shared Texture via Handle Export (Zero-Copy Bridge)

**What:** C++ engine exposes `getSceneTextureHandle()` which calls `clone.MoveToCHandle()` on
the `offscreenTexture` to produce a `uintptr_t`. JS calls `WebGPU.getJsObject(handle)` to
retrieve the `GPUTexture` JS object pointing to the same GPU allocation.

**When to use:** Zero-copy texture sharing between WASM and JS WebGPU code. No GPU memory
duplication.

**Trade-offs:** The handle is only valid while the texture exists. After `engine.resize()`, a
new `offscreenTexture` is created — `getSceneTexture()` must be called again and
`GlassRenderer.setSceneTexture()` must be called to rebuild the bind group.

**Existing code to keep:** `getBackgroundTextureHandleJS()` in `main.cpp` already does
`MoveToCHandle()`. In v3.0 rename to `getSceneTextureHandleJS()`.

### Pattern 3: JS-Owned Render Loop (rAF Controls Everything)

**What:** Remove `emscripten_set_main_loop(MainLoop)` from C++. GlassProvider owns a
`requestAnimationFrame` loop that calls `engine.update(dt)`, `engine.renderBackground()`,
then `glassRenderer.render()` in sequence.

**When to use:** When rAF must coordinate two rendering systems writing to different resources.

**Trade-offs:** C++ `main()` can no longer self-drive its loop. The WASM module becomes
purely reactive — it only renders when JS calls it. This is the correct model for a library.

**Change required:** Replace `emscripten_set_main_loop(MainLoop, 0, false)` in `main.cpp`
with a no-op (or delete it). Rename `render()` to `renderBackground()` (or keep `render()`
scoped to Pass 1 only). Expose it as a new Embind binding.

### Pattern 4: TypeScript GlassRegion State (Morph Lerp in JS)

**What:** Port `GlassRegion` / `GlassUniforms` C++ structs to TypeScript interfaces. Port
`lerpUniforms()` / exponential decay lerp to TypeScript. `GlassRenderer` holds
`regions: GlassRegionState[]` and runs morph interpolation in `render()`.

**When to use:** Required once the glass pass moves to JS. Morph state is JS-side and does
not need to cross the WASM bridge.

**Trade-offs:** Duplicates lerp logic in TypeScript, but the logic is trivial (15 scalar
fields, one-liner lerp each). Eliminates a WASM call per frame per region.

---

## What to Reuse vs. Rewrite

### Reuse Directly (No Changes)

| Item | Why |
|------|-----|
| `src/context/GlassContext.ts` | `GlassRegionHandle` interface is implementation-agnostic |
| `src/hooks/useGlassRegion.ts` | Calls `GlassRegionHandle` methods — unchanged |
| `src/hooks/useGlassEngine.ts` | Reads `GlassContext` — unchanged |
| `src/hooks/useAccessibilityPreferences.ts` | Unchanged |
| `src/components/types.ts` | Unchanged |
| `GlassPanel`, `GlassButton`, `GlassCard` | Use `useGlassRegion` — unchanged |
| `engine/src/shaders/noise.wgsl.h` | Noise shader stays in C++ |
| `engine/src/shaders/image_blit.wgsl.h` | Image blit stays in C++ |
| C++ `uploadImageData`, `setBackgroundMode` | Background-only concern — unchanged |

### Migrate (Port to TypeScript)

| Item | From | To |
|------|------|----|
| `GlassUniforms` struct | `background_engine.h` | `src/renderer/GlassRegionState.ts` |
| `GlassRegion` struct | `background_engine.h` | `src/renderer/GlassRegionState.ts` |
| `lerpUniforms()` | `background_engine.cpp` | `src/renderer/morphLerp.ts` |
| `addGlassRegion()` logic | C++ | `GlassRenderer.addRegion()` |
| `setRegionXxx()` methods (17 variants) | C++ | `GlassRenderer.setRegionXxx()` |
| `MAX_GLASS_REGIONS = 16` | C++ constant | TypeScript constant |
| `glass.wgsl` shader source | `engine/src/shaders/glass.wgsl.h` (C string literal) | `src/renderer/glass.wgsl` (Vite raw import `?raw`) |

### Rewrite (New JS Code)

| Item | Notes |
|------|-------|
| `GlassRenderer` class | Central new component — wraps device, pipeline, uniform buffer, render loop |
| Glass pipeline creation in JS | Port `createGlassPipeline()` / `createGlassBindGroup()` to WebGPU JS API |
| Uniform buffer management in JS | Port dynamic-offset buffer logic (stride, `MAX_GLASS_REGIONS + 1` slots) to TypeScript |
| `GlassProvider` device init | Add `navigator.gpu` adapter/device acquisition; feed device to both systems |
| `getSceneTexture()` helper in `loader.ts` | Wrap `getSceneTextureHandleJS()` → `WebGPU.getJsObject()` → `GPUTexture` |

### Delete from C++

| Item | Notes |
|------|-------|
| `BackgroundEngine::createGlassPipeline()` | Moved to JS |
| `BackgroundEngine::createGlassBindGroup()` | Moved to JS |
| `BackgroundEngine::lerpUniforms()` | Moved to JS |
| `GlassRegion regions[MAX_GLASS_REGIONS]` | Moved to JS |
| `glassUniformBuffer`, `glassPipeline`, `glassSampler`, related members | Moved to JS |
| `BackgroundEngine::addGlassRegion()` and all `setRegionXxx()` | Moved to JS |
| Embind bindings for glass region methods | Moved to JS |
| `OnAdapterAcquired` / `OnDeviceAcquired` in `main.cpp` | JS now owns device |
| `emscripten_set_main_loop(MainLoop)` | JS rAF owns frame loop |
| `glass.wgsl.h` | Shader migrated to `src/renderer/glass.wgsl` |

---

## Suggested Build Order (Phase Dependencies)

```
Phase 1: WASM Thinning
  ├─ Delete glass pass from BackgroundEngine (createGlassPipeline, render Pass 2)
  ├─ Delete glass region management from BackgroundEngine and Embind
  ├─ Add getSceneTextureHandle() Embind export (rename from getBackgroundTextureHandleJS)
  ├─ Add renderBackground() Embind export (scoped to Pass 1 only)
  ├─ Remove standalone device init from main.cpp (delete OnAdapterAcquired/OnDeviceAcquired)
  └─ Remove emscripten_set_main_loop — BackgroundEngine becomes call-driven
  Deliverable: WASM binary that only does background rendering; clean boundary

Phase 2: JS GlassRenderer Core
  ├─ GlassRegionState.ts (TypeScript port of GlassUniforms + GlassRegion)
  ├─ morphLerp.ts (TypeScript port of lerpUniforms + exponential decay)
  ├─ Copy glass.wgsl.h shader source into src/renderer/glass.wgsl (strip C string wrapper)
  ├─ GlassRenderer.ts: device/pipeline init, createUniformBuffer, createGlassBindGroup
  └─ GlassRenderer.render(): background blit draw + per-region alpha-blend draw
  Deliverable: GlassRenderer renders glass on a synthetic GPUTexture in isolation

Phase 3: Wire GlassProvider
  ├─ GlassProvider acquires GPUDevice via navigator.gpu (with error handling)
  ├─ Pass device to initEngine({ device }) — already tested; simplify to always-external path
  ├─ Call getSceneTexture() to get C++ offscreen texture as JS GPUTexture
  ├─ Pass texture to GlassRenderer.setSceneTexture()
  ├─ Replace C++ region method proxies with GlassRenderer calls via GlassRegionHandle
  ├─ Own rAF loop in GlassProvider: update → renderBackground → glassRenderer.render()
  └─ ResizeObserver: after resize call getSceneTexture() again to refresh bind group
  Deliverable: Full stack works end-to-end; React components render glass over C++ background

Phase 4: Visual Validation and Tuning
  ├─ Re-run coordinate-descent tuner (params may shift due to pipeline change)
  └─ Verify pixelmatch diff against iOS reference screenshots
  Deliverable: Visual parity maintained post-architecture change
```

**Dependency rationale:**

- Phase 1 must come before Phase 3 — C++ surface/glass pass conflicts with JS glass pass;
  both cannot write to the surface simultaneously
- Phase 2 can run in parallel with Phase 1 — GlassRenderer can be tested against a synthetic
  `device.createTexture(...)` without needing the thinned WASM
- Phase 3 requires both Phase 1 (WASM exposes `getSceneTextureHandle` / `renderBackground`)
  and Phase 2 (GlassRenderer exists and accepts a texture)
- Phase 4 requires Phase 3 to be visually stable before tuning

---

## Anti-Patterns

### Anti-Pattern 1: Keeping Two rAF Loops

**What people do:** Leave `emscripten_set_main_loop(MainLoop)` in C++ while adding a
`requestAnimationFrame` loop in JS for the glass pass.

**Why it's wrong:** Two independent loops produce tearing — the glass pass reads the
offscreen texture mid-update. The C++ loop also burns GPU time when the tab is hidden.

**Do this instead:** Remove `emscripten_set_main_loop` entirely. Drive all rendering from a
single JS `requestAnimationFrame` callback: `engine.update(dt)`, then
`engine.renderBackground()`, then `glassRenderer.render()` in that order.

### Anti-Pattern 2: Recreating the Glass Pipeline on Every Resize

**What people do:** Tear down and reinitialize `GlassRenderer` after `engine.resize()` to
pick up new resolution values.

**Why it's wrong:** Pipeline compilation takes ~10ms. Resolution is a uniform value, not a
pipeline constant.

**Do this instead:** Pass canvas dimensions as uniform data in `GlassUniforms.resolution`.
On resize, only rebuild the glass bind group (to reference the new `offscreenTextureView`)
and update resolution in the uniform buffer. The pipeline itself never needs recreation.

### Anti-Pattern 3: Routing Region State Through the WASM Bridge

**What people do:** Keep `BackgroundEngine::setRegionXxx()` in C++ and call them from
`GlassRegionHandle` implementations.

**Why it's wrong:** In v3.0 the glass pass is entirely in JS. C++ no longer reads region
data. Every call becomes a round-trip with no consumer.

**Do this instead:** `GlassRegionHandle` implementations call `GlassRenderer.setRegionXxx()`
directly. The WASM bridge is only used for `update(dt)`, `renderBackground()`, `resize()`,
and `getSceneTextureHandle()`.

### Anti-Pattern 4: Calling getSceneTexture() Every Frame

**What people do:** Call `getSceneTextureHandle()` → `WebGPU.getJsObject()` on every rAF to
get a fresh reference to the scene texture.

**Why it's wrong:** The texture handle is stable between resize events. The `getJsObject`
lookup has overhead and is unnecessary when the texture has not changed.

**Do this instead:** Cache the `GPUTexture` reference in `GlassRenderer`. Only refresh after
`engine.resize()` by calling `getSceneTexture()` once and calling
`renderer.setSceneTexture(tex)` to rebuild the bind group.

---

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| GlassProvider ↔ GlassRenderer | Direct TypeScript method calls | Provider creates and drives GlassRenderer |
| GlassProvider ↔ WASM EngineModule | `loader.ts` typed interface | EngineModule needs two additions: `renderBackground()` and `getSceneTextureHandle()` |
| GlassRenderer ↔ GPU device | WebGPU JS API | Same `GPUDevice` instance shared with C++ WASM |
| WASM ↔ GPU device | emdawnwebgpu (`wgpu::Device::Acquire(handle)`) | Device shared via integer handle injection |

### Key Contract: Texture Lifetime

The `offscreenTexture` inside C++ `BackgroundEngine` is the sole handoff point. Its lifetime:

1. Created during `BackgroundEngine.init()` — stable until first `resize()`
2. Destroyed and recreated on every `BackgroundEngine.resize()` call
3. `GlassProvider` must call `getSceneTexture()` and `glassRenderer.setSceneTexture(tex)`
   immediately after every `engine.resize()` in the `ResizeObserver` handler

Failure to refresh after resize causes glass pass to sample a destroyed texture view —
results in black screen or WebGPU validation errors.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1–16 glass regions | Dynamic uniform buffer offset approach handles this; no changes needed |
| 16+ regions | Increase `MAX_GLASS_REGIONS` or switch to storage buffer per-region data |
| External engine (e.g. `sc`) as background | Architecture directly supports it: pass external scene texture to `GlassRenderer.setSceneTexture(tex)`; skip C++ background engine entirely |
| Multiple GlassProvider instances | Each would need its own GPUDevice or shared device reference — deferred; not a current use case |

---

## Sources

- Codebase analysis: `engine/src/background_engine.h`, `background_engine.cpp`, `main.cpp` (v2.0)
- Codebase analysis: `src/wasm/loader.ts`, `src/components/GlassProvider.tsx` (v2.0)
- Codebase analysis: `engine/src/shaders/glass.wgsl.h` — full shader implementation reviewed
- Project context: `.planning/PROJECT.md` — v3.0 goals, key decisions table, reference pattern
- emdawnwebgpu handoff: `loader.ts` lines 75–89 implement `preinitializedWebGPUDevice` already;
  `main.cpp` lines 96–107 implement the C++ counterpart via `EM_ASM`

---
*Architecture research for: glass-react v3.0 JS/WebGPU glass pipeline redesign*
*Researched: 2026-03-24*

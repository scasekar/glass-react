# Phase 15: WASM Thinning - Research

**Researched:** 2026-03-24
**Domain:** C++ WebGPU engine surgery — delete glass pass, expose background-only interface, flip device ownership to JS
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEV-01 | JS creates GPUDevice via navigator.gpu.requestAdapter/requestDevice before WASM initialization | Pattern already implemented in `loader.ts` lines 86-89; needs to become the only init path |
| DEV-02 | JS injects GPUDevice into C++ WASM engine via importJsDevice/initWithExternalDevice pattern | Already validated in production; `moduleOptions.externalDeviceMode = true` + `WebGPU.importJsDevice` + `initWithExternalDevice` sequence is correct and tested |
| DEV-03 | C++ engine renders only background (noise/image) to offscreen texture — all glass shader code removed | `createGlassPipeline`, `createGlassBindGroup`, `lerpUniforms`, all `setRegionXxx` and `addGlassRegion` methods, `GlassRegion regions[]`, `glassUniformBuffer`, `glassPipeline`, Pass 2 in `render()`, all 17 region Embind bindings — exact deletion list enumerated |
| DEV-04 | C++ exposes scene texture handle via getSceneTextureHandle() for JS consumption | `getBackgroundTextureHandleJS()` already exists — rename to `getSceneTextureHandleJS()`, promote as primary export, add `getSceneTexture()` helper in `loader.ts` |
| DEV-05 | JS owns the requestAnimationFrame render loop — emscripten_set_main_loop removed, C++ becomes call-driven | Two `emscripten_set_main_loop(MainLoop, 0, false)` calls in `main.cpp` (lines 104 and 115) both deleted; `renderBackground()` Embind export added, `MainLoop` function deleted |
</phase_requirements>

---

## Summary

Phase 15 is a C++ surgery phase. The codebase has been read in full. All changes are precisely enumerated — there is nothing to discover; only to execute correctly. The v2.0 `BackgroundEngine` handles both Pass 1 (noise/image → offscreenTexture) and Pass 2 (glass shader → surface). Phase 15 deletes Pass 2 entirely from C++ and removes the self-owned rAF loop, leaving a call-driven background renderer.

The external-device path already exists and is validated. `loader.ts` sets `moduleOptions.externalDeviceMode = true`, calls `module.WebGPU.importJsDevice(device)` to get a handle, then calls `module.initWithExternalDevice(handle)`. The C++ side receives the handle in `initWithExternalDevice()` and calls `wgpu::Device::Acquire(reinterpret_cast<WGPUDevice>(handle))`. This sequence is correct and production-tested. In v3.0 this path becomes the only path — the `if (!g_useExternalDevice)` standalone branch in `main()` is deleted.

The primary risk in this phase is not conceptual but operational: the offscreen texture is currently created with `texDesc.format = surfaceFormat` (which resolves to `BGRA8Unorm` on macOS because `initWithExternalDevice` hardcodes `wgpu::TextureFormat::BGRA8Unorm`). The JS glass pipeline (Phase 16) will sample this texture expecting `RGBA8Unorm`. This format must be fixed to explicit `wgpu::TextureFormat::RGBA8Unorm` in `createOffscreenTexture()` during this phase — not deferred. The surface can keep its existing format for the swap chain; the offscreen texture must be canonical RGBA8Unorm.

**Primary recommendation:** Execute the deletion list precisely, fix the offscreen texture format to RGBA8Unorm, add `renderBackground()` Embind export, rename the texture handle export, simplify `loader.ts` to always-external path, and verify the thinned build produces a valid background-only render via Playwright.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| C++ / emdawnwebgpu | Emscripten 4.0.16 | WebGPU bindings in C++ | Already in use; `--use-port=emdawnwebgpu` in both compile and link flags |
| Emscripten Embind | bundled with 4.0.16 | Expose C++ functions to JS | Already in use; `-lembind` in link flags |
| TypeScript / loader.ts | TS 5.7 | WASM bridge typed interface | Already in use; `EngineModule` interface will gain `renderBackground()` and `getSceneTexture()` |

### No New Packages

No new npm packages or C++ libraries are required. Phase 15 is pure deletion + rename + thin addition.

---

## Architecture Patterns

### The Exact Deletion List (DEV-03)

From `background_engine.h` — delete from class declaration:
- `static void lerpUniforms(GlassUniforms& current, const GlassUniforms& target, float t);`
- `void createGlassPipeline();`
- `void createGlassBindGroup();`
- All `addGlassRegion()`, `removeGlassRegion()`, `setRegionXxx()` method declarations (18 total)
- `GlassUniforms` struct definition (move to a comment or delete entirely)
- `GlassRegion` struct definition
- `static constexpr uint32_t MAX_GLASS_REGIONS = 16;`
- Private members: `glassSampler`, `glassShaderModule`, `glassPipeline`, `glassBindGroupLayout`, `glassBindGroup`, `glassUniformBuffer`, `GlassRegion regions[MAX_GLASS_REGIONS]`, `uniformStride`
- Keep: `wgpu::Texture getBackgroundTexture() const { return offscreenTexture; }` → rename method to `getSceneTexture()`

From `background_engine.cpp` — delete bodies:
- `lerpUniforms()` — full function
- `createGlassPipeline()` — full function
- `createGlassBindGroup()` — full function
- All `addGlassRegion()`, `removeGlassRegion()`, `setRegionXxx()` bodies (18 functions, ~120 lines)
- Morph interpolation loop in `update()` — delete the `for (uint32_t i = 0; i < MAX_GLASS_REGIONS; i++)` block
- `GlassRegion regions[MAX_GLASS_REGIONS]` init in `init()` — delete `uniformStride` query and `createGlassPipeline()` call
- Pass 2 block in `render()` — delete the entire `=== PASS 2 ===` block (~55 lines, lines 523-577)
- `#include "shaders/glass.wgsl.h"` — delete

From `main.cpp` — delete / modify:
- `void MainLoop()` function — delete entirely (18 lines)
- `OnAdapterAcquired()` function — delete entirely
- `OnDeviceAcquired()` function — delete entirely
- `wgpu::Adapter g_adapter;` global — delete
- In `main()`: delete the `if (!g_useExternalDevice)` standalone branch; keep only external device path; remove both `emscripten_set_main_loop(MainLoop, 0, false)` calls
- Remove `#include <emscripten/html5.h>` (no longer needed without main loop timer)
- Embind: delete all `setRegionXxx`, `addGlassRegion`, `removeGlassRegion` `.function()` registrations from `BackgroundEngine` class binding
- Embind: delete `setExternalBackgroundTexture` (glass pass is gone, no bind group to update)
- Embind: rename `getBackgroundTextureHandle` → `getSceneTextureHandle`
- Embind: add `renderBackground` function (see below)

### The Exact Addition List (DEV-04, DEV-05)

**Add to `BackgroundEngine` — new public method:**
```cpp
// background_engine.h
void renderBackground();  // replaces render() for the background-only pass
```

**`renderBackground()` body** (in `background_engine.cpp`) — Pass 1 only, extracted from current `render()`:
```cpp
void BackgroundEngine::renderBackground() {
    // Update uniform buffer with current time and resolution
    Uniforms uniforms{currentTime, 0.0f, static_cast<float>(width), static_cast<float>(height)};
    device.GetQueue().WriteBuffer(uniformBuffer, 0, &uniforms, sizeof(Uniforms));

    if (externalTextureMode_) return;  // host manages background externally

    wgpu::CommandEncoder encoder = device.CreateCommandEncoder();

    wgpu::RenderPassColorAttachment attachment{};
    attachment.view = offscreenTextureView;
    attachment.loadOp = wgpu::LoadOp::Clear;
    attachment.storeOp = wgpu::StoreOp::Store;
    attachment.clearValue = {0.0f, 0.0f, 0.0f, 1.0f};

    wgpu::RenderPassDescriptor passDesc{};
    passDesc.colorAttachmentCount = 1;
    passDesc.colorAttachments = &attachment;

    wgpu::RenderPassEncoder pass = encoder.BeginRenderPass(&passDesc);

    if (backgroundMode_ == BackgroundMode::Image && hasImageTexture_) {
        pass.SetPipeline(imageBlitPipeline_);
        pass.SetBindGroup(0, imageBlitBindGroup_);
    } else {
        pass.SetPipeline(noisePipeline);
        pass.SetBindGroup(0, noiseBindGroup);
    }
    pass.Draw(3);
    pass.End();

    wgpu::CommandBuffer commands = encoder.Finish();
    device.GetQueue().Submit(1, &commands);
}
```

**Rename in `main.cpp` Embind bindings:**
```cpp
emscripten::function("getSceneTextureHandle", &getSceneTextureHandleJS);
// (rename from getBackgroundTextureHandle)

// Add renderBackground as a BackgroundEngine method binding:
.function("renderBackground", &BackgroundEngine::renderBackground)
// Remove: .function("render", &BackgroundEngine::render)
```

**Fix offscreen texture format in `createOffscreenTexture()`:**
```cpp
// BEFORE (wrong for JS sampling):
texDesc.format = surfaceFormat;  // BGRA8Unorm on macOS
// AFTER (canonical, JS-compatible):
texDesc.format = wgpu::TextureFormat::RGBA8Unorm;
```

Also fix `createNoisePipeline()` and `createImageBlitPipeline()` — both use `colorTarget.format = surfaceFormat`. These must also use `wgpu::TextureFormat::RGBA8Unorm` since they render into the offscreen texture. The surface/swap chain itself keeps `BGRA8Unorm` where still used — but since Pass 2 is deleted, the surface is no longer written by C++ at all.

**Update `resize()` in `background_engine.cpp`:** After deleting the glass pass, the `surface.Configure()` call in `resize()` must also be removed — JS owns the canvas and its surface configuration in v3.0. The surface member variable itself can be removed from the class.

### loader.ts Changes (DEV-01, DEV-02)

**Simplify `initEngine()`** — external device path becomes mandatory:

```typescript
// src/wasm/loader.ts
export async function initEngine(device: GPUDevice): Promise<EngineModule> {
  if (!navigator.gpu) {
    throw new Error('WebGPU is not supported. Use Chrome 113+ or Edge 113+.');
  }
  const createEngineModule = (await import('../../engine/build-web/engine.js')).default;

  // Always external device mode in v3.0
  const module = await createEngineModule({ externalDeviceMode: true }) as EngineModule;

  const handle = module.WebGPU!.importJsDevice(device);
  module.initWithExternalDevice(handle);

  return module;
}
```

**Add `getSceneTexture()` helper to `loader.ts`:**

```typescript
export function getSceneTexture(module: EngineModule): GPUTexture | null {
  const handle = module.getSceneTextureHandle();
  if (!handle) return null;
  return module.WebGPU!.getJsObject(handle) as GPUTexture;
}
```

**Update `EngineModule` interface** — remove all region methods, add `renderBackground()` and `getSceneTextureHandle()`:

```typescript
export interface EngineModule {
  getEngine(): {
    resize(w: number, h: number): void;
    renderBackground(): void;   // NEW - replaces render()
    setDpr(dpr: number): void;
    setPaused(paused: boolean): void;
    setReducedTransparency(enabled: boolean): void;
    setExternalTextureMode(enabled: boolean): void;
    update(deltaTime: number): void;
  } | null;
  destroyEngine(): void;
  initWithExternalDevice(handle: number): void;
  uploadImageData(pixelPtr: number, width: number, height: number): void;
  setBackgroundMode(mode: number): void;
  setExternalTextureMode(enabled: boolean): void;
  getSceneTextureHandle(): number;   // renamed from getBackgroundTextureHandle
  _malloc(size: number): number;
  _free(ptr: number): void;
  HEAPU8: Uint8Array;
  WebGPU?: {
    Internals: { jsObjectInsert(ptr: number, obj: unknown): void; jsObjects: Record<number, unknown>; };
    importJsDevice(device: GPUDevice, parentPtr?: number): number;
    getJsObject(handle: number): unknown;
  };
}
```

### Surface Ownership — Key Decision

In v2.0, C++ creates a `wgpu::Surface` from `#gpu-canvas`, configures it, and renders Pass 2 into it. In v3.0, C++ no longer renders to the surface — Pass 2 moves to JS in Phase 16. Phase 15 must decide what happens to the surface.

**Decision for Phase 15:** C++ stops configuring the canvas surface. The `surface` member and `surface.Configure()` calls are removed from `BackgroundEngine`. The `initWithExternalDevice()` function in `main.cpp` still creates a `wgpu::Surface` today (it calls `instance.CreateSurface(&surfaceDesc)`) — this must also be removed. The canvas HTML element stays in the DOM; JS will configure it as a `GPUCanvasContext` in Phase 16/17. No surface creation or configuration belongs in C++ after Phase 15.

This means `wgpu::Surface surface` and `wgpu::TextureFormat surfaceFormat` are removed from `BackgroundEngine`. The offscreen texture format is now hardcoded to `wgpu::TextureFormat::RGBA8Unorm` (independent of any surface format query).

### Recommended Project Structure After Phase 15

```
engine/src/
├── main.cpp                  MODIFIED: delete OnAdapterAcquired, OnDeviceAcquired,
│                             MainLoop, standalone init branch, both emscripten_set_main_loop
│                             calls; simplify to external-device-only; update Embind
├── background_engine.h       MODIFIED: delete GlassUniforms, GlassRegion, MAX_GLASS_REGIONS,
│                             all glass pass methods and members; rename getBackgroundTexture
│                             to getSceneTexture; remove surface and surfaceFormat members
├── background_engine.cpp     MODIFIED: delete Pass 2 from render(), delete all glass
│                             methods, delete lerpUniforms, morph loop in update();
│                             rename render() → renderBackground(); fix RGBA8Unorm format
└── shaders/
    ├── noise.wgsl.h          UNCHANGED
    ├── image_blit.wgsl.h     UNCHANGED
    ├── blit.wgsl.h           UNCHANGED (unused? verify)
    └── glass.wgsl.h          DELETED (shader content needed by Phase 16, but the file
                               itself stays as source material until Phase 16 copies it)

src/wasm/
└── loader.ts                 MODIFIED: always-external device path; new getSceneTexture()
                               helper; updated EngineModule interface (remove all region
                               methods, add renderBackground, rename texture handle export)
```

### Anti-Patterns to Avoid

- **Keeping `emscripten_set_main_loop` for any path:** Both calls (lines 104 and 115 of `main.cpp`) must be deleted. The external device path sets up the loop and returns; the standalone path also sets it up. Both go away.
- **Deferring the RGBA8Unorm fix:** The noise and image blit pipelines currently target `surfaceFormat` for their color attachment. If this is not fixed in Phase 15, Phase 16 will sample a BGRA texture and get channel-swapped output on macOS.
- **Keeping glass-related Embind bindings as no-ops:** Delete them. Dead code in Embind still bloats the WASM binary (DEV-03 success criterion includes smaller WASM binary size than v2.0).
- **Removing the surface but leaving surface.Configure() in resize():** `resize()` currently calls `surface.Configure()` — this must go when the surface member is removed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Texture format negotiation between C++ and JS | Custom format detection protocol | Hardcode `wgpu::TextureFormat::RGBA8Unorm` in C++ offscreen texture | RGBA8Unorm is universally supported for sampling; no negotiation needed |
| JS polling for engine ready state | New polling mechanism | Keep existing `while (!module.getEngine()) { await sleep(50) }` pattern in loader | Already validated; async C++ init still resolves via `initWithExternalDevice` |
| WASM binary size measurement | Custom tooling | Use `wc -c engine/build-web/engine.js` before and after | Single-file build (`-sSINGLE_FILE=1`); size is directly in the .js file |

---

## Common Pitfalls

### Pitfall 1: Double emscripten_set_main_loop
**What goes wrong:** `main.cpp` has two `emscripten_set_main_loop` calls — one at line 104 (external device path) and one at line 115 (standalone path). The external device path exits early after setting the loop, so currently the loop IS set when using external device. Deleting only the standalone path's loop while leaving the external device path's loop means C++ still self-drives. Both must go.
**How to avoid:** Delete `MainLoop()` function, then grep for `emscripten_set_main_loop` to confirm zero occurrences remain.
**Warning signs:** C++ still logs render output when JS has not called `renderBackground()`.

### Pitfall 2: Surface Format Propagation to Offscreen Texture
**What goes wrong:** `createNoisePipeline()` and `createImageBlitPipeline()` both set `colorTarget.format = surfaceFormat`. The offscreen texture is also created with `texDesc.format = surfaceFormat`. On macOS, `surfaceFormat` = `BGRA8Unorm`. After removing the surface, if these three locations are not updated to `RGBA8Unorm`, the pipeline-texture format mismatch causes a WebGPU validation error.
**How to avoid:** Replace `surfaceFormat` in ALL three locations: `createNoisePipeline()`, `createImageBlitPipeline()`, `createOffscreenTexture()`. Introduce a constant `constexpr wgpu::TextureFormat kOffscreenFormat = wgpu::TextureFormat::RGBA8Unorm;` in `background_engine.cpp`.
**Warning signs:** WebGPU device uncaptured error: "Render pass color attachment format mismatch" during background rendering.

### Pitfall 3: `resize()` Still Calls `surface.Configure()`
**What goes wrong:** The `resize()` method configures the surface with new dimensions. After removing the surface member, this crashes or produces a null pointer dereference.
**How to avoid:** Remove the `wgpu::SurfaceConfiguration config{}` block from `resize()`. The method should only recreate the offscreen texture.
**Warning signs:** Crash or WebGPU validation error on first `ResizeObserver` callback after Phase 15.

### Pitfall 4: `externalDeviceMode` Branch Still Starts `MainLoop`
**What goes wrong:** In the current `main()`, the external device path sets up `emscripten_set_main_loop(MainLoop, 0, false)` and returns 0. If the deletion leaves this path intact (keeping the loop), C++ calls the deleted `MainLoop` function.
**How to avoid:** Delete `MainLoop()` first. The external device path in `main()` should simply `return 0` after setting the flag — nothing else. The rAF is owned by JS.
**Warning signs:** Linker error (if `MainLoop` is deleted but `emscripten_set_main_loop` call remains) or undefined behavior (if the call remains and loops on a null engine).

### Pitfall 5: AllowSpontaneous Pattern Preserved
**What goes wrong:** During C++ restructuring, if any new async WebGPU init is added that uses `WaitAny()` twice, the known emdawnwebgpu double-WaitAny corruption reoccurs (crashes `wgpu::Instance` internal reference).
**How to avoid:** In the JS-creates-device path, C++ receives an already-resolved device — zero `WaitAny` calls are needed. The `OnAdapterAcquired`/`OnDeviceAcquired` callbacks (which used `AllowSpontaneous`) are being deleted entirely. No new async C++ init is being added.
**Warning signs:** `getEngine()` returns null indefinitely after `initWithExternalDevice()` is called.

### Pitfall 6: `blit.wgsl.h` — Verify if In Use
**What goes wrong:** `engine/src/shaders/blit.wgsl.h` exists on disk but is not included in `background_engine.cpp`. It may be dead code.
**How to avoid:** Grep for `#include "shaders/blit.wgsl.h"` — if no files include it, it is safe to leave in place (does not affect binary size since it is only a C++ header that is not compiled in). Do not remove it as part of this phase unless confirmed dead, to avoid scope creep.

---

## Code Examples

Verified from `engine/src/main.cpp` and `engine/src/background_engine.cpp`:

### Current initWithExternalDevice() (main.cpp lines 131-157) — target of simplification
```cpp
void initWithExternalDevice(uintptr_t deviceHandle) {
    wgpu::Device device = wgpu::Device::Acquire(reinterpret_cast<WGPUDevice>(deviceHandle));
    // Surface creation → DELETE in Phase 15
    wgpu::Instance instance = wgpu::CreateInstance();
    wgpu::SurfaceDescriptor surfaceDesc{};
    wgpu::EmscriptenSurfaceSourceCanvasHTMLSelector canvasSource{};
    canvasSource.selector = "#gpu-canvas";
    surfaceDesc.nextInChain = &canvasSource;
    wgpu::Surface surface = instance.CreateSurface(&surfaceDesc);
    wgpu::TextureFormat format = wgpu::TextureFormat::BGRA8Unorm;
    wgpu::SurfaceConfiguration config{};
    config.device = device;
    config.format = format;
    config.width = 512;
    config.height = 512;
    surface.Configure(&config);
    // Engine init — keep, but pass no surface
    g_engine = new BackgroundEngine();
    g_engine->init(device, surface, format, 512, 512);  // → g_engine->init(device, 512, 512);
}
```

After Phase 15, `init()` signature changes to `void init(wgpu::Device dev, uint32_t w, uint32_t h)` — no surface, no format parameter.

### getBackgroundTextureHandleJS (main.cpp lines 185-190) — rename target
```cpp
// Source: engine/src/main.cpp (current)
uintptr_t getBackgroundTextureHandleJS() {
    if (!g_engine) return 0;
    wgpu::Texture tex = g_engine->getBackgroundTexture();
    wgpu::Texture clone = tex;
    return reinterpret_cast<uintptr_t>(clone.MoveToCHandle());
}
// Rename to: getSceneTextureHandleJS()
// BackgroundEngine method: getBackgroundTexture() → getSceneTexture()
```

### loader.ts getSceneTexture helper (new)
```typescript
// Source: pattern derived from loader.ts existing getBackgroundTextureHandle usage
export function getSceneTexture(module: EngineModule): GPUTexture | null {
  const handle = module.getSceneTextureHandle();
  if (!handle) return null;
  return module.WebGPU!.getJsObject(handle) as GPUTexture;
}
```

### Offscreen texture format fix
```cpp
// Source: engine/src/background_engine.cpp createOffscreenTexture()
// BEFORE:
texDesc.format = surfaceFormat;  // resolves to BGRA8Unorm on macOS
// AFTER:
constexpr wgpu::TextureFormat kOffscreenFormat = wgpu::TextureFormat::RGBA8Unorm;
texDesc.format = kOffscreenFormat;
// Also fix in createNoisePipeline() and createImageBlitPipeline():
colorTarget.format = kOffscreenFormat;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `preinitializedWebGPUDevice` + `emscripten_webgpu_get_device()` | `WebGPU.importJsDevice()` + `initWithExternalDevice()` | Emscripten 4.0.10 | Old pattern removed; new pattern already in codebase |
| C++ owns GPUDevice (self-calls RequestAdapter/RequestDevice) | JS creates GPUDevice, passes handle to C++ | v3.0 Phase 15 | C++ device init code (OnAdapterAcquired, OnDeviceAcquired) is deleted |
| `emscripten_set_main_loop` drives rendering from C++ | JS `requestAnimationFrame` drives rendering | v3.0 Phase 15 | C++ becomes purely reactive; MainLoop deleted |

**Deprecated/outdated in this phase:**
- `BackgroundEngine::render()`: replaced by `BackgroundEngine::renderBackground()` (Pass 1 only)
- `BackgroundEngine::addGlassRegion()` and all `setRegionXxx()` methods: moved to JS in Phase 16
- `GlassUniforms` / `GlassRegion` C++ structs: moved to TypeScript in Phase 16
- `glass.wgsl.h` include: glass shader moves to `src/renderer/glass.wgsl` in Phase 16

---

## Open Questions

1. **`blit.wgsl.h` usage**
   - What we know: The file exists at `engine/src/shaders/blit.wgsl.h` but is not included in `background_engine.cpp` or `main.cpp`
   - What's unclear: Is it referenced anywhere else, or is it dead code?
   - Recommendation: `grep -r "blit.wgsl.h" engine/src/` at task start; if zero results, leave in place — no action needed

2. **`setExternalTextureMode` / `externalBgTexture_` in v3.0**
   - What we know: `externalTextureMode_` skips Pass 1 when set; `externalBgTexture_` allows a JS-injected texture to substitute the offscreen texture for glass bind group. Both are used in GlassProvider v2.0 when `device` prop is set.
   - What's unclear: In Phase 15, the glass bind group is deleted entirely from C++. The `externalBgTexture_` and `setExternalBackgroundTexture()` are glass-pass concerns — they should be deleted along with the glass pass. `setExternalTextureMode` / `externalTextureMode_` can stay (it controls whether Pass 1 runs).
   - Recommendation: Delete `externalBgTexture_`, `externalBgTextureView_`, `setExternalBackgroundTexture()`, and `setExternalBackgroundTextureJS()` from all files. Keep `externalTextureMode_` and its setter.

3. **GlassProvider — what to do with it in Phase 15**
   - What we know: GlassProvider currently calls `engine.addGlassRegion()`, `engine.setRegionXxx()` etc. — all of which are deleted in this phase. However, Phase 15 scope only covers the C++ engine and loader.ts.
   - What's unclear: Does GlassProvider need updating in Phase 15 or in Phase 17?
   - Recommendation: GlassProvider updates belong to Phase 17 (React Integration). Phase 15 should only touch `engine/src/` and `src/wasm/loader.ts`. GlassProvider will fail to compile after loader.ts changes, so either (a) update EngineModule interface to remove deleted methods AND update GlassProvider's callsites to stub them out, or (b) keep backward-compat stubs. The cleanest approach: update `EngineModule` interface in loader.ts to remove deleted methods, and temporarily comment out or guard the region calls in GlassProvider with a `// TODO Phase 17` note so the app still compiles and runs (rendering only background, no glass).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright + pixelmatch (already installed, `npm run diff`) |
| Config file | No formal test config — `pipeline/diff.ts` and `pipeline/tune.ts` are the test scripts |
| Quick run command | `npm run build:wasm && npm run dev:demo` (manual visual check) |
| Full suite command | `npm run diff` (Playwright + pixelmatch against iOS reference) |

No unit test framework (Jest/Vitest) is installed. Phase 15 testing is build-level: does the WASM compile? Does the background render correctly as a standalone pass?

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEV-01 | JS creates GPUDevice before WASM init | smoke | `npm run build:wasm` (build succeeds) + manual DevTools check | ❌ Wave 0 |
| DEV-02 | importJsDevice / initWithExternalDevice is the only init path | smoke | `npm run build:wasm` + check no standalone RequestAdapter calls in output | ❌ Wave 0 |
| DEV-03 | Glass shader code removed from binary | smoke | `wc -c engine/build-web/engine.js` < v2.0 baseline | ❌ Wave 0 |
| DEV-04 | getSceneTextureHandle() returns valid texture handle | smoke | `npm run dev:demo` + console.log of handle !== 0 | ❌ Wave 0 |
| DEV-05 | No emscripten_set_main_loop; C++ is call-driven | smoke | `grep "emscripten_set_main_loop" engine/src/main.cpp` = 0 results | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run build:wasm` (WASM compilation must succeed)
- **Per wave merge:** `npm run build:wasm && npm run dev:demo` (manual: background renders, no glass regions visible, no console errors)
- **Phase gate:** `npm run build:wasm` succeeds AND background renders correctly (noise or image fills canvas) AND `wc -c engine/build-web/engine.js` is smaller than v2.0 size

### Wave 0 Gaps

- [ ] No automated test for DEV-01 through DEV-05 — these are structural/binary checks, not regression tests. The existing `npm run diff` script tests visual parity against iOS (Phase 18 concern). For Phase 15, verification is: WASM compiles, background renders, binary is smaller.
- [ ] A minimal smoke test script at `pipeline/smoke-phase15.ts` would help: load the engine, create a GPUDevice in JS, init engine, call `renderBackground()` once, check `getSceneTextureHandle() !== 0`. This is Wave 0 work if automation is desired.

*(Existing infrastructure (`npm run diff`, `npm run tune`) is Phase 18 tooling and is unaffected by Phase 15 changes.)*

---

## Sources

### Primary (HIGH confidence)
- Live codebase: `engine/src/main.cpp` — read in full; exact lines identified for deletion/modification
- Live codebase: `engine/src/background_engine.h` — complete struct and class declaration; all members enumerated
- Live codebase: `engine/src/background_engine.cpp` — complete implementation; Pass 1 and Pass 2 code blocks precisely located
- Live codebase: `src/wasm/loader.ts` — complete implementation; `importJsDevice` / `initWithExternalDevice` sequence verified
- Live codebase: `src/components/GlassProvider.tsx` — complete implementation; region call sites identified
- Live codebase: `engine/CMakeLists.txt` — build flags verified (`--use-port=emdawnwebgpu` in both compile and link, `-sSINGLE_FILE=1`)
- `.planning/research/ARCHITECTURE.md` — component responsibility table, data flow diagrams, deletion list
- `.planning/research/PITFALLS.md` — C1 through C8 pitfall inventory with prevention strategies
- `.planning/research/STACK.md` — stack patterns, interop mechanism details
- Project MEMORY.md — `AllowSpontaneous` vs double `WaitAny`; emdawnwebgpu header-only; `--use-port` placement

### Secondary (MEDIUM confidence)
- [Emscripten issue #13888](https://github.com/emscripten-core/emscripten/issues/13888) — `importJsDevice`, `getJsObject` mechanism
- [emdawnwebgpu README](https://dawn.googlesource.com/dawn/+/refs/heads/main/src/emdawnwebgpu/pkg/README.md) — port distribution requirements

### Tertiary (LOW confidence)
- None — all significant claims have primary source backing from the live codebase

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all technologies are live in the codebase
- Architecture: HIGH — all deletions and additions are enumerated from direct source reading; no guesswork
- Pitfalls: HIGH — pitfalls C1, C2, C3, C5 from project research directly apply; specific lines identified in source
- Validation: HIGH — WASM build and manual visual check are the correct gates for a C++ surgery phase; no unit test framework to install

**Research date:** 2026-03-24
**Valid until:** Stable indefinitely — changes are pure deletions and renames; no external API evolution risk

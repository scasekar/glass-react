# Stack Research

**Domain:** JS/WebGPU glass rendering pipeline over C++/WASM background engine
**Researched:** 2026-03-24
**Scope:** v3.0 architecture only — JS/WebGPU device creation, texture sharing, and JS-side glass pipeline. Existing validated stack (Emscripten, emdawnwebgpu, React 19, Vite 6.4, C++20, Playwright, pixelmatch) is unchanged.
**Confidence:** HIGH (core patterns validated against live codebase; interop mechanism verified against emscripten issue #13888 and emdawnwebgpu source)

---

## Context: What v3.0 Changes

The architecture flips ownership of the WebGPU device:

- **v2.0 (current):** C++ engine calls `RequestAdapter` + `RequestDevice` and owns the entire pipeline — background rendering AND glass shaders
- **v3.0 (target):** JS calls `navigator.gpu.requestAdapter()` + `adapter.requestDevice()`, passes device to C++ via emdawnwebgpu interop, C++ renders background only, JS/WebGPU pipeline renders all glass effects

**No new npm packages are required for the core pipeline.** Every required piece is already present: `@webgpu/types` for TypeScript types, the emdawnwebgpu interop bridge (`WebGPU.importJsDevice` / `WebGPU.getJsObject`) for object-table crossing, the WGSL glass shaders (authored in C++ header files, to be ported to TS string literals), and the full Vite/TypeScript build infrastructure.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| WebGPU (browser API) | W3C spec, Chrome 113+/Edge 113+ | JS-side device creation, render pipelines, bind groups, texture reads | Native browser API — no wrapper library needed; already typed via `@webgpu/types` |
| `@webgpu/types` | `^0.1.69` (already installed) | TypeScript types for `GPUDevice`, `GPUTexture`, `GPURenderPipeline`, `GPUBindGroup`, etc. | Official gpuweb types package; `"types": ["@webgpu/types"]` already in `tsconfig.json` |
| emdawnwebgpu interop bridge | Bundled with WASM build (`--use-port=emdawnwebgpu`) | `WebGPU.importJsDevice(jsDevice)` inserts JS `GPUDevice` into C++ object table; `WebGPU.getJsObject(handle)` resolves C++-produced texture pointer back to JS `GPUTexture` | Already validated in v2.0 codebase (`loader.ts` lines 86-89, `main.cpp` `initWithExternalDevice`); no separate install |
| TypeScript | `^5.7.0` (already installed) | Type-safe WebGPU pipeline management | Strict mode + `@webgpu/types` catches WebGPU descriptor errors at compile time; `GPURenderPipelineDescriptor` is fully typed |
| WGSL (inline TS strings) | WebGPU spec | Glass shader code (refraction, blur, Fresnel, chromatic aberration, specular, rim lighting) | Already authored in `engine/src/shaders/glass.wgsl.h`; migrate to TypeScript template literal strings or standalone `.wgsl` files imported with Vite `?raw` |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vite-plugin-wasm` | `^3.5.0` (already installed) | WASM MIME type and async import handling in Vite | Required for Emscripten ESM module loading |
| `vite-plugin-top-level-await` | `^1.4.0` (already installed) | Allows top-level `await` for engine init | Required for clean async WASM init in library entry point |
| `vite-plugin-dts` | `^4.5.4` (already installed) | TypeScript declaration generation for npm publish | Required for `.d.ts` output on `build:lib` |

No new supporting libraries are needed for the JS WebGPU glass pipeline itself.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `createRenderPipelineAsync()` | Async pipeline compilation | Prefer over synchronous `createRenderPipeline()` — avoids GPU stalls while shader compiler runs; resolve the Promise before first render frame |
| `device.lost` promise handler | Device loss recovery | Register on every `GPUDevice` instance; re-init on transient loss; do not re-init if reason is `"destroyed"` |
| `device.addEventListener('uncapturederror', ...)` | Catches WGSL compilation errors and bind group validation errors | WebGPU validation errors are otherwise silent in production; essential during development |

---

## Installation

No new packages required for v3.0. All needed packages are already present.

```bash
# Verify existing packages are current
npm install

# @webgpu/types is already a devDependency at ^0.1.69
# No additional installs needed for the JS WebGPU glass pipeline
```

If WGSL shaders are extracted to standalone `.wgsl` files, Vite handles `?raw` imports natively — no plugin needed:

```typescript
// Vite ?raw suffix — works without any plugin
import glassShaderSource from './shaders/glass.wgsl?raw';
```

---

## How JS WebGPU Rendering Differs from C++ WebGPU Rendering

This section captures the non-obvious differences that matter for the v3.0 migration.

### Device Lifecycle

**C++ (current v2.0):** `wgpu::Instance::RequestAdapter()` + `wgpu::Adapter::RequestDevice()` with `AllowSpontaneous` callbacks. Device lifetime tied to C++ global. The `AllowSpontaneous` mode was critical (double `WaitAny` corrupts emdawnwebgpu's internal Instance reference — see project MEMORY.md).

**JS (v3.0):** `navigator.gpu.requestAdapter()` + `adapter.requestDevice()` — standard async/await. Device lifetime owned by `GlassProvider`. **A `GPUAdapter` instance can only be used once** to call `requestDevice`; subsequent calls return an already-lost device. Store the device, not the adapter.

```typescript
// Correct pattern — device is the long-lived object; adapter can be discarded
const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
if (!adapter) throw new Error('No WebGPU adapter');
const device = await adapter.requestDevice();
device.lost.then(info => {
  if (info.reason !== 'destroyed') { /* re-init */ }
});
// adapter reference no longer needed
```

### Bind Group Immutability and Texture Change

A `GPUBindGroup` is immutable after creation. When the C++ background texture is recreated (e.g., on canvas resize — `BackgroundEngine::createOffscreenTexture()` is called from `resize()`), the JS glass renderer must detect the change and recreate the bind group that references `texBackground`. This is the most common source of stale-bind-group bugs when bridging JS and C++ textures.

Pattern: cache the `GPUTexture` reference returned from `module.WebGPU.getJsObject(handle)`. On each frame (or on resize), compare the current texture reference to the cached one. If different, rebuild all glass bind groups.

### Uniform Buffer Alignment

Both JS and C++ sides follow the same `minUniformBufferOffsetAlignment` rule: dynamic offsets must be multiples of 256 (the WebGPU spec default). The existing `GlassUniforms` struct is 112 bytes. When using dynamic offsets for multi-region rendering, the stride must be padded to 256 bytes:

```
stride = Math.ceil(112 / 256) * 256 = 256 bytes
totalBufferSize = 16 regions × 256 bytes = 4096 bytes
```

This matches what the C++ side already allocates. The JS side must use the same layout when writing uniform data.

### Pipeline Compilation Timing

`createRenderPipelineAsync()` is mandatory for production use. Unlike C++, JS has no compile-time WGSL validation — runtime errors surface as uncaptured device errors. Compile and cache the pipeline during init, before the first render frame.

---

## Device Creation and Texture Sharing Patterns

These are the two critical interop patterns for v3.0.

### Pattern 1: JS Creates Device, Passes to C++

The `preinitializedWebGPUDevice` + `emscripten_webgpu_get_device()` pattern is **deprecated** and scheduled for removal. The current emdawnwebgpu pattern uses an object table managed by `library_webgpu.js`:

```typescript
// Already implemented in src/wasm/loader.ts (lines 86-89)
const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
const device = await adapter.requestDevice();

// Insert JS GPUDevice into emdawnwebgpu's object table → returns integer handle
const handle = module.WebGPU.importJsDevice(device);

// C++ calls: wgpu::Device::Acquire(reinterpret_cast<WGPUDevice>(handle))
module.initWithExternalDevice(handle);
```

The C++ side (`engine/src/main.cpp`, `initWithExternalDevice`) is already implemented. This pattern is validated in v2.0.

### Pattern 2: C++ Exposes Background Texture, JS Reads It

After C++ renders the background to an offscreen texture, JS retrieves the texture to use as input to the glass shader's bind group:

```typescript
// C++ returns a raw WGPUTexture* pointer cast to uintptr_t
// (see main.cpp: getBackgroundTextureHandleJS → clone.MoveToCHandle())
const handle: number = module.getBackgroundTextureHandle();

// Resolve back to JS GPUTexture via emdawnwebgpu's object table
const bgTexture = module.WebGPU.getJsObject(handle) as GPUTexture;

// Create bind group for glass shader
const bindGroup = device.createBindGroup({
  layout: glassPipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: sampler },
    { binding: 1, resource: bgTexture.createView() },
    { binding: 2, resource: {
      buffer: uniformBuffer,
      offset: regionIndex * UNIFORM_STRIDE,  // 256 bytes per region
      size: UNIFORM_STRUCT_SIZE,             // 112 bytes
    }},
  ],
});
```

The C++ function `getBackgroundTextureHandleJS()` already exists in `main.cpp`. The texture has `TextureBinding` usage already set (lines 280-282 of `background_engine.cpp`). No C++ changes required for this pattern.

### Pattern 3: Texture Usage Flags (No Changes Required)

The C++ offscreen background texture already has all required usage flags for JS sampling:

```cpp
// engine/src/background_engine.cpp (already correct)
texDesc.usage = wgpu::TextureUsage::RenderAttachment |
                wgpu::TextureUsage::TextureBinding |   // ← enables JS sampling
                wgpu::TextureUsage::CopyDst;
```

`CopySrc` would only be needed if JS required a copy of the texture (e.g., for a ping-pong blur pass on a separate texture). The current architecture samples directly from the C++ texture within the same frame — no copy needed.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Direct texture sampling (zero-copy, same device) | `copyTextureToTexture` then sample copy | Only if JS and C++ used different `GPUDevice` instances — not applicable here since both share the same device |
| `WebGPU.importJsDevice()` object table | `preinitializedWebGPUDevice` + `emscripten_webgpu_get_device()` | Never — the legacy pattern is deprecated and scheduled for removal |
| `createRenderPipelineAsync()` | `createRenderPipeline()` (synchronous) | Use synchronous only in test harnesses where stalls are acceptable; never in production render loop |
| Dynamic uniform buffer offsets, single 4KB buffer | Separate `GPUBuffer` per glass region | Use per-region buffers only if region count exceeds `maxUniformBufferBindingSize / 256`; 16 regions = 4KB, well within all device limits |
| WGSL as TypeScript template literals | External `.wgsl` files via `?raw` import | Use `?raw` if iterating on shaders heavily during development; both are equivalent in production builds |
| Per-frame bind group cache check (compare texture reference) | Recreate bind groups on every frame | Per-frame recreation would create GC pressure from short-lived objects; cache and invalidate only on resize |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `preinitializedWebGPUDevice` + `emscripten_webgpu_get_device()` | Deprecated in Emscripten; existed only for early-prototype compatibility; scheduled for removal | `WebGPU.importJsDevice(device)` → `module.initWithExternalDevice(handle)` (already implemented in `loader.ts`) |
| `GPUDevice.importExternalTexture()` | Takes only `HTMLVideoElement` or `VideoFrame` — not applicable for a C++-rendered texture | Direct `GPUTexture` sampling via `texture.createView()` in bind group entry |
| `GPUQueue.copyExternalImageToTexture()` from WASM | WASM code cannot call this because it cannot obtain the JS `GPUQueue` object from a raw `WGPUQueue` pointer (emscripten issue #13888) | Already solved: C++ uses `queue.WriteTexture()` for image upload; JS glass pipeline samples directly from the output texture |
| `--use-port=webgpu` (Emscripten legacy flag) | Deprecated; the legacy bindings are unmaintained | `--use-port=emdawnwebgpu` in both compile and link flags (already correct in this project) |
| Third-party WebGPU wrapper libraries (wgpu.js, TypeGPU, babylon.js, three.js WebGPU backend) | Add indirection that complicates the emdawnwebgpu interop boundary; none are designed for this hybrid JS+WASM architecture | Raw WebGPU browser API with `@webgpu/types` |
| Separate `GPUDevice` per canvas or per component | JS and C++ must share the same device for zero-copy texture access; two devices cannot share textures | Single `GPUDevice` created in JS, passed to C++ via `importJsDevice` |
| Per-frame `createRenderPipeline()` | Synchronous pipeline compilation blocks the GPU; even in async form, recreation is expensive | Compile pipeline once at init with `createRenderPipelineAsync()`, cache the result |

---

## Stack Patterns by Scenario

**On canvas resize:**
- C++ `BackgroundEngine::resize()` destroys and recreates the offscreen texture
- The `GPUTexture` reference previously retrieved via `getJsObject(handle)` becomes invalid
- JS must re-call `getBackgroundTextureHandle()` → `getJsObject()` and recreate the glass bind groups
- Trigger: `ResizeObserver` on the canvas element (already wired in `GlassProvider`)

**On standalone mode (no external device):**
- v3.0 deprecates standalone mode — JS-creates-device is the only supported path
- If fallback is needed for existing users, C++ continues to work in its current self-init mode; the JS glass pipeline initializes after `module.getEngine()` returns non-null (existing poll loop in `GlassProvider`)

**On glass region count > 16:**
- `MAX_GLASS_REGIONS = 16` is a C++ constant in `background_engine.h`
- The JS uniform buffer at 16 × 256 = 4KB is within all WebGPU device limits
- Increasing the limit requires raising the constant and allocating a larger uniform buffer; no architectural change

**On device loss:**
- If the shared `GPUDevice` is lost, both C++ and JS become invalid
- Recovery: recreate the device in JS, call `module.initWithExternalDevice(newHandle)`, reinitialize JS glass pipelines and uniform buffers, re-upload wallpaper image
- The C++ engine must be destroyed and recreated (`module.destroyEngine()` then re-init)

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@webgpu/types@0.1.69` | TypeScript `^5.7.0` | Requires `"types": ["@webgpu/types"]` in `tsconfig.json`; already configured |
| `@webgpu/types@0.1.69` | Chrome 113+, Edge 113+, Safari 18+ (partial) | WebGPU shipped in Chrome 113 (May 2023); target Chrome for full feature set |
| emdawnwebgpu interop (`WebGPU.importJsDevice`, `WebGPU.getJsObject`) | Emscripten `>=4.0.10` | Project uses 4.0.16; interop API stable in this range |
| JS `GPUDevice` → C++ `WGPUDevice` handle | `--use-port=emdawnwebgpu` (NOT `--use-port=webgpu`) | Already correct in this project's CMakeLists.txt |
| Dynamic uniform offsets | `minUniformBufferOffsetAlignment = 256` (WebGPU spec default) | Safe to hard-code 256-byte stride; spec guarantees this as the default |
| `wgpu::TextureUsage::TextureBinding` on offscreen texture | C++ engine current implementation | Already set; no C++ change required for JS sampling |

---

## Sources

- [MDN: GPU.requestAdapter()](https://developer.mozilla.org/en-US/docs/Web/API/GPU/requestAdapter) — standard device creation API, HIGH confidence
- [MDN: GPUAdapter.requestDevice()](https://developer.mozilla.org/en-US/docs/Web/API/GPUAdapter/requestDevice) — adapter single-use constraint documented, HIGH confidence
- [MDN: GPUDevice.lost](https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/lost) — device loss handling pattern, HIGH confidence
- [MDN: GPUDevice.createRenderPipelineAsync()](https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/createRenderPipelineAsync) — async pipeline recommendation, HIGH confidence
- [Emscripten issue #13888: Mixed JS/WASM usage of WebGPU](https://github.com/emscripten-core/emscripten/issues/13888) — `importJsDevice`, `getJsObject`, object table (`JsValStore`) mechanism, MEDIUM confidence (issue thread, not official docs; matches what is in codebase)
- [Emdawnwebgpu README](https://dawn.googlesource.com/dawn/+/refs/heads/main/src/emdawnwebgpu/pkg/README.md) — `--use-port=emdawnwebgpu` vs deprecated `--use-port=webgpu`, HIGH confidence
- [WebGPU Bind Group Best Practices](https://toji.dev/webgpu-best-practices/bind-groups.html) — bind group immutability and recreation on resource change, MEDIUM confidence
- [WebGPU Fundamentals: Uniforms](https://webgpufundamentals.org/webgpu/lessons/webgpu-uniforms.html) — `minUniformBufferOffsetAlignment = 256`, HIGH confidence
- [MDN: GPURenderPassEncoder.setBindGroup()](https://developer.mozilla.org/en-US/docs/Web/API/GPURenderPassEncoder/setBindGroup) — dynamic offset constraint documentation, HIGH confidence
- Live codebase: `src/wasm/loader.ts`, `engine/src/main.cpp`, `engine/src/background_engine.h`, `engine/src/background_engine.cpp` — validated interop patterns and texture usage flags, HIGH confidence (primary source)

---

*Stack research for: JS/WebGPU glass rendering pipeline (v3.0 architecture)*
*Researched: 2026-03-24*

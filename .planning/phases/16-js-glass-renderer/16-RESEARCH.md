# Phase 16: JS Glass Renderer - Research

**Researched:** 2026-03-24
**Domain:** WebGPU JS render pipeline — WGSL glass shader in TypeScript, explicit bind group layouts, dynamic uniform buffer offsets, multi-region glass compositing
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GLASS-01 | WGSL glass shader ported verbatim from C++ glass.wgsl.h to JS-loaded module (no algorithmic changes) | Shader source fully analyzed; verbatim port strategy documented; UV conventions and DPR fields mapped |
| GLASS-02 | GPURenderPipeline created with explicit bind group layouts (not layout:'auto') for multi-region texture sharing | Confirmed required by WebGPU bind group best practices; exact layout structure prescribed |
| GLASS-03 | Per-region uniform buffers with 256-byte dynamic offset stride, written via device.queue.writeBuffer() | minUniformBufferOffsetAlignment=256 confirmed; full 28-field Float32Array layout documented at byte level |
| GLASS-04 | JS-owned canvas context configured with GPU.getPreferredCanvasFormat() | Existing GlassProvider already does this in the blit path; pattern is confirmed working |
| GLASS-05 | Bind groups invalidated and recreated when C++ recreates offscreen texture on resize | ResizeObserver hook in GlassProvider already calls engine.resize(); bind group rebuild strategy prescribed |
</phase_requirements>

---

## Summary

Phase 16 builds the `GlassRenderer` TypeScript class in isolation — it receives a `GPUDevice` and a `GPUTexture` (the C++ offscreen scene texture, or any synthetic texture for testing) and composites glass effects over it using a verbatim port of the existing `glass.wgsl.h` shader. This phase has no dependency on the live C++ engine: all testing uses a synthetic `device.createTexture()` filled with a solid color, matching the Phase 16 success criteria exactly.

The technical work is fully enumerated from the v3.0 architecture research (ARCHITECTURE.md, PITFALLS.md) and from direct inspection of `glass.wgsl.h` and `background_engine.h`. The shader is 205 lines and has one bind group (group 0: sampler + texture + uniform buffer) which the architecture requires splitting into two groups for the JS port (group 0: per-frame sampler + texture; group 1: per-region dynamic-offset uniform buffer). The `GlassUniforms` struct is 112 bytes, 28 float fields, with specific padding that must be reproduced exactly in a `Float32Array`.

The primary risk in this phase is the uniform buffer byte-offset mapping. A single off-by-4 error silently corrupts all shader parameters. The prevention strategy is to implement a `buildGlassUniformData()` helper with explicit indexed assignments matching the documented byte offsets, verified by a unit test before any visual work.

**Primary recommendation:** Port shader verbatim (strip C string wrapper, do not rewrite). Implement `buildGlassUniformData()` with explicit byte offsets and test it in isolation before attempting a visual render. Use `createRenderPipelineAsync()` — compile once at init, never recreate per frame or per resize.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| WebGPU browser API | Native (no npm) | Device, pipeline, buffers, textures, command encoding | Project already uses; typed via @webgpu/types |
| @webgpu/types | ^0.1.69 | TypeScript types for all WebGPU descriptors | Already installed; tsconfig.json already references |
| TypeScript | 5.7 | Type-safe uniform layout, renderer class | Already in use |
| Vite `?raw` import | 6.4.1 | Load glass.wgsl as a string with IDE syntax support | Already used for other assets |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| emdawnwebgpu interop (`WebGPU.getJsObject`) | Bundled with WASM | Retrieve GPUTexture from C++ handle | Only when connecting to live C++ engine (Phase 17). Phase 16 uses synthetic textures directly. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `?raw` Vite import for WGSL | TypeScript template literal in `.ts` file | Template literal has no IDE syntax support; `?raw` is strictly better for development |
| `createRenderPipelineAsync()` | `createRenderPipeline()` (sync) | Sync variant blocks the JS thread during shader compilation (~10–100ms); async is required for production |
| 256-byte dynamic offset stride | Separate GPUBuffer per region | Dynamic offset approach uses one buffer for all 16 regions (4KB total); simpler to manage, fewer bind groups |

**Installation:** No new packages required. All stack elements are already present.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── renderer/
│   ├── GlassRenderer.ts        # Core class: device, pipeline, uniform buffer, render()
│   ├── glass.wgsl              # Verbatim port of engine/src/shaders/glass.wgsl.h (strip C wrapper)
│   ├── GlassRegionState.ts     # TypeScript port of GlassUniforms + GlassRegion structs
│   └── morphLerp.ts            # TypeScript port of C++ lerpUniforms() exponential decay
```

### Pattern 1: Explicit Two-Group Bind Group Layout

**What:** The current C++ shader uses a single bind group (group 0) containing sampler, texture, and uniform buffer at bindings 0/1/2. The JS port must split this into two groups:
- Group 0 (per-frame): sampler (binding 0) + scene texture (binding 1) — set once per frame, shared across all regions
- Group 1 (per-region): uniform buffer with dynamic offset (binding 0) — set per draw call

**When to use:** Required whenever the same texture must be read in multiple draw calls within one render pass. `layout: 'auto'` prevents bind group sharing across pipeline instances.

**Example:**
```typescript
// Source: toji.dev/webgpu-best-practices/bind-groups.html
const perFrameLayout = device.createBindGroupLayout({
  entries: [
    { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
    { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
  ],
});
const perRegionLayout = device.createBindGroupLayout({
  entries: [
    {
      binding: 0,
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      buffer: { type: 'uniform', hasDynamicOffset: true, minBindingSize: 112 },
    },
  ],
});
const pipelineLayout = device.createPipelineLayout({
  bindGroupLayouts: [perFrameLayout, perRegionLayout],
});
```

**WGSL binding change required:** The C++ shader has `@group(0) @binding(0/1/2)` for all three resources. The JS port must change the uniform to `@group(1) @binding(0)` while sampler and texture remain at `@group(0) @binding(0/1)`.

### Pattern 2: 256-Byte Dynamic Offset Uniform Buffer

**What:** A single `GPUBuffer` of `(MAX_GLASS_REGIONS + 1) * 256` bytes holds all per-region uniforms. Region `i` starts at byte `i * 256`. Each draw call passes a dynamic offset to address the correct region's data. The first slot (offset 0) is reserved for the background blit pass (rect.z = 0 sentinel triggers blit mode in the shader).

**When to use:** Multi-region rendering where regions need different uniform values. `minUniformBufferOffsetAlignment = 256` (WebGPU spec). Since `GlassUniforms` is 112 bytes < 256, each region wastes 144 bytes of padding — this is acceptable (16 regions = 4KB total, well within any limit).

**Example:**
```typescript
// MAX_GLASS_REGIONS = 16; slot 0 = blit pass
const UNIFORM_STRIDE = 256; // minUniformBufferOffsetAlignment
const MAX_REGIONS = 16;
const uniformBuffer = device.createBuffer({
  size: (MAX_REGIONS + 1) * UNIFORM_STRIDE,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

// Per region draw:
const dynamicOffset = regionIndex * UNIFORM_STRIDE;
pass.setBindGroup(1, perRegionBindGroup, [dynamicOffset]);
pass.draw(3); // fullscreen triangle
```

### Pattern 3: GlassUniforms Float32Array Layout

**What:** A `buildGlassUniformData()` function constructs a 28-element `Float32Array` (112 bytes) matching the C++ `GlassUniforms` struct layout exactly. Fields use explicit index assignments, never positional fill.

**Complete field map (28 floats, 112 bytes):**

| Index | Byte Offset | Field | Type |
|-------|------------|-------|------|
| 0 | 0 | rect.x | f32 |
| 1 | 4 | rect.y | f32 |
| 2 | 8 | rect.w | f32 |
| 3 | 12 | rect.h | f32 |
| 4 | 16 | cornerRadius | f32 |
| 5 | 20 | blurIntensity | f32 |
| 6 | 24 | opacity | f32 |
| 7 | 28 | refractionStrength | f32 |
| 8 | 32 | tint.r | f32 |
| 9 | 36 | tint.g | f32 |
| 10 | 40 | tint.b | f32 |
| 11 | 44 | aberration | f32 |
| 12 | 48 | resolution.x | f32 |
| 13 | 52 | resolution.y | f32 |
| 14 | 56 | specularIntensity | f32 |
| 15 | 60 | rimIntensity | f32 |
| 16 | 64 | mode | f32 |
| 17 | 68 | _pad4 | f32 (zero) |
| 18 | 72 | _pad5 | f32 (zero) |
| 19 | 76 | _pad6 | f32 (zero) |
| 20 | 80 | contrast | f32 |
| 21 | 84 | saturation | f32 |
| 22 | 88 | fresnelIOR | f32 |
| 23 | 92 | fresnelExponent | f32 |
| 24 | 96 | envReflectionStrength | f32 |
| 25 | 100 | glareAngle | f32 |
| 26 | 104 | blurRadius | f32 |
| 27 | 108 | dpr | f32 |

**Source of truth for this layout:** `engine/src/shaders/glass.wgsl.h` (the WGSL struct definition is the authoritative layout). The struct is 112 bytes = 28 × 4 bytes.

**Size assertion:** `data.byteLength === 112` must be checked at runtime in development builds.

### Pattern 4: Pipeline Init with createRenderPipelineAsync

**What:** Compile the WGSL shader once at `GlassRenderer` construction time using `createRenderPipelineAsync()`. Cache the pipeline. Never recreate it on resize — resolution is a uniform, not a pipeline constant.

**Example:**
```typescript
// Source: MDN Web Docs — GPUDevice.createRenderPipelineAsync()
class GlassRenderer {
  private pipeline!: GPURenderPipeline;
  private uniformBuffer!: GPUBuffer;
  private sampler!: GPUSampler;
  private perFrameBindGroup: GPUBindGroup | null = null;
  private perRegionBindGroup: GPUBindGroup | null = null;

  async init(device: GPUDevice, canvasFormat: GPUTextureFormat): Promise<void> {
    const shaderModule = device.createShaderModule({ code: glassWgsl });
    this.pipeline = await device.createRenderPipelineAsync({
      layout: pipelineLayout,
      vertex: { module: shaderModule, entryPoint: 'vs_main' },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{
          format: canvasFormat,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-list' },
    });
  }
}
```

**Alpha blend:** The shader outputs `alpha = mask` for glass regions (SDF-derived mask), so the pipeline target needs alpha blending enabled. Background blit pass outputs `alpha = 1.0` (isBlit sentinel) — no blending needed there, but the same blend state works correctly since `1.0 * src + 0 * dst = src`.

### Pattern 5: setSceneTexture — Bind Group Rebuild on Texture Change

**What:** `GlassRenderer.setSceneTexture(texture: GPUTexture)` stores the texture reference and rebuilds the per-frame bind group (group 0). Called once at init and once after every `engine.resize()` in the ResizeObserver handler. The per-region bind group (group 1, which only references the uniform buffer) never needs rebuilding.

**Example:**
```typescript
setSceneTexture(texture: GPUTexture): void {
  this.sceneTexture = texture;
  this.perFrameBindGroup = this.device.createBindGroup({
    layout: this.perFrameLayout,
    entries: [
      { binding: 0, resource: this.sampler },
      { binding: 1, resource: texture.createView() },
    ],
  });
}
```

### Pattern 6: Render Loop — Single rAF, Background Blit + Per-Region Glass

**What:** `GlassRenderer.render(canvasContext)` encodes one render pass per frame. First draw: blit background using slot 0 (rect.z = 0 triggers blit sentinel in shader). Subsequent draws: one per active region with the region's dynamic offset.

**Example:**
```typescript
render(canvasContext: GPUCanvasContext, canvasW: number, canvasH: number): void {
  // Write blit uniforms to slot 0
  const blitData = new Float32Array(28); // all zeros → rect.z = 0 → isBlit = true
  blitData[12] = canvasW; blitData[13] = canvasH; // resolution
  device.queue.writeBuffer(uniformBuffer, 0, blitData);

  // Write per-region uniforms
  for (const [i, region] of activeRegions.entries()) {
    const data = buildGlassUniformData(region.current, canvasW, canvasH);
    device.queue.writeBuffer(uniformBuffer, (i + 1) * UNIFORM_STRIDE, data);
  }

  const surfaceTexture = canvasContext.getCurrentTexture();
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: surfaceTexture.createView(),
      loadOp: 'clear',
      storeOp: 'store',
      clearValue: { r: 0, g: 0, b: 0, a: 1 },
    }],
  });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, perFrameBindGroup);

  // Background blit
  pass.setBindGroup(1, perRegionBindGroup, [0]);
  pass.draw(3);

  // Glass regions
  for (let i = 0; i < activeRegions.length; i++) {
    pass.setBindGroup(1, perRegionBindGroup, [(i + 1) * UNIFORM_STRIDE]);
    pass.draw(3);
  }

  pass.end();
  device.queue.submit([encoder.finish()]);
}
```

### Pattern 7: Synthetic Texture for Isolated Testing

**What:** Phase 16 tests `GlassRenderer` without the C++ engine by creating a synthetic scene texture filled with a solid color. This exercises the full rendering path (pipeline, bind groups, uniforms, draw calls) in isolation.

**Example:**
```typescript
// Create 512x512 solid-color synthetic scene texture
const syntheticTexture = device.createTexture({
  size: [512, 512, 1],
  format: 'rgba8unorm',
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
});
// Fill with solid red (optional, to detect channel swap)
// ... writeTexture or render clear pass
renderer.setSceneTexture(syntheticTexture);
```

### Anti-Patterns to Avoid

- **Recreating the pipeline on resize:** Resolution is uniform data, not a pipeline constant. Pipeline creation is ~10–100ms. Only rebuild the per-frame bind group (texture view reference).
- **Using `layout: 'auto'`:** Prevents bind group sharing across draw calls with different dynamic offsets on the same frame. Must use explicit layouts.
- **Positional Float32Array fill (`data[i++] = ...`):** A single off-by-one shifts all subsequent fields. Always use explicit indexed assignments keyed to documented byte offsets.
- **Calling `getSceneTextureHandle()` every frame:** The handle is stable between resize events. Cache the `GPUTexture` reference in `GlassRenderer`. Only refresh on `setSceneTexture()` call.
- **Rewriting the WGSL shader:** The shader encodes calibrated visual behavior and UV conventions. Rewriting during a port phase risks both visual regression and breaking coordinate conventions.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WGSL shader for glass effects | Custom shader from scratch | Port `glass.wgsl.h` verbatim | Existing shader is calibrated against iOS reference; rewriting risks visual regression |
| Uniform buffer offset computation | Custom stride/alignment logic | Hardcode `UNIFORM_STRIDE = 256` from WebGPU spec `minUniformBufferOffsetAlignment` | Spec-guaranteed; project research confirmed 256 bytes |
| Gaussian blur in TypeScript | Custom blur pass | The WGSL shader's inline 9x9 Gaussian loop | Blur is in-shader; no separate pass needed |
| Alpha blending logic | Custom compositor | GPURenderPipeline blend state with `src-alpha / one-minus-src-alpha` | WebGPU handles it correctly with the mask alpha the shader outputs |

**Key insight:** Every algorithmic piece already exists in the C++ implementation. Phase 16 is a TypeScript transcription and WebGPU API wiring exercise, not a new algorithm design problem.

---

## Common Pitfalls

### Pitfall 1: Uniform Buffer Byte-Offset Error (C7)

**What goes wrong:** `Float32Array` positional fill without explicit byte tracking silently places the wrong float in the wrong shader slot. Because the shader reads raw bytes, the visual output is nonsensical with no error message.

**Why it happens:** WGSL `vec3f` fields are padded to 16 bytes (4 floats). `tint` is a `vec3f` at byte 32 — it occupies indices 8, 9, 10 with a padding float at index 11. Missing the padding float shifts `aberration` from index 11 to index 10, and everything after it shifts by one.

**How to avoid:** Implement `buildGlassUniformData()` with explicit assignments: `data[8] = tint.r; data[9] = tint.g; data[10] = tint.b; /* data[11] = 0 (padding) */; data[11] = aberration;` is WRONG — use the byte-offset table in this document. Write a test that fills known values and reads them back through a trivial storage buffer shader.

**Warning signs:** Glass renders but blur is 0 or infinity, tint color is wrong, rect is at 0,0.

### Pitfall 2: WGSL Bind Group Numbering Change

**What goes wrong:** The C++ shader has the uniform at `@group(0) @binding(2)`. The JS port splits into two groups — the uniform must move to `@group(1) @binding(0)`. If the WGSL is copied verbatim without updating the group numbers, the pipeline validation fails or the wrong data is bound.

**Why it happens:** Phase 16 requires explicit two-group layout for GLASS-02, but the source shader only has one group. The WGSL port is "verbatim" in terms of algorithm only — group assignments must be updated.

**How to avoid:** Change `@group(0) @binding(2) var<uniform> glass: GlassUniforms;` to `@group(1) @binding(0) var<uniform> glass: GlassUniforms;` in the ported shader. This is the only required change to the shader code.

### Pitfall 3: UV Convention Drift (C4)

**What goes wrong:** The vertex shader Y-flip (`1.0 - (position.y * 0.5 + 0.5)`), the SDF pixel-space computation, and the `glass.rect` UV convention are co-dependent. Changing any one without the others causes mirrored or displaced glass.

**Why it happens:** The fullscreen triangle in NDC space has Y increasing upward, but UV space has Y increasing downward (matching canvas/DOM coordinates). The Y-flip in the vertex shader reconciles these.

**How to avoid:** Copy the vertex shader verbatim. Document the convention: "UV (0,0) = top-left; vertex shader Y-flip is intentional; pixel space SDF uses canvas.width × canvas.height." Do not normalize the flip.

### Pitfall 4: DPR Uniform Omission (C6)

**What goes wrong:** The `dpr` field is at index 27 (byte offset 108) in the uniform struct. It was a late addition (repurposing `_pad7`) and easy to miss. Without it, `cornerRadius`, `blurRadius`, and rim/specular falloff compute incorrectly on Retina displays.

**Why it happens:** The field name suggests a scalar padding value. It must be populated with `window.devicePixelRatio` every frame (or at least every ResizeObserver callback).

**How to avoid:** The byte-offset table above lists `dpr` at index 27 explicitly. Populate it in `buildGlassUniformData()`. Pass DPR as a parameter to that function. Set `data[27] = dpr`.

### Pitfall 5: Canvas Context Format Mismatch for Alpha Blending (GLASS-04)

**What goes wrong:** The canvas context must be configured with `alphaMode: 'premultiplied'` or `'opaque'` depending on how the glass alpha is composed. Using `'opaque'` for the blit pass (background) and needing transparency for glass regions requires a specific configuration.

**Why it happens:** The temporary blit in Phase 15 uses `alphaMode: 'opaque'`. The glass renderer performs alpha blending within the render pass (not at the swap chain level), so `alphaMode: 'opaque'` is correct — glass alpha is composited via the pipeline blend state, not by the swap chain.

**How to avoid:** Configure context as `alphaMode: 'opaque'`. All alpha compositing happens inside the render pass via the pipeline blend state (src-alpha / one-minus-src-alpha). The swap chain receives the final pre-composited pixels.

### Pitfall 6: Texture Format — Scene Texture Must Be `rgba8unorm`

**What goes wrong:** C++ offscreen texture is `RGBA8Unorm` (confirmed in STATE.md: "Offscreen texture format must be explicit RGBA8Unorm, not BGRA"). Sampling a `bgra8unorm` texture from a shader expecting `rgba8unorm` produces R/B channel swap (cyan where red should be).

**Why it happens:** `GPU.getPreferredCanvasFormat()` returns `bgra8unorm` on macOS/Chrome. The distinction between canvas surface format and the C++ offscreen texture format is critical.

**How to avoid:** The synthetic test texture for Phase 16 must be created as `rgba8unorm` (matching what C++ produces). The canvas surface uses `getPreferredCanvasFormat()` (which may be `bgra8unorm`) — these two formats serve different purposes and must not be mixed up. The glass shader samples the scene texture (rgba8unorm), not the canvas surface.

### Pitfall 7: morphLerp Accumulation in rAF vs. Per-Property Setter

**What goes wrong:** Calling `setRegionBlurRadius()` directly writes to `current` state instead of `target` state, bypassing the lerp animation. The region snaps to the new value instead of transitioning.

**Why it happens:** The C++ implementation has separate `current` and `target` fields in `GlassRegion`. Setters update `target`; the render loop calls `lerpUniforms()` to move `current` toward `target`. The TypeScript port must preserve this two-field pattern.

**How to avoid:** `GlassRegionState` has `current: GlassUniforms` and `target: GlassUniforms`. All `setRegionXxx()` methods update `target` only. `GlassRenderer.render()` calls `morphLerp(region.current, region.target, dt)` for all active regions before writing to the uniform buffer.

---

## Code Examples

Verified patterns from the project's own codebase and official WebGPU sources:

### GlassUniforms TypeScript Interface

```typescript
// Mirrors GlassUniforms struct from engine/src/shaders/glass.wgsl.h
export interface GlassUniforms {
  rect: [number, number, number, number]; // x, y, w, h in normalized [0,1] UV
  cornerRadius: number;    // CSS pixels
  blurIntensity: number;   // 0.0–1.0
  opacity: number;         // tint mix 0.0–1.0
  refractionStrength: number;
  tint: [number, number, number]; // RGB
  aberration: number;
  specularIntensity: number;
  rimIntensity: number;
  mode: number;            // 0.0 = standard, 1.0 = prominent
  contrast: number;
  saturation: number;
  fresnelIOR: number;
  fresnelExponent: number;
  envReflectionStrength: number;
  glareAngle: number;
  blurRadius: number;      // CSS pixels (NOT multiplied by DPR here)
  // dpr passed separately — always window.devicePixelRatio
}

export function buildGlassUniformData(u: GlassUniforms, dpr: number): Float32Array {
  const data = new Float32Array(28); // 112 bytes
  data[0] = u.rect[0]; data[1] = u.rect[1];
  data[2] = u.rect[2]; data[3] = u.rect[3];
  data[4] = u.cornerRadius;
  data[5] = u.blurIntensity;
  data[6] = u.opacity;
  data[7] = u.refractionStrength;
  data[8] = u.tint[0]; data[9] = u.tint[1]; data[10] = u.tint[2];
  data[11] = u.aberration;
  // data[12], data[13] = resolution — set by caller (canvasW, canvasH)
  data[14] = u.specularIntensity;
  data[15] = u.rimIntensity;
  data[16] = u.mode;
  // data[17..19] = _pad4, _pad5, _pad6 = 0 (default Float32Array fill)
  data[20] = u.contrast;
  data[21] = u.saturation;
  data[22] = u.fresnelIOR;
  data[23] = u.fresnelExponent;
  data[24] = u.envReflectionStrength;
  data[25] = u.glareAngle;
  data[26] = u.blurRadius;
  data[27] = dpr;
  // resolution[12,13] filled by caller after returning
  return data;
}
```

### morphLerp TypeScript Port

```typescript
// Port of C++ lerpUniforms() — exponential decay toward target
export function morphLerp(
  current: GlassUniforms,
  target: GlassUniforms,
  dt: number,
  speed: number,   // morphSpeed from region state, e.g. 8.0
): void {
  const t = 1.0 - Math.exp(-speed * dt);
  const lerp = (a: number, b: number) => a + (b - a) * t;
  current.cornerRadius = lerp(current.cornerRadius, target.cornerRadius);
  current.blurIntensity = lerp(current.blurIntensity, target.blurIntensity);
  current.opacity = lerp(current.opacity, target.opacity);
  current.refractionStrength = lerp(current.refractionStrength, target.refractionStrength);
  current.tint[0] = lerp(current.tint[0], target.tint[0]);
  current.tint[1] = lerp(current.tint[1], target.tint[1]);
  current.tint[2] = lerp(current.tint[2], target.tint[2]);
  current.aberration = lerp(current.aberration, target.aberration);
  current.specularIntensity = lerp(current.specularIntensity, target.specularIntensity);
  current.rimIntensity = lerp(current.rimIntensity, target.rimIntensity);
  current.contrast = lerp(current.contrast, target.contrast);
  current.saturation = lerp(current.saturation, target.saturation);
  current.fresnelIOR = lerp(current.fresnelIOR, target.fresnelIOR);
  current.fresnelExponent = lerp(current.fresnelExponent, target.fresnelExponent);
  current.envReflectionStrength = lerp(current.envReflectionStrength, target.envReflectionStrength);
  current.glareAngle = lerp(current.glareAngle, target.glareAngle);
  current.blurRadius = lerp(current.blurRadius, target.blurRadius);
  // mode: no lerp — discrete value
  // rect: updated directly from DOM position, no lerp
}
```

### WGSL Group Assignment Change (Only Required WGSL Modification)

```wgsl
// Original (C++ glass.wgsl.h):
@group(0) @binding(0) var texSampler: sampler;
@group(0) @binding(1) var texBackground: texture_2d<f32>;
@group(0) @binding(2) var<uniform> glass: GlassUniforms;

// JS port (src/renderer/glass.wgsl):
@group(0) @binding(0) var texSampler: sampler;
@group(0) @binding(1) var texBackground: texture_2d<f32>;
@group(1) @binding(0) var<uniform> glass: GlassUniforms;  // ← group 1 for dynamic offset
```

### getSceneTextureHandle Pattern (from loader.ts — for reference)

```typescript
// Already implemented in src/wasm/loader.ts
export function getSceneTexture(module: EngineModule): GPUTexture | null {
  const handle = module.getSceneTextureHandle();
  if (!handle) return null;
  return module.WebGPU!.getJsObject(handle) as GPUTexture;
}
```

Phase 16 does not call this — it uses a synthetic texture. Phase 17 will wire `getSceneTexture()` into `GlassRenderer.setSceneTexture()`.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| C++ owns glass shader pipeline | JS owns glass shader pipeline | Phase 16 (this phase) | Glass becomes web-only concern; testable in isolation |
| Single bind group (auto layout) | Explicit two-group layout | Phase 16 | Enables per-region dynamic offsets + scene texture sharing |
| C++ manages GlassRegion / morph lerp | TypeScript GlassRegionState + morphLerp | Phase 16 | Eliminates WASM round-trip per region per frame |
| glass.wgsl.h as C++ string literal | glass.wgsl as Vite `?raw` import | Phase 16 | IDE syntax support; same bundle output |
| Temporary blit pipeline in GlassProvider | GlassRenderer composites background + glass | Phase 16 (then wired in Phase 17) | Single render pass; alpha blending enabled |

**Deprecated/outdated after Phase 16:**
- `BLIT_WGSL` and `createBlitResources` / `blitToCanvas` functions in `GlassProvider.tsx` — replaced by `GlassRenderer.render()` in Phase 17

---

## Open Questions

1. **Resolution field in blit pass uniforms**
   - What we know: The shader uses `glass.resolution` for pixel-space SDF. Blit pass (rect.z = 0) never reaches the SDF computation.
   - What's unclear: Whether `resolution` must be populated in the blit slot (slot 0) to avoid WebGPU validation errors on the buffer read, even though the blit code path never reads it.
   - Recommendation: Populate resolution in all slots for correctness. Zero is a valid float and causes no harm.

2. **GlassRegionState.mode field — lerp or snap?**
   - What we know: `mode` (0.0 = standard, 1.0 = prominent) is used as a discrete multiplier. In C++, it was not lerped.
   - What's unclear: Whether a lerped mode transition (standard → prominent) produces a useful intermediate visual state.
   - Recommendation: Match C++ behavior — snap `mode` directly without lerping. Update `current.mode = target.mode` outside the lerp loop.

3. **Per-frame bind group vs. per-draw bind group for the scene texture**
   - What we know: The scene texture changes only on resize. Per-frame bind group creation is wasted work when the texture is stable.
   - What's unclear: Whether a single stored `perFrameBindGroup` (rebuilt only in `setSceneTexture()`) is correct across multiple rAF frames.
   - Recommendation: Confirmed correct — store `perFrameBindGroup` as a class member, rebuild only in `setSceneTexture()`. WebGPU bind groups are immutable snapshots; the texture reference they hold stays valid until texture destruction.

---

## Validation Architecture

`nyquist_validation` is not explicitly set to false in `.planning/config.json`, so this section is included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (inferred — Vite project; no explicit test config found; Wave 0 must configure) |
| Config file | `vitest.config.ts` — does not exist yet (Wave 0 gap) |
| Quick run command | `npx vitest run src/renderer` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GLASS-01 | Shader source loads without parse errors; group/binding numbers correct | unit | `npx vitest run src/renderer/glass.test.ts` | Wave 0 |
| GLASS-02 | Pipeline creation succeeds with explicit bind group layouts | unit (WebGPU mock or headless) | `npx vitest run src/renderer/GlassRenderer.test.ts` | Wave 0 |
| GLASS-03 | `buildGlassUniformData()` produces correct bytes at all 28 offsets; stride = 256 | unit | `npx vitest run src/renderer/GlassRegionState.test.ts` | Wave 0 |
| GLASS-04 | Canvas context configured with `getPreferredCanvasFormat()` | manual / smoke | Visual inspection in browser | N/A |
| GLASS-05 | `setSceneTexture()` rebuilds perFrameBindGroup; stale texture not retained | unit | `npx vitest run src/renderer/GlassRenderer.test.ts` | Wave 0 |

**Note on WebGPU in test environment:** Vitest runs in Node.js; WebGPU is not available natively. Unit tests for `buildGlassUniformData()` and `morphLerp()` can run in Node without any GPU. Tests for `GlassRenderer` pipeline creation require either a WebGPU-capable browser test runner (Vitest browser mode with Chrome) or mocking the GPUDevice. The uniform layout test (GLASS-03) is the highest-value test and runs in pure Node.

### Sampling Rate

- **Per task commit:** `npx vitest run src/renderer` (uniform layout + morphLerp tests only — pure Node, fast)
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Uniform layout test green + visual smoke test (manual) before marking Phase 16 complete

### Wave 0 Gaps

- [ ] `src/renderer/GlassRegionState.test.ts` — covers GLASS-03 (uniform byte offsets for all 28 fields)
- [ ] `src/renderer/morphLerp.test.ts` — covers lerp convergence and dt=0 identity
- [ ] `vitest.config.ts` or `vitest` config in `vite.config.ts` — framework install
- [ ] Install: `npm install --save-dev vitest` (if not already present — check `package.json`)

---

## Sources

### Primary (HIGH confidence)

- `/Users/asekar/code/glass-react/engine/src/shaders/glass.wgsl.h` — authoritative shader source; all field offsets, UV conventions, DPR scaling, blit sentinel verified by direct inspection
- `/Users/asekar/code/glass-react/engine/src/background_engine.h` — confirms Phase 15 deleted all glass structs; `GlassUniforms` struct is now only in `glass.wgsl.h`
- `/Users/asekar/code/glass-react/src/wasm/loader.ts` — `getSceneTexture()` helper already implemented; `importJsDevice` pattern confirmed working
- `/Users/asekar/code/glass-react/src/components/GlassProvider.tsx` — Phase 15 blit pipeline demonstrates working `getPreferredCanvasFormat()`, canvas context configure, and `getJsObject()` texture bridge; confirms `alphaMode: 'opaque'` works
- `/Users/asekar/code/glass-react/src/context/GlassContext.ts` — `GlassRegionHandle` interface has 17 `updateXxx` methods corresponding to the 28 uniform fields (minus resolution/rect which are set from DOM position)
- `.planning/research/ARCHITECTURE.md` — component responsibilities, data flows, bind group cache strategy (HIGH confidence from project-level research)
- `.planning/research/PITFALLS.md` — C4 (UV drift), C6 (DPR), C7 (uniform offsets), C8 (frame ordering) — all directly applicable to Phase 16
- [WebGPU Bind Group Best Practices — toji.dev](https://toji.dev/webgpu-best-practices/bind-groups.html) — explicit layout requirement, hasDynamicOffset, group-by-update-frequency pattern

### Secondary (MEDIUM confidence)

- [WebGPU Uniforms — webgpufundamentals.org](https://webgpufundamentals.org/webgpu/lessons/webgpu-uniforms.html) — `minUniformBufferOffsetAlignment = 256`; Float32Array uniform population patterns
- [MDN: GPUDevice.createRenderPipelineAsync()](https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/createRenderPipelineAsync) — async pipeline compilation requirement
- [MDN: GPU.getPreferredCanvasFormat()](https://developer.mozilla.org/en-US/docs/Web/API/GPU/getPreferredCanvasFormat) — canvas format selection

### Tertiary (LOW confidence)

- None — all critical findings have primary or secondary backing.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — entire stack already in codebase; no new packages
- Architecture: HIGH — based on direct codebase analysis; bind group layout pattern verified against official source
- Uniform layout: HIGH — field-by-field verified against `glass.wgsl.h` WGSL struct definition
- Pitfalls: HIGH — C4/C6/C7/C8 verified against project history and live shader source

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (WebGPU API is stable; emdawnwebgpu interop pattern is established in codebase)

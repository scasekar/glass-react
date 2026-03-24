# Phase 9: Image Background Engine - Research

**Researched:** 2026-02-25
**Domain:** WebGPU texture loading, sRGB color pipeline, JS-WASM image interop, Vite asset bundling
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Nature photograph in macOS-style landscape aesthetic (sweeping scenery like Sequoia/Sonoma wallpapers)
- Resolution: 1920x1080, JPEG compressed to fit ~200KB budget
- Must be the exact same image used in the SwiftUI reference app (Phase 11) -- critical for apples-to-apples pixel comparison
- Bundled-only: no custom image URL support in this phase (backgroundSrc deferred)
- Instant swap between noise and image modes -- no crossfade or animation
- Glass effect state is preserved across mode switches (only the background changes)
- Image mode is the new default when library initializes
- Noise mode remains available via `backgroundMode="noise"` prop on GlassProvider
- Both modes always available as a straightforward toggle
- Optimize for 1:1 pixel-accurate comparison with iOS Simulator, not demo aesthetics
- Prefer native pixel rendering without resizing or cropping for comparison fidelity
- Demo polish is secondary to comparison accuracy

### Claude's Discretion
- Canvas/viewport sizing strategy for 1:1 pixel matching with iOS Simulator
- Resize behavior when browser window changes
- Image loading/error states (not discussed -- Claude handles fallback behavior)
- sRGB pipeline implementation details

### Deferred Ideas (OUT OF SCOPE)
- Custom image URLs via `backgroundSrc` prop -- future enhancement beyond Phase 9
- Multiple resolution variants for different device pixel ratios -- not needed for comparison workflow
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| IMG-01 | User can render a loaded image as the background texture through glass components | JS decode + WriteTexture upload to offscreen texture; image blit pipeline replaces noise pipeline in Pass 1 |
| IMG-02 | User can toggle between noise and image background modes via `backgroundMode` prop | C++ mode flag controls which Pass 1 pipeline runs; GlassProvider prop threads through to engine |
| IMG-03 | Library ships a bundled default wallpaper image (~200KB) as a Vite asset | Vite static asset import (`import wallpaperUrl from './assets/wallpaper.jpg'`); bundled into dist output |
| IMG-04 | Image textures use sRGB-correct pipeline (rgba8unorm-srgb format, linear shader math) | Separate sRGB texture for image data; shader math in linear space; surface output through existing pipeline |
</phase_requirements>

## Summary

Phase 9 adds image background rendering as an alternative to the existing procedural noise. The core challenge is a two-part problem: (1) loading a JPEG image from JavaScript into a WebGPU texture accessible from C++/WASM, and (2) ensuring the sRGB color pipeline is correct so that image colors pass through the glass shader without gamma distortion.

The existing architecture has a clean two-pass render: Pass 1 renders noise to an offscreen texture, Pass 2 samples that texture through the glass shader onto the surface. Image mode replaces Pass 1 -- instead of running the noise pipeline, the engine blits the image texture to the offscreen texture. The offscreen texture format, glass pipeline, and compositing remain unchanged.

The critical technical insight is that `copyExternalImageToTexture` (the standard JS WebGPU API for image upload) is **not callable from WASM/C++** because it requires JavaScript DOM objects. The established approach is: JavaScript decodes the image (via `fetch` + `createImageBitmap` + OffscreenCanvas to get RGBA pixel data), passes the raw pixels to C++ WASM memory, and the C++ engine uses `device.GetQueue().WriteTexture()` to upload them.

**Primary recommendation:** Decode images in JavaScript, pass raw RGBA pixel data to C++ via Emscripten heap, upload via `WriteTexture` to a dedicated `rgba8unorm-srgb` image texture, and blit to the offscreen texture with a simple fullscreen pass. The sRGB format provides automatic gamma-to-linear conversion when sampled, ensuring the glass shader operates in linear space.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Emscripten + emdawnwebgpu | Already in project | C++ WebGPU bindings for WASM | Already used; WriteTexture available from C++ side |
| Vite | 6.1+ (already in project) | Asset bundling, static image import | Built-in JPEG handling, hashes for cache busting |
| Browser ImageBitmap API | Web standard | Decode JPEG to pixel data | Hardware-accelerated decode, no external library |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| OffscreenCanvas | Web standard | Extract raw RGBA from ImageBitmap | Bridge between JS image decode and raw pixel buffer |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JS decode + WriteTexture | stb_image in C++ | Would require fetching binary in WASM, compiling stb_image, managing memory; JS decode is simpler and hardware-accelerated |
| OffscreenCanvas getImageData | copyExternalImageToTexture | Not callable from WASM; would require Emscripten JsValStore interop which is complex and fragile |
| Bundled JPEG | Fetch from CDN | External dependency; bundled asset guarantees availability and cache control |

**Installation:**
```bash
# No new dependencies needed -- all capabilities are already in the project
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── assets/
│   └── wallpaper.jpg              # Bundled default wallpaper (1920x1080, ~200KB)
├── components/
│   └── GlassProvider.tsx          # Modified: add backgroundMode prop, image loading
├── wasm/
│   └── loader.ts                  # Modified: add uploadImageTexture binding
engine/src/
├── background_engine.h            # Modified: image texture members, mode enum, uploadImageData()
├── background_engine.cpp          # Modified: image blit pipeline, mode switching
├── shaders/
│   ├── noise.wgsl.h               # Unchanged
│   ├── glass.wgsl.h               # Unchanged
│   └── image_blit.wgsl.h          # NEW: simple texture-to-texture blit shader
└── main.cpp                       # Modified: expose uploadImageData via embind
```

### Pattern 1: JS Image Decode + C++ WriteTexture Upload

**What:** JavaScript decodes JPEG to raw RGBA pixels, transfers to WASM heap, C++ uploads via WriteTexture.
**When to use:** Any time you need to load image data into a WebGPU texture from WASM.

**JavaScript side (in GlassProvider or loader):**
```typescript
async function decodeImageToRGBA(url: string): Promise<{ data: Uint8Array; width: number; height: number }> {
  const response = await fetch(url);
  const blob = await response.blob();
  // colorSpaceConversion: 'none' prevents browser from applying unwanted transforms
  const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none' });

  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  bitmap.close();

  return {
    data: new Uint8Array(imageData.data.buffer),
    width: bitmap.width,
    height: bitmap.height,
  };
}
```

**C++ side (new method on BackgroundEngine):**
```cpp
void BackgroundEngine::uploadImageData(const uint8_t* pixels, uint32_t imgWidth, uint32_t imgHeight) {
    // Create or recreate image texture at correct dimensions
    wgpu::TextureDescriptor texDesc{};
    texDesc.size = { imgWidth, imgHeight, 1 };
    texDesc.format = wgpu::TextureFormat::RGBA8UnormSrgb;  // sRGB decode on sample
    texDesc.usage = wgpu::TextureUsage::TextureBinding | wgpu::TextureUsage::CopyDst;
    imageTexture = device.CreateTexture(&texDesc);

    // Upload via WriteTexture
    wgpu::ImageCopyTexture dest{};
    dest.texture = imageTexture;
    dest.mipLevel = 0;
    dest.origin = { 0, 0, 0 };

    wgpu::TextureDataLayout layout{};
    layout.bytesPerRow = 4 * imgWidth;
    layout.rowsPerImage = imgHeight;

    wgpu::Extent3D size = { imgWidth, imgHeight, 1 };
    size_t dataSize = 4 * imgWidth * imgHeight;
    device.GetQueue().WriteTexture(&dest, pixels, dataSize, &layout, &size);

    imageTextureView = imageTexture.CreateView();
    hasImageTexture = true;
}
```

**Embind glue (main.cpp):**
```cpp
void uploadImageDataJS(uintptr_t pixelPtr, uint32_t width, uint32_t height) {
    if (!g_engine) return;
    g_engine->uploadImageData(reinterpret_cast<const uint8_t*>(pixelPtr), width, height);
}

EMSCRIPTEN_BINDINGS(background_engine) {
    // ... existing bindings ...
    emscripten::function("uploadImageData", &uploadImageDataJS);
}
```

**JS caller (passing data to WASM):**
```typescript
function uploadImage(module: EngineModule, rgba: Uint8Array, width: number, height: number) {
  const ptr = module._malloc(rgba.byteLength);
  module.HEAPU8.set(rgba, ptr);
  module.uploadImageData(ptr, width, height);
  module._free(ptr);
}
```

### Pattern 2: Background Mode Switching via Enum

**What:** C++ enum controls which pipeline runs in Pass 1; React prop maps to this enum.
**When to use:** Toggling between noise and image background modes.

**C++ side:**
```cpp
enum class BackgroundMode { Image = 0, Noise = 1 };

void BackgroundEngine::render() {
    // ... existing uniform buffer update ...

    // === PASS 1: Render background to offscreen texture ===
    if (backgroundMode == BackgroundMode::Image && hasImageTexture) {
        // Blit image texture to offscreen texture
        renderImageToOffscreen(encoder);
    } else {
        // Render noise to offscreen texture (existing code)
        renderNoiseToOffscreen(encoder);
    }

    // === PASS 2: Glass pass -- unchanged ===
    // ...
}
```

**React side (GlassProvider prop):**
```typescript
interface GlassProviderProps {
  backgroundMode?: 'image' | 'noise';  // default: 'image'
  children: React.ReactNode;
}
```

### Pattern 3: Image Blit Pipeline

**What:** A minimal render pipeline that samples the image texture and writes to the offscreen texture.
**When to use:** When image mode is active, replaces the noise render pass.

**WGSL shader (image_blit.wgsl.h):**
```wgsl
@group(0) @binding(0) var texSampler: sampler;
@group(0) @binding(1) var texImage: texture_2d<f32>;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    let pos = array<vec2f, 3>(
        vec2f(-1.0, -1.0),
        vec2f( 3.0, -1.0),
        vec2f(-1.0,  3.0),
    );
    var output: VertexOutput;
    output.position = vec4f(pos[vertexIndex], 0.0, 1.0);
    output.uv = output.position.xy * 0.5 + 0.5;
    return output;
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
    return textureSample(texImage, texSampler, uv);
}
```

**Key detail:** The image texture uses `rgba8unorm-srgb` format, so sampling it in the blit shader automatically converts sRGB-encoded pixel values to linear. The offscreen texture uses the surface format (typically `bgra8unorm`), which stores the linear values. When the glass shader in Pass 2 samples the offscreen texture, it operates on linear data. The surface output (also `bgra8unorm`) writes the final linear values, and the browser compositor interprets the canvas as sRGB -- applying the sRGB display curve.

### Anti-Patterns to Avoid

- **Manual pow(x, 2.2) gamma conversion in shaders:** The `rgba8unorm-srgb` texture format handles sRGB-to-linear conversion automatically on sample. Manual gamma functions are redundant, imprecise (sRGB is not exactly gamma 2.2), and error-prone.
- **Using copyExternalImageToTexture from WASM:** This JS-only API cannot be called from C++ compiled to WASM. The Emscripten JsValStore workaround is fragile. Use the JS decode + WriteTexture pattern instead.
- **Loading image synchronously in the render loop:** Image decode and texture upload should happen once during initialization, not per-frame. The uploaded texture persists.
- **Allocating new WASM heap memory per frame for image data:** Allocate once during upload, free after WriteTexture. The GPU texture holds the data; the CPU buffer is no longer needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JPEG decode in C++ | stb_image compiled to WASM | Browser `createImageBitmap` + OffscreenCanvas | Browser decode is hardware-accelerated, handles ICC profiles, zero added WASM size |
| sRGB gamma conversion | Manual `pow(color, 2.2)` in WGSL | `rgba8unorm-srgb` texture format | GPU hardware does the conversion automatically and precisely (sRGB is piecewise, not a simple power curve) |
| Image resize/scaling | Custom resize shader | CSS + browser ImageBitmap premultipliedAlpha/resizeWidth options | Browser image scaling is high-quality and handles subpixel correctly |
| Async image loading state machine | Custom promise chains | Standard fetch + createImageBitmap + async/await | Well-tested browser APIs with proper error handling |

**Key insight:** The browser already has a highly optimized image decode pipeline. Fighting it by trying to decode JPEG inside WASM adds code complexity, increases bundle size (stb_image is ~20KB compiled), and is slower than hardware-accelerated browser decode.

## Common Pitfalls

### Pitfall 1: sRGB Double-Correction

**What goes wrong:** Image colors appear washed out or overly dark because sRGB gamma is applied twice (once in texture decode, once manually in the shader).
**Why it happens:** Using `rgba8unorm-srgb` for the image texture but also having manual `pow(color, 2.2)` in the shader, or vice versa -- using `rgba8unorm` (no conversion) but expecting the shader to receive linear values.
**How to avoid:** Use `rgba8unorm-srgb` for the image texture (automatic sRGB-to-linear on sample) and `rgba8unorm` / `bgra8unorm` for the offscreen texture (no conversion). Never add manual gamma in shaders.
**Warning signs:** A 50% gray test image produces output significantly different from 50% gray. Colors look either too bright (under-corrected) or too dark (over-corrected).

### Pitfall 2: BGRA vs RGBA Byte Order Mismatch

**What goes wrong:** Image appears with red and blue channels swapped.
**Why it happens:** The surface preferred format is `bgra8unorm` on desktop but `rgba8unorm` on mobile. The image texture uses `rgba8unorm-srgb` (RGBA order). If the blit shader or format conversion is wrong, channels get swapped.
**How to avoid:** The image texture is always `rgba8unorm-srgb` (matches JavaScript ImageData output, which is RGBA). The offscreen texture matches the surface format. The blit shader simply samples and outputs `vec4f` -- the GPU handles the format conversion between the texture sample and the render target.
**Warning signs:** Blue skies appear orange, or red objects appear blue in the rendered output.

### Pitfall 3: OffscreenCanvas Color Space Interference

**What goes wrong:** Colors shift because OffscreenCanvas applies unwanted color space conversion during `getImageData`.
**Why it happens:** If `createImageBitmap` is called without `colorSpaceConversion: 'none'`, the browser may convert from the image's embedded ICC profile to the display color space, altering pixel values before they reach the shader.
**How to avoid:** Pass `{ colorSpaceConversion: 'none' }` to `createImageBitmap`. This ensures the raw sRGB values from the JPEG are preserved. The `rgba8unorm-srgb` texture format then correctly interprets them as sRGB-encoded data.
**Warning signs:** Subtle but noticeable color shifts compared to the same image displayed in an `<img>` element. Most visible in saturated reds and blues.

### Pitfall 4: WriteTexture bytesPerRow Alignment

**What goes wrong:** Image appears scrambled or has diagonal striping.
**Why it happens:** WebGPU requires `bytesPerRow` to be a multiple of 256 bytes. For a 1920-wide RGBA image, `bytesPerRow = 1920 * 4 = 7680`, which happens to be a multiple of 256. But other widths may not align.
**How to avoid:** Calculate `bytesPerRow = ceil(width * 4 / 256) * 256`. If padding is needed, pad each row of the pixel buffer before upload, or use a staging buffer with the correct stride.
**Warning signs:** Works at 1920 width but breaks at other widths. Image is correct at top but increasingly offset toward the bottom.

### Pitfall 5: Image Texture Lifetime During Mode Switch

**What goes wrong:** Crash or black screen when switching from noise to image mode.
**Why it happens:** Image texture was never created (image not loaded yet), or was destroyed during a resize, but the mode flag says "use image."
**How to avoid:** Always check `hasImageTexture` before entering the image blit path. Fall back to noise if the image hasn't loaded yet. The mode flag is separate from the texture availability flag.
**Warning signs:** Works when image loads before mode switch, crashes when toggling mode before image is ready.

### Pitfall 6: Offscreen Texture Format vs Image Texture Format

**What goes wrong:** Validation error or garbled output when blitting image to offscreen texture.
**Why it happens:** The image blit pipeline's color target format must match the offscreen texture format (which is the surface format, typically `bgra8unorm`), NOT the image texture format (`rgba8unorm-srgb`). If the pipeline is created with the wrong format, WebGPU validation fails.
**How to avoid:** The blit pipeline's color target format = `surfaceFormat` (same as offscreen texture). The image texture format is only used for the texture/sampler binding descriptor.
**Warning signs:** Validation error in browser console mentioning "incompatible formats" or "color target format mismatch."

## Code Examples

### Complete Image Upload Flow (JS Side)

```typescript
// Source: Project architecture pattern, verified against MDN copyExternalImageToTexture docs
// and WebGPU Fundamentals image loading tutorial

async function loadAndUploadWallpaper(module: EngineModule, imageUrl: string): Promise<void> {
  // 1. Fetch and decode
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to load wallpaper: ${response.status}`);
  const blob = await response.blob();

  // colorSpaceConversion: 'none' preserves raw sRGB values from JPEG
  const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none' });

  // 2. Extract raw RGBA pixels via OffscreenCanvas
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  bitmap.close();

  const rgba = new Uint8Array(imageData.data.buffer);

  // 3. Transfer to WASM heap and upload
  const ptr = module._malloc(rgba.byteLength);
  module.HEAPU8.set(rgba, ptr);
  module.uploadImageData(ptr, bitmap.width, bitmap.height);
  module._free(ptr);
}
```

### Vite Asset Import for Bundled Wallpaper

```typescript
// Source: Vite static asset handling documentation (https://vite.dev/guide/assets)

// In src/assets/, place wallpaper.jpg
// Vite will hash and bundle this automatically

import wallpaperUrl from '../assets/wallpaper.jpg';
// wallpaperUrl is a resolved URL string like "/assets/wallpaper-a1b2c3d4.jpg" in production
// or "/src/assets/wallpaper.jpg" in development

// Use in GlassProvider:
await loadAndUploadWallpaper(module, wallpaperUrl);
```

### TypeScript Declaration for Vite Asset Imports

```typescript
// In src/vite-env.d.ts (or similar)
/// <reference types="vite/client" />
// This enables TypeScript to recognize `import x from './foo.jpg'` as a string URL
```

### Embind Function for Pixel Data Upload

```cpp
// Source: Emscripten embind docs + LearnWebGPU texture loading pattern

// In main.cpp, add to EMSCRIPTEN_BINDINGS:
void uploadImageDataJS(uintptr_t pixelPtr, uint32_t width, uint32_t height) {
    if (!g_engine) return;
    g_engine->uploadImageData(
        reinterpret_cast<const uint8_t*>(pixelPtr), width, height
    );
}

void setBackgroundModeJS(int mode) {
    if (!g_engine) return;
    g_engine->setBackgroundMode(static_cast<BackgroundMode>(mode));
}

EMSCRIPTEN_BINDINGS(background_engine) {
    // ... existing bindings ...
    emscripten::function("uploadImageData", &uploadImageDataJS);
    emscripten::function("setBackgroundMode", &setBackgroundModeJS);
}
```

### TypeScript Module Interface Extension

```typescript
// Extended EngineModule interface in src/wasm/loader.ts
export interface EngineModule {
  getEngine(): { /* ... existing methods ... */ } | null;
  destroyEngine(): void;

  // New: image upload
  uploadImageData(pixelPtr: number, width: number, height: number): void;
  setBackgroundMode(mode: number): void;  // 0 = image, 1 = noise

  // Emscripten heap access for pixel data transfer
  _malloc(size: number): number;
  _free(ptr: number): void;
  HEAPU8: Uint8Array;
}
```

### 50% Gray Verification Test

```typescript
// Validates IMG-04 sRGB correctness
// A 50% gray pixel (sRGB value 128) should produce 50% gray output when all glass effects are zero

// 1. Create a 1x1 gray test image
const grayPixels = new Uint8Array([128, 128, 128, 255]);  // sRGB 50% gray

// 2. Upload via the same pipeline
const ptr = module._malloc(4);
module.HEAPU8.set(grayPixels, ptr);
module.uploadImageData(ptr, 1, 1);
module._free(ptr);

// 3. Render with zero glass effects, read back canvas pixels
// If sRGB pipeline is correct:
//   - rgba8unorm-srgb converts 128/255 (0.502 sRGB) to ~0.216 linear on sample
//   - Glass shader with zero effects passes through ~0.216 linear
//   - Surface output (bgra8unorm, interpreted as sRGB by compositor) converts ~0.216 linear back to ~128 sRGB
//   - Result: pixel reads back as approximately (128, 128, 128)
// If pipeline is WRONG (double gamma or no gamma):
//   - Double gamma: 128 → much darker (e.g., ~55)
//   - No gamma: 128 → unchanged but glass shader math is wrong in non-obvious ways
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| stb_image for JPEG decode in WASM | Browser createImageBitmap + OffscreenCanvas | 2023+ (as WebGPU matured) | Smaller WASM size, hardware-accelerated decode, better ICC profile handling |
| Manual sRGB pow(2.2) in shaders | rgba8unorm-srgb texture format | Standard since WebGPU spec | Precise piecewise sRGB curve, hardware-accelerated, fewer shader instructions |
| writeBuffer for texture upload | WriteTexture for direct upload | Standard since WebGPU spec | No intermediate staging buffer needed for simple uploads |
| Separate .wasm + .jpg files | Vite asset bundling with SINGLE_FILE | Project convention | Consistent asset pipeline, cache-busting via content hashing |

**Deprecated/outdated:**
- `ShaderModuleWGSLDescriptor` (old wgpu API): This project already uses the correct `ShaderSourceWGSL` pattern
- `texImage2D` (WebGL): Not applicable -- this is a WebGPU-only project

## Open Questions

1. **Offscreen texture format and sRGB blit correctness**
   - What we know: The offscreen texture uses `surfaceFormat` (typically `bgra8unorm`). The image texture uses `rgba8unorm-srgb`. When the blit shader samples the image texture, hardware converts sRGB to linear. The linear value is written to the offscreen texture (`bgra8unorm`, no reconversion). The glass shader then samples linear values and outputs to the surface, which the compositor displays as sRGB.
   - What's unclear: Whether the roundtrip through the offscreen texture introduces precision loss. For 8-bit textures, linear values near zero (shadows) have fewer representable levels than sRGB-encoded values. This may cause visible banding in dark areas.
   - Recommendation: Accept this for now. The noise background has the same limitation. If banding is visible, Phase 10+ can use `rgba16float` for the offscreen texture or add dithering. Document this as a known limitation.

2. **bytesPerRow alignment for non-1920 widths**
   - What we know: WebGPU requires `bytesPerRow >= 256` and to be a multiple of 256. For 1920x1080 RGBA, bytesPerRow = 7680, which is 30 * 256.
   - What's unclear: Whether Dawn/emdawnwebgpu enforces the 256-byte alignment strictly for `WriteTexture` (native WebGPU spec says `bytesPerRow` must be a multiple of 256 only for `copyBufferToTexture`, but `writeTexture` may be more lenient).
   - Recommendation: Always align to 256 bytes to be safe. For the locked 1920-width wallpaper, this is a non-issue (7680 is already aligned). Add alignment logic for future-proofing.

3. **_malloc/_free availability via embind**
   - What we know: Emscripten exports `_malloc` and `_free` when `EXPORTED_RUNTIME_METHODS` includes them or when `-sEXPORTED_FUNCTIONS=['_malloc','_free']` is set.
   - What's unclear: Whether the current CMakeLists.txt linker flags already export these. The `EXPORTED_RUNTIME_METHODS=['ccall']` flag is present but `_malloc`/`_free` are separate.
   - Recommendation: Add `-sEXPORTED_FUNCTIONS=['_malloc','_free']` to `target_link_options` in CMakeLists.txt. Verify they appear on the module object after build.

## Sources

### Primary (HIGH confidence)
- [MDN: GPUQueue.copyExternalImageToTexture()](https://developer.mozilla.org/en-US/docs/Web/API/GPUQueue/copyExternalImageToTexture) - API signature, supported source types, colorSpace parameter, sRGB default behavior
- [MDN: GPUCanvasContext.configure()](https://developer.mozilla.org/en-US/docs/Web/API/GPUCanvasContext/configure) - viewFormats, colorSpace options, format options for canvas context
- [MDN: GPU.getPreferredCanvasFormat()](https://developer.mozilla.org/en-US/docs/Web/API/GPU/getPreferredCanvasFormat) - returns rgba8unorm or bgra8unorm depending on platform
- [WebGPU Fundamentals: Loading Images into Textures](https://webgpufundamentals.org/webgpu/lessons/webgpu-importing-textures.html) - Complete workflow for image decode to texture upload
- [Vite: Static Asset Handling](https://vite.dev/guide/assets) - Import syntax, bundling behavior, TypeScript configuration
- [wgpu Wiki: Texture Color Formats and Srgb conversions](https://github.com/gfx-rs/wgpu/wiki/Texture-Color-Formats-and-Srgb-conversions) - Detailed sRGB EOTF/OETF automatic conversion behavior on sample/write
- [LearnWebGPU: A First Texture](https://eliemichel.github.io/LearnWebGPU/basic-3d-rendering/texturing/a-first-texture.html) - C++ WriteTexture pattern with bytesPerRow calculation

### Secondary (MEDIUM confidence)
- [gpuweb Discussion #2537: Canvas swap chain sRGB/linear](https://github.com/gpuweb/gpuweb/discussions/2537) - Canvas compositor treats all swap chains as sRGB, format only affects application-side view
- [Emscripten Issue #13888: Mixed JS/WASM WebGPU usage](https://github.com/emscripten-core/emscripten/issues/13888) - copyExternalImageToTexture not callable from WASM, JsValStore as workaround

### Tertiary (LOW confidence)
- [Emscripten Issue #10009: Pass image buffer to WASM](https://github.com/emscripten-core/emscripten/issues/10009) - Pattern for passing Uint8Array to WASM via _malloc/HEAPU8

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All components are already in the project or are standard Web APIs; no new dependencies
- Architecture: HIGH - Two-pass render is well-established in the project; image mode is a clean substitution for Pass 1
- Pitfalls: HIGH - sRGB color pipeline behavior is well-documented in WebGPU spec and wgpu wiki; WASM interop pattern is established
- JS-WASM data transfer: MEDIUM - _malloc/HEAPU8 pattern is well-known but needs CMakeLists.txt flag verification

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable domain, WebGPU spec is finalized)

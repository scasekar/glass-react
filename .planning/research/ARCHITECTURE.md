# Architecture Patterns: v2.0 Visual Parity

**Domain:** WebGPU glass effect component library -- image backgrounds, shader tuning, automated visual diffing
**Researched:** 2026-02-25
**Confidence:** HIGH (based on existing codebase analysis + verified WebGPU patterns)

## Existing Architecture (v1.0 Baseline)

Understanding the exact current architecture is critical because v2.0 modifies it in-place rather than replacing it.

```
┌─────────────────────────────────────────────────────────────┐
│  GlassProvider (React)                                       │
│  ├── owns <canvas id="gpu-canvas">                          │
│  ├── initEngine() → WASM module → polls getEngine()         │
│  ├── ResizeObserver → engine.resize()                        │
│  ├── rAF loop: getBoundingClientRect → setRegionRect()      │
│  └── registerRegion/unregisterRegion via GlassContext        │
│                                                              │
│  GlassPanel / GlassButton / GlassCard (React)               │
│  ├── useGlassRegion(ref, styleProps)                         │
│  │   ├── registerRegion(element) → handle with id           │
│  │   └── useEffect syncs props → handle.updateParams/Tint/…│
│  └── DOM div/button/article with transparent background      │
│                                                              │
│  BackgroundEngine (C++/WASM via Embind)                      │
│  ├── main.cpp: AllowSpontaneous device init → g_engine      │
│  ├── emscripten_set_main_loop(MainLoop) → update + render   │
│  ├── Pass 1: noise shader → offscreenTexture                │
│  ├── Pass 2: glass shader (background blit + N region draws)│
│  │   ├── Slot MAX_GLASS_REGIONS: passthrough blit           │
│  │   └── Slots 0..15: glass regions with dynamic offsets    │
│  └── GlassRegion[16]: current/target uniforms + morphing    │
└─────────────────────────────────────────────────────────────┘
```

### Current Render Pipeline (Per Frame)

```
MainLoop()
  ├── engine.update(dt)
  │   ├── currentTime += dt  (if not paused)
  │   └── for each active region: lerpUniforms(current, target, t)
  │
  └── engine.render()
      ├── WriteBuffer(uniformBuffer, Uniforms{time, resolution})
      │
      ├── PASS 1: noise → offscreenTexture
      │   ├── RenderTarget: offscreenTextureView
      │   ├── Pipeline: noisePipeline (simplex fBM)
      │   ├── BindGroup: uniformBuffer @binding(0)
      │   └── Draw(3)  (fullscreen triangle)
      │
      └── PASS 2: glass → surfaceTexture
          ├── RenderTarget: surface.GetCurrentTexture()
          ├── Pipeline: glassPipeline (SDF + refraction + blur)
          ├── Draw blit passthrough (slot 16, rectW=0 → outputs bg)
          └── for each active region i:
              ├── WriteBuffer(glassUniformBuffer, i*stride, current)
              ├── SetBindGroup(0, glassBindGroup, dynamicOffset=i*stride)
              └── Draw(3)  (fullscreen triangle, SDF-masked)
```

### Current Uniform Flow

```
React prop change
  → useGlassRegion useEffect fires
    → handle.updateParams(cr, blur, opacity, refraction)
      → engine.setRegionParams(id, cr, blur, opacity, refraction)
        → regions[id].target.{field} = value
          → update() lerps current toward target each frame
            → render() writes current to GPU uniform buffer
```

### Current GlassUniforms Layout (80 bytes, 5x vec4f)

| Offset | Field | Size | Notes |
|--------|-------|------|-------|
| 0-15 | rectX, rectY, rectW, rectH | vec4f | Normalized [0,1] UV coords |
| 16-19 | cornerRadius | f32 | Pixels |
| 20-23 | blurIntensity | f32 | 0-1 |
| 24-27 | opacity | f32 | 0-1 tint mix |
| 28-31 | refractionStrength | f32 | 0-0.3 |
| 32-43 | tintR, tintG, tintB | 3x f32 | RGB 0-1 |
| 44-47 | aberration | f32 | Pixels |
| 48-55 | resolutionX, resolutionY | 2x f32 | Canvas pixels |
| 56-59 | specularIntensity | f32 | 0-1 |
| 60-63 | rimIntensity | f32 | 0-1 |
| 64-67 | mode | f32 | 0.0=standard, 1.0=prominent |
| 68-79 | _pad4, _pad5, _pad6 | 3x f32 | Padding to 16-byte boundary |

---

## v2.0 Integration Architecture

### Overview: What Changes, What Stays

| Component | Change | Rationale |
|-----------|--------|-----------|
| Pass 1 (noise) | **Replace with image or keep noise** | Image mode renders static texture; noise mode unchanged |
| Pass 2 (glass) | **Add new uniforms** | Expose contrast, saturation, depth, frost as tunable params |
| GlassUniforms | **Extend struct** | New shader params need GPU-side storage |
| GlassStyleProps | **Extend interface** | New React props for all shader params |
| useGlassRegion | **Extend sync logic** | Push new props to engine |
| Embind | **Add image loading method** | New `loadBackgroundImage()` function |
| GlassProvider | **Add backgroundSrc prop** | Image URL or "noise" mode switch |
| Demo App | **Add controls panel** | dat.gui or custom sliders for real-time tuning |
| NEW: Xcode project | **Separate directory** | SwiftUI reference app for visual comparison |
| NEW: Diff pipeline | **Playwright + pixelmatch** | Automated screenshot comparison |

---

## Integration Point 1: Image Background in the Two-Pass Architecture

### The Problem

Pass 1 currently runs the noise shader every frame to produce animated simplex noise. Image mode needs to render a loaded photograph to the same offscreenTexture. The glass shader in Pass 2 does not care what produced the offscreen texture -- it just samples it.

### Recommended Architecture: Dual-Mode Pass 1

```
BackgroundEngine
  ├── backgroundMode: enum { Noise, Image }
  ├── imageTexture: wgpu::Texture  (loaded image, persistent)
  │
  └── render()
      ├── PASS 1 (conditional):
      │   ├── IF mode == Noise:
      │   │   └── Same as v1.0: noise pipeline → offscreenTexture
      │   ├── IF mode == Image:
      │   │   └── Blit imageTexture → offscreenTexture
      │   │       (new imageBlit pipeline: sample imageTexture, draw to offscreen)
      │   │       OR: CopyTextureToTexture if dimensions match
      │   └── OPTIMIZATION: Image mode only re-renders on resize/load
      │       (skip Pass 1 when imageTexture hasn't changed)
      │
      └── PASS 2: glass → surface (unchanged)
```

### Image Loading: JS-Side with EM_JS Bridge

**Why JS-side:** `copyExternalImageToTexture` is not exposed in emdawnwebgpu's C++ bindings (Emscripten issue #18190, closed as "not planned"). The standard workaround is to perform image decode in JavaScript and upload pixel data to the C++ texture via `queue.writeTexture()` from JS, or decode in JS and pass raw RGBA bytes to C++ via WASM heap.

**Recommended approach: Decode in JS, upload raw RGBA to C++ via WASM heap**

```
User provides image URL via GlassProvider backgroundSrc prop
  │
  ├── GlassProvider useEffect:
  │   ├── fetch(url) → blob → createImageBitmap(blob)
  │   ├── Draw ImageBitmap to OffscreenCanvas (to extract RGBA)
  │   ├── ctx.getImageData() → Uint8ClampedArray (RGBA pixels)
  │   └── engine.loadBackgroundImage(width, height, rgbaPtr, byteLength)
  │       (pass pointer into WASM heap memory)
  │
  └── C++ BackgroundEngine::loadBackgroundImage(w, h, data, len):
      ├── Create imageTexture (w x h, rgba8unorm, TEXTURE_BINDING | COPY_DST)
      ├── device.GetQueue().WriteBuffer() or WriteTexture():
      │   queue.WriteTexture(dest, data, len, dataLayout, size)
      ├── Set backgroundMode = Image
      └── Mark offscreen dirty (re-render Pass 1 on next frame)
```

**Alternative approach (higher performance, more complexity): EM_JS interop**

Use `EM_JS` to call `copyExternalImageToTexture` directly from the C++ side, accessing the JS device/texture through emdawnwebgpu's internal `WebGPU.mgrTexture.get()`. This avoids the RGBA copy through WASM heap but relies on unstable internal APIs. Not recommended for library code.

### New C++ Components for Image Mode

```cpp
// New members in BackgroundEngine:
enum class BackgroundMode { Noise, Image };
BackgroundMode backgroundMode = BackgroundMode::Noise;

wgpu::Texture imageTexture;        // Loaded image, persists between frames
wgpu::TextureView imageTextureView;
wgpu::RenderPipeline imageBlitPipeline;  // Samples imageTexture → offscreenTexture
wgpu::BindGroup imageBlitBindGroup;
bool imageDirty = false;           // Only re-render when needed

// New methods:
void loadBackgroundImage(uint32_t w, uint32_t h, const uint8_t* rgba, uint32_t byteLength);
void setBackgroundMode(int mode);  // 0=Noise, 1=Image
void createImageBlitPipeline();    // Reuses blit.wgsl.h shader
```

### Offscreen Texture Format Consideration

The current offscreenTexture uses `surfaceFormat` (typically `bgra8unorm`). Image upload via `writeTexture` with RGBA data may need format conversion. Two options:

1. **Match formats:** Create imageTexture as `rgba8unorm`, convert in the blit shader (swizzle channels). This is the cleanest approach.
2. **Canvas decode handles it:** Use `OffscreenCanvas` with willReadFrequently: draw ImageBitmap, read back as ImageData which is always RGBA. The blit shader does the RGBA-to-BGRA swizzle if needed.

**Recommendation:** Create imageTexture as `rgba8unorm` and use a blit shader that handles the channel order. The glass shader samples offscreenTexture (in surfaceFormat) regardless, so the blit normalizes formats.

### Pass 1 Optimization for Image Mode

When `backgroundMode == Image` and `!imageDirty`:
- Skip Pass 1 entirely -- the offscreenTexture already has the image from the last load/resize
- Only re-render Pass 1 when: image loaded, canvas resized, or mode switched

This saves significant GPU work since Pass 1's noise shader (6-octave fBM with 25-tap blur downstream) is the most expensive part of the pipeline.

---

## Integration Point 2: Shader Parameter Exposure

### New GlassUniforms Layout (Extended)

The current struct has 3 padding floats at the end (offsets 68-79). Use these for new parameters, and extend if needed.

```cpp
struct GlassUniforms {
    // Existing (offsets 0-67, unchanged)
    float rectX, rectY, rectW, rectH;       // 0-15
    float cornerRadius;                      // 16
    float blurIntensity;                     // 20
    float opacity;                           // 24
    float refractionStrength;                // 28
    float tintR, tintG, tintB;              // 32-43
    float aberration;                        // 44
    float resolutionX, resolutionY;          // 48-55
    float specularIntensity;                 // 56
    float rimIntensity;                      // 60
    float mode;                              // 64

    // NEW parameters (replacing padding at offsets 68-79):
    float contrast;                          // 68 — backdrop contrast (0.5-1.5, default 0.85)
    float saturation;                        // 72 — backdrop saturation (0.5-2.0, default 1.4)
    float blurRadius;                        // 76 — blur kernel radius in texels (0-60, default 30)
    // Total: 80 bytes — NO SIZE CHANGE, uses existing padding slots
};
```

**Why these three:** The glass shader currently hardcodes `contrast(0.85)` and `saturate(1.4)` and `blurRadius = blurIntensity * 30.0`. Making these tunable is the highest-impact change for visual parity matching because Apple's Liquid Glass has specific contrast/saturation/blur characteristics that differ from our current hardcoded values.

### Extended GlassStyleProps (React)

```typescript
export interface GlassStyleProps {
    // Existing props (unchanged)
    blur?: number;
    opacity?: number;
    cornerRadius?: number;
    tint?: GlassColor;
    refraction?: number;
    aberration?: number;
    specular?: number;
    rim?: number;
    refractionMode?: 'standard' | 'prominent';
    morphSpeed?: number;

    // NEW props
    contrast?: number;      // Backdrop contrast multiplier (default: 0.85)
    saturation?: number;    // Backdrop saturation multiplier (default: 1.4)
    blurRadius?: number;    // Blur kernel radius in texels (default: 30)
}
```

### Data Flow for New Parameters

```
<GlassPanel contrast={0.9} saturation={1.2} blurRadius={20} />
  │
  ├── useGlassRegion useEffect:
  │   ├── handle.updateContrast(0.9)
  │   ├── handle.updateSaturation(1.2)
  │   └── handle.updateBlurRadius(20)
  │
  ├── GlassRegionHandle (new methods):
  │   ├── updateContrast: (v) => engine.setRegionContrast(id, v)
  │   ├── updateSaturation: (v) => engine.setRegionSaturation(id, v)
  │   └── updateBlurRadius: (v) => engine.setRegionBlurRadius(id, v)
  │
  ├── Embind (new methods on BackgroundEngine):
  │   ├── setRegionContrast(id, value)
  │   ├── setRegionSaturation(id, value)
  │   └── setRegionBlurRadius(id, value)
  │
  ├── BackgroundEngine C++:
  │   └── regions[id].target.contrast = value
  │       (morphed via lerpUniforms like all other params)
  │
  └── Glass WGSL shader:
      ├── let saturated = mix(vec3f(luminance), aberratedColor, glass.saturation);
      ├── let contrasted = mix(vec3f(0.5), saturated, glass.contrast);
      └── let blurRadius = glass.blurRadius * glass.blurIntensity;
```

### WGSL Shader Modifications

The glass shader changes are minimal -- replace hardcoded constants with uniform reads:

```wgsl
// BEFORE (v1.0):
let saturated = mix(vec3f(luminance), aberratedColor, 1.4);
let contrasted = mix(vec3f(0.5), saturated, 0.85);
let blurRadius = glass.blurIntensity * 30.0;

// AFTER (v2.0):
let saturated = mix(vec3f(luminance), aberratedColor, glass.saturation);
let contrasted = mix(vec3f(0.5), saturated, glass.contrast);
let blurRadius = glass.blurRadius * glass.blurIntensity;
```

---

## Integration Point 3: Live Tuning UI

### Architecture: Standalone Controls Component

The tuning UI lives in the demo app only, not in the library. It reads/writes GlassStyleProps.

```
┌─────────────────────────────────────────────┐
│  Demo App                                    │
│  ├── GlassProvider                          │
│  │   ├── GlassPanel (tunable)              │
│  │   └── <canvas> (background)             │
│  └── TuningPanel (floating UI)             │
│      ├── useState for all shader params    │
│      ├── Sliders: blur, opacity, contrast… │
│      ├── Color picker: tint               │
│      ├── Mode toggle: standard/prominent   │
│      ├── Background toggle: noise/image    │
│      ├── Export button → JSON params       │
│      └── Import button → load JSON params  │
└─────────────────────────────────────────────┘
```

**Why not a library component:** The tuning panel is a developer tool, not end-user UI. It imports from the library like any consumer app. This validates the API surface -- if tuning is awkward, the API needs work.

### Parameter Export Format

```json
{
  "version": 1,
  "params": {
    "blur": 0.6,
    "opacity": 0.08,
    "cornerRadius": 28,
    "tint": [0.7, 0.75, 0.85],
    "refraction": 0.15,
    "aberration": 3.0,
    "specular": 0.2,
    "rim": 0.15,
    "contrast": 0.85,
    "saturation": 1.4,
    "blurRadius": 30,
    "refractionMode": "standard"
  }
}
```

This format enables the auto-tuning loop: adjust params, export JSON, capture screenshot, diff.

---

## Integration Point 4: SwiftUI Reference App

### Xcode Project Structure

The reference app lives in a separate directory (per project constraints), not inside glass-react.

```
~/code/liquid-glass-reference/
├── LiquidGlassReference.xcodeproj
├── LiquidGlassReference/
│   ├── LiquidGlassReferenceApp.swift
│   ├── ContentView.swift          // Main view with glass over wallpaper
│   ├── Assets.xcassets/
│   │   └── wallpaper.imageset/    // Same wallpaper used in web app
│   └── Info.plist
└── README.md
```

### Minimal SwiftUI Implementation

```swift
import SwiftUI

struct ContentView: View {
    var body: some View {
        ZStack {
            // Same wallpaper image as web app
            Image("wallpaper")
                .resizable()
                .aspectRatio(contentMode: .fill)
                .ignoresSafeArea()

            VStack(spacing: 24) {
                // Glass panel matching web app's GlassPanel dimensions
                Text("Glass Panel")
                    .font(.title2.weight(.semibold))
                    .padding(.horizontal, 32)
                    .padding(.vertical, 24)
                    .frame(width: 340)
                    .glassEffect(.regular, in: RoundedRectangle(cornerRadius: 28))

                // Glass button matching web app's GlassButton
                Button("Standard Glass") { }
                    .padding(.horizontal, 36)
                    .padding(.vertical, 14)
                    .glassEffect(.regular, in: RoundedRectangle(cornerRadius: 16))
            }
        }
    }
}
```

### Key Constraint

Apple's `.glassEffect()` modifier does NOT expose individual shader parameters (blur, refraction, aberration, etc.). It provides preset styles (`.regular`, `.clear`) with optional tinting. This means:

- The reference app captures Apple's "correct" output at the system level
- The web app must tune its exposed parameters to visually match that output
- Visual diffing compares the holistic result, not parameter-by-parameter

### Simulator Target

iPhone 16 Pro Simulator (as specified in PROJECT.md). The simulator must run iOS 26+ (which introduced `.glassEffect`). Screenshot resolution: 1179x2556 (iPhone 16 Pro logical resolution at 3x).

---

## Integration Point 5: Screenshot Capture Pipeline

### Architecture

```
┌──────────────────┐    ┌──────────────────┐
│  iOS Simulator    │    │  Chrome/Playwright│
│  Reference App    │    │  Demo App         │
│                  │    │                  │
│  xcrun simctl    │    │  page.screenshot()│
│  io booted       │    │                  │
│  screenshot      │    │                  │
│  ref.png         │    │  web.png          │
└────────┬─────────┘    └────────┬─────────┘
         │                       │
         ▼                       ▼
    ┌────────────────────────────────┐
    │     pixelmatch / Playwright     │
    │     Visual Comparison           │
    │                                │
    │  diff = pixelmatch(ref, web,   │
    │           output, w, h,        │
    │           {threshold: 0.1})    │
    │                                │
    │  → diff.png (highlighted)      │
    │  → mismatch count / percentage │
    └────────────────────────────────┘
```

### iOS Simulator Capture

```bash
# Boot iPhone 16 Pro simulator
xcrun simctl boot "iPhone 16 Pro"

# Launch reference app
xcrun simctl launch booted com.example.LiquidGlassReference

# Wait for app to render (glass effect needs a frame)
sleep 2

# Capture screenshot
xcrun simctl io booted screenshot --type=png reference.png
```

### Web App Capture (Playwright)

```typescript
import { test } from '@playwright/test';

test('capture glass screenshot', async ({ page }) => {
    // WebGPU requires non-headless or --use-angle=gl
    await page.goto('http://localhost:5173');
    await page.waitForSelector('#gpu-canvas');

    // Wait for engine init + first render
    await page.waitForTimeout(2000);

    // Capture at matching viewport
    await page.setViewportSize({ width: 393, height: 852 });
    await page.screenshot({
        path: 'web-capture.png',
        fullPage: false,
    });
});
```

### Playwright Configuration for WebGPU

WebGPU canvas rendering requires GPU access. Headless Chrome with `--use-angle=gl` flag enables this:

```typescript
// playwright.config.ts
export default defineConfig({
    use: {
        channel: 'chromium',
        launchOptions: {
            args: [
                '--use-angle=gl',
                '--enable-features=Vulkan',
                '--enable-unsafe-webgpu',
            ],
        },
    },
});
```

**Confidence: MEDIUM** -- WebGPU in headless Playwright is documented but can be flaky across platforms. May need headed mode as fallback.

### Image Normalization Before Diff

The iOS screenshot (1179x2556) and web screenshot (393x852 at 1x or 1179x2556 at 3x) must be normalized:

1. Crop both to the glass region only (not full screen)
2. Resize to matching dimensions
3. Run pixelmatch on the cropped regions

Use `sharp` (Node.js image processing) for crop/resize before pixelmatch.

---

## Integration Point 6: Auto-Tuning Loop

### Architecture

```
┌─────────────────────────────────────────────┐
│  tune.ts (Node.js script)                    │
│                                              │
│  1. Load current params from params.json    │
│  2. Start Vite dev server (if not running)  │
│  3. Capture iOS reference (once, cached)    │
│  4. Loop:                                   │
│  │  a. Write params.json                    │
│  │  b. Playwright navigates to demo app     │
│  │     (demo app reads params from URL or   │
│  │      query string ?params=base64json)    │
│  │  c. Capture web screenshot               │
│  │  d. Crop both to glass region            │
│  │  e. pixelmatch → mismatch percentage     │
│  │  f. IF mismatch < threshold: DONE        │
│  │  g. ELSE: adjust params heuristically    │
│  │     (gradient descent on mismatch score) │
│  │  h. Log iteration + mismatch %           │
│  └─────────────────────────────────────────│
│  5. Output final params.json                │
└─────────────────────────────────────────────┘
```

### Parameter Adjustment Strategy

**Do NOT use ML/neural approaches.** The parameter space is small (12 floats) and the cost per evaluation is high (screenshot capture + diff). Use:

1. **Manual baseline:** Human sets approximate params by visual inspection using tuning UI
2. **Grid search refinement:** For each parameter, sweep 5-10 values around the baseline while holding others constant
3. **Coordinate descent:** Optimize one parameter at a time, cycling through all parameters until convergence

### Demo App Parameter Injection

The demo app needs to accept shader parameters from an external source for automated tuning:

```typescript
// In demo app:
const urlParams = new URLSearchParams(window.location.search);
const paramsJson = urlParams.get('params');
const params = paramsJson ? JSON.parse(atob(paramsJson)) : defaultParams;
```

This avoids modifying source code per iteration -- just change the URL.

---

## Component Boundaries (v2.0 Complete)

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **BackgroundEngine** (C++) | Noise OR image → offscreenTexture; glass compositing | WASM loader via Embind |
| **imageTexture** (C++ member) | Holds decoded image data on GPU | BackgroundEngine render() |
| **GlassUniforms** (C++ struct) | All shader parameters including new contrast/saturation/blurRadius | GPU uniform buffer |
| **glass.wgsl** (WGSL shader) | SDF masking, refraction, blur, tint, specular, rim | Reads offscreenTexture + GlassUniforms |
| **GlassProvider** (React) | Engine lifecycle, canvas, region management, **image loading** | useGlassRegion, WASM module |
| **GlassStyleProps** (TypeScript) | Type contract for all shader params | GlassPanel/Button/Card, useGlassRegion |
| **useGlassRegion** (React hook) | Syncs React props → engine via handle methods | GlassProvider context, Embind methods |
| **TuningPanel** (demo only) | Sliders/controls for real-time shader adjustment | useState driving GlassStyleProps |
| **Reference App** (SwiftUI) | Native Liquid Glass ground truth | Xcode Simulator only |
| **Diff Pipeline** (Playwright+pixelmatch) | Automated visual comparison | Captures both apps, outputs diff |
| **Tuning Script** (Node.js) | Automated parameter convergence | Drives Playwright, reads pixelmatch |

---

## Patterns to Follow

### Pattern 1: Uniform Extension via Padding Slots

**What:** Use the 3 existing padding floats in GlassUniforms to add new parameters without changing struct size.
**When:** Adding fewer than 4 new shader parameters.
**Why:** Avoids breaking the uniform buffer stride calculation, bind group layout, and dynamic offset alignment. No pipeline recreation needed.

```cpp
// BEFORE: float _pad4, _pad5, _pad6;
// AFTER:  float contrast, saturation, blurRadius;
// Same 80 bytes, same alignment, zero impact on existing code
```

### Pattern 2: JS-Side Image Decode, C++ Upload

**What:** Decode images in JavaScript (ImageBitmap/Canvas API), pass raw RGBA bytes to C++ via WASM heap, then `queue.WriteTexture()` in C++.
**When:** Loading external images into WebGPU textures from WASM.
**Why:** `copyExternalImageToTexture` is not available in emdawnwebgpu C++ bindings. Decoding in JS uses browser-optimized codecs. Upload via WriteTexture is fully supported.

### Pattern 3: Conditional Pass Skipping

**What:** Skip Pass 1 (background rendering) when the offscreen texture hasn't changed.
**When:** Image mode between loads/resizes.
**Why:** The noise shader is the most GPU-expensive part (6-octave simplex fBM). Skipping it when displaying a static image saves significant GPU budget.

### Pattern 4: URL-Driven Parameter Injection

**What:** Accept shader parameters via URL query string (base64-encoded JSON) for automated testing.
**When:** Auto-tuning loop needs to drive the demo app without code changes.
**Why:** Enables headless parameter sweeps via Playwright without rebuild/HMR cycles.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Passing JS ImageBitmap Directly to C++

**What:** Trying to pass an ImageBitmap or HTMLImageElement handle to C++ code for `copyExternalImageToTexture`.
**Why bad:** emdawnwebgpu does not expose `copyExternalImageToTexture` in C++ (Emscripten issue #18190). Attempting to use internal `WebGPU.mgrTexture.get()` relies on unstable APIs that will break when emdawnwebgpu updates.
**Instead:** Decode in JS, extract raw RGBA pixels, pass byte array to C++, use `queue.WriteTexture()`.

### Anti-Pattern 2: Extending GlassUniforms Beyond 256 Bytes Without Checking Limits

**What:** Adding many new fields to GlassUniforms without verifying `minUniformBufferOffsetAlignment`.
**Why bad:** The dynamic uniform buffer offset must be a multiple of `minUniformBufferOffsetAlignment` (typically 256 bytes). The current 80-byte struct gets padded to 256 by `ceilToNextMultiple`. Exceeding 256 bytes would double the stride for all 16+1 regions.
**Instead:** Keep GlassUniforms at or under 256 bytes. Current 80 bytes leaves 176 bytes of headroom (44 more floats).

### Anti-Pattern 3: Running Automated Diff on Full-Screen Screenshots

**What:** Comparing entire screenshots including UI chrome, status bars, etc.
**Why bad:** Platform differences (browser chrome vs iOS status bar), font rendering, sub-pixel antialiasing all produce false-positive diffs.
**Instead:** Crop to the glass region only before diffing. Use consistent wallpaper, matching dimensions, no surrounding UI.

### Anti-Pattern 4: Hot-Reloading C++ Changes in Tuning Loop

**What:** Modifying WGSL shaders or C++ code during automated tuning iterations.
**Why bad:** Vite HMR does not rebuild WASM. Each shader change requires `emcmake cmake --build`. This takes 5-10 seconds and breaks the fast iteration cycle.
**Instead:** The tuning loop should ONLY adjust uniform values (via URL params), not shader code. Shader changes are manual development steps between tuning runs.

---

## Build Order (v2.0 Features)

Dependencies flow top-to-bottom; each step requires the ones above it.

```
1. Image background mode (C++ engine)
   ├── Extend BackgroundEngine with image loading + blit pipeline
   ├── Add Embind methods: loadBackgroundImage(), setBackgroundMode()
   └── Verify: noise mode still works, image mode renders correctly
       Dependencies: none (pure C++ engine change)

2. Shader parameter exposure (C++ + WGSL + React)
   ├── Replace padding with contrast/saturation/blurRadius in GlassUniforms
   ├── Update glass.wgsl to read new uniforms
   ├── Add Embind methods: setRegionContrast/Saturation/BlurRadius
   ├── Extend GlassStyleProps, GlassRegionHandle, useGlassRegion
   └── Verify: new params affect rendering, defaults match v1.0 behavior
       Dependencies: none (orthogonal to image mode)

3. GlassProvider image integration (React)
   ├── Add backgroundSrc prop to GlassProvider
   ├── Implement JS-side image decode → WASM upload flow
   ├── Bundle default wallpaper as importable asset
   └── Verify: <GlassProvider backgroundSrc="/wallpaper.jpg">
       Dependencies: step 1 (engine image loading)

4. Live tuning UI (demo app)
   ├── Build TuningPanel with sliders for all exposed params
   ├── Add image/noise toggle
   ├── Add JSON export/import
   └── Verify: real-time parameter adjustment works
       Dependencies: steps 2+3 (all params exposed, image mode available)

5. SwiftUI reference app (separate Xcode project)
   ├── Create minimal project with wallpaper + glass panel
   ├── Build for iPhone 16 Pro Simulator
   ├── Verify: .glassEffect renders on simulator
   └── Capture reference screenshot
       Dependencies: none (parallel with steps 1-4)

6. Screenshot diff pipeline (Playwright + pixelmatch)
   ├── Set up Playwright with WebGPU-capable Chrome
   ├── Script iOS Simulator capture
   ├── Build crop + normalize + diff pipeline
   └── Verify: diff output highlights real differences
       Dependencies: steps 3+5 (both apps rendering same wallpaper)

7. Auto-tuning script (Node.js)
   ├── Build coordinate descent optimizer
   ├── Wire up: params → URL → Playwright → capture → diff → adjust
   └── Verify: mismatch percentage decreases over iterations
       Dependencies: steps 4+6 (tuning UI for manual baseline, diff pipeline for scoring)
```

**Steps 1 and 2 can run in parallel.** Step 5 can run in parallel with steps 1-4. Steps 3-4 are sequential after 1-2. Steps 6-7 are sequential after 3+5.

---

## Sources

- Existing codebase analysis: `engine/src/background_engine.cpp`, `engine/src/shaders/glass.wgsl.h`, `src/components/GlassProvider.tsx`, `src/hooks/useGlassRegion.ts` (HIGH confidence -- primary source)
- [WebGPU copyExternalImageToTexture best practices](https://toji.dev/webgpu-best-practices/img-textures.html) (HIGH confidence -- authoritative WebGPU reference)
- [Emscripten issue #18190: copyExternalImageToTexture not in C++ bindings](https://github.com/emscripten-core/emscripten/issues/18190) (HIGH confidence -- official issue tracker, closed as "not planned")
- [Emscripten issue #13888: Mixed JS/WASM WebGPU usage](https://github.com/emscripten-core/emscripten/issues/13888) (HIGH confidence -- closed as completed, JsValStore implemented)
- [Apple SwiftUI glassEffect documentation](https://developer.apple.com/documentation/swiftui/view/glasseffect(_:in:)) (HIGH confidence -- official Apple docs)
- [LiquidGlassReference SwiftUI examples](https://github.com/conorluddy/LiquidGlassReference) (MEDIUM confidence -- community reference)
- [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots) (HIGH confidence -- official docs)
- [xcrun simctl screenshot](https://nshipster.com/simctl/) (HIGH confidence -- well-known reference)
- [Playwright WebGPU/WebGL headless testing](https://blog.promaton.com/testing-3d-applications-with-playwright-on-gpu-1e9cfc8b54a9) (MEDIUM confidence -- practitioner blog)
- [GPUQueue writeTexture MDN](https://developer.mozilla.org/en-US/docs/Web/API/GPUQueue/writeTexture) (HIGH confidence -- MDN documentation)

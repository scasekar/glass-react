# Phase 4: Glass Shader Core - Research

**Researched:** 2026-02-10
**Domain:** WGSL shaders, real-time glass refraction, SDF rounded rectangles, GPU blur techniques
**Confidence:** HIGH

## Summary

Phase 4 transforms the current two-pass render architecture (noise -> offscreen texture -> blit -> surface) into a three-pass architecture by inserting a glass shader pass between the noise texture and the final surface output. The glass shader will sample the background texture at distorted UVs to create refraction, apply a blur kernel for frosted glass appearance, composite with configurable opacity and tint, and mask with an SDF rounded rectangle for smooth anti-aliased edges.

The core technical challenge is implementing convincing glass refraction within a single-texture, fullscreen-triangle architecture without a 3D scene graph. Since we are doing 2D screen-space effects (not 3D mesh refraction), the approach is fundamentally simpler: UV distortion based on a mathematical displacement function, texture sampling at those distorted coordinates, and SDF-based masking. The blur is the most architecturally significant decision -- a separable two-pass Gaussian blur requires two intermediate textures and two additional render passes, while a single-pass approach with limited samples is simpler but lower quality. Given this is Phase 4 (core functionality, not polish), a single-pass multi-sample blur is recommended, with separable blur deferred to Phase 7 if needed.

**Primary recommendation:** Add a glass render pass with a single WGSL shader that combines UV distortion (refraction), multi-tap blur sampling, SDF rounded rectangle masking with fwidth anti-aliasing, and configurable opacity/tint -- all controlled via a uniform buffer. Use the existing offscreen texture as the background source.

## Standard Stack

### Core

No new libraries are needed. Phase 4 is entirely WGSL shader code + C++ pipeline setup using the existing WebGPU/emdawnwebgpu stack.

| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| WGSL | WebGPU spec | Shader language for glass effect | Only shader language for WebGPU |
| wgpu::RenderPipeline | emdawnwebgpu (Emscripten 4.0.16) | Glass render pass pipeline | Already used for noise and blit passes |
| wgpu::BindGroupLayout | emdawnwebgpu | Explicit layout for glass uniforms + texture | Project decision from 02-01 |

### Supporting

| Component | Purpose | When to Use |
|-----------|---------|-------------|
| Fullscreen triangle pattern | Glass overlay rendering | Same 3-vertex pattern as noise and blit shaders |
| SDF (Signed Distance Functions) | Rounded rectangle masking | For anti-aliased glass region boundaries |
| fwidth() WGSL builtin | Screen-space derivative for AA | Anti-aliasing SDF edges |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single-pass multi-tap blur | Separable two-pass Gaussian | Higher quality but needs 2 extra textures + 2 extra passes. Defer to Phase 7 if quality insufficient. |
| SDF rounded rectangle | Stencil/clip buffer | SDF is cheaper, more flexible (soft edges), and fully in-shader. Stencil needs extra GPU state. |
| Fragment shader blur | Compute shader blur | Compute is faster for large kernels but adds complexity (storage textures, dispatch). Fragment is simpler for moderate blur. |
| Mathematical UV displacement | Normal map-based refraction | Normal maps need an extra texture. Math displacement is simpler for 2D glass panels. |

## Architecture Patterns

### Render Pass Architecture

Current (Phase 3):
```
Pass 1: Noise -> offscreenTexture
Pass 2: Blit offscreenTexture -> surface
```

Phase 4 target:
```
Pass 1: Noise -> offscreenTexture      (unchanged)
Pass 2: Glass -> surface               (NEW: replaces blit pass)
```

**Key insight:** The glass pass REPLACES the blit pass, not adds to it. The glass shader does everything the blit shader did (sample background, output to surface) PLUS refraction, blur, masking, and tint. Outside the glass region, the shader outputs the background unchanged (passthrough). Inside the glass region, it outputs the glass effect. This avoids needing a third pass entirely.

### Recommended Project Structure

```
engine/src/
  shaders/
    noise.wgsl.h          # Existing: simplex noise background
    blit.wgsl.h            # Existing: keep for potential future use
    glass.wgsl.h           # NEW: glass refraction + blur + SDF shader
  background_engine.h      # Updated: glass pipeline members + uniforms
  background_engine.cpp    # Updated: glass pass replaces blit pass
  main.cpp                 # Updated: expose glass parameter setters via Embind
```

### Pattern 1: Glass Uniform Buffer

**What:** A uniform buffer containing all configurable glass parameters, passed to the glass shader.
**When to use:** Every frame, updated when parameters change.

```c++
// C++ struct (must match WGSL layout with proper alignment)
struct GlassUniforms {
    // Glass region (normalized 0..1 coordinates)
    float rectX;        // offset 0
    float rectY;        // offset 4
    float rectW;        // offset 8
    float rectH;        // offset 12

    // Glass parameters
    float cornerRadius; // offset 16 (pixels)
    float blurIntensity;// offset 20 (0.0 = sharp, 1.0 = max frosted)
    float opacity;      // offset 24 (0.0 = invisible, 1.0 = fully opaque tint)
    float refractionStrength; // offset 28 (UV distortion magnitude)

    // Tint color
    float tintR;        // offset 32
    float tintG;        // offset 36
    float tintB;        // offset 40
    float _pad;         // offset 44 (align to 16 bytes)

    // Resolution (needed for pixel-space SDF)
    float resolutionX;  // offset 48
    float resolutionY;  // offset 52
    float _pad2;        // offset 56
    float _pad3;        // offset 60
};
// Total: 64 bytes (4 x vec4f aligned)
```

```wgsl
// WGSL matching struct
struct GlassUniforms {
    rect: vec4f,              // x, y, w, h in normalized coords
    cornerRadius: f32,
    blurIntensity: f32,
    opacity: f32,
    refractionStrength: f32,
    tint: vec3f,
    _pad: f32,
    resolution: vec2f,
    _pad2: vec2f,
};
```

### Pattern 2: SDF Rounded Rectangle with Anti-Aliasing

**What:** Signed distance function for a rounded rectangle, used as an alpha mask.
**When to use:** In the glass fragment shader to determine inside/outside glass region.
**Source:** Inigo Quilez, https://iquilezles.org/articles/distfunctions2d/

```wgsl
// Rounded box SDF (Inigo Quilez)
// p: point relative to box center
// b: box half-dimensions
// r: corner radius
fn sdRoundedBox(p: vec2f, b: vec2f, r: f32) -> f32 {
    let q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, vec2f(0.0))) - r;
}

// Anti-aliased mask from SDF using screen-space derivatives
fn sdfMask(dist: f32) -> f32 {
    let w = fwidth(dist);
    return smoothstep(w, -w, dist);  // 1.0 inside, 0.0 outside, smooth at edge
}
```

### Pattern 3: UV Distortion for Refraction

**What:** Offset UV coordinates to simulate light bending through glass.
**When to use:** Before sampling the background texture inside the glass region.

```wgsl
// Simple barrel/pincushion distortion for glass refraction
fn distortUV(uv: vec2f, center: vec2f, strength: f32) -> vec2f {
    let offset = uv - center;
    let dist = length(offset);
    // Barrel distortion: push pixels outward from center
    let distortion = offset * (1.0 + strength * dist * dist);
    return center + distortion;
}
```

### Pattern 4: Multi-Tap Blur Sampling

**What:** Sample the background texture at multiple offsets around each pixel and average.
**When to use:** Inside the glass region to create frosted glass appearance.

```wgsl
// 9-tap blur kernel (box approximation, fast)
fn blurSample(tex: texture_2d<f32>, samp: sampler, uv: vec2f,
              texelSize: vec2f, intensity: f32) -> vec4f {
    let radius = intensity * 4.0;  // max 4 texel radius
    var color = vec4f(0.0);
    var total = 0.0;

    // 3x3 weighted samples (can expand to 5x5 for better quality)
    for (var x = -1; x <= 1; x++) {
        for (var y = -1; y <= 1; y++) {
            let offset = vec2f(f32(x), f32(y)) * texelSize * radius;
            let weight = 1.0 / (1.0 + f32(x*x + y*y));  // center-weighted
            color += textureSample(tex, samp, uv + offset) * weight;
            total += weight;
        }
    }
    return color / total;
}
```

**IMPORTANT WGSL constraint:** `textureSample` must only be called in uniform control flow. The loop bounds above are compile-time constants, which satisfies this requirement. Dynamic loop bounds would violate uniform control flow and cause a compilation error.

### Pattern 5: Alpha Blending Pipeline State

**What:** Configure the glass render pipeline with alpha blending so the glass region composites over the background.
**When to use:** When creating the glass render pipeline in C++.

```c++
// C++ blend state for premultiplied alpha compositing
wgpu::BlendState blendState{};
blendState.color.srcFactor = wgpu::BlendFactor::One;
blendState.color.dstFactor = wgpu::BlendFactor::OneMinusSrcAlpha;
blendState.color.operation = wgpu::BlendOperation::Add;
blendState.alpha.srcFactor = wgpu::BlendFactor::One;
blendState.alpha.dstFactor = wgpu::BlendFactor::OneMinusSrcAlpha;
blendState.alpha.operation = wgpu::BlendOperation::Add;

wgpu::ColorTargetState colorTarget{};
colorTarget.format = surfaceFormat;
colorTarget.blend = &blendState;
colorTarget.writeMask = wgpu::ColorWriteMask::All;
```

### Anti-Patterns to Avoid

- **Dynamic loop bounds in textureSample calls:** WGSL requires uniform control flow for `textureSample`. Use compile-time constant loop bounds (literal integers), not uniform buffer values. If variable sample counts are needed, use `textureLoad` instead (no uniform control flow requirement, but no filtering).
- **Forgetting struct alignment:** WGSL uniform structs follow std140-like alignment rules. `vec3f` takes 16 bytes (aligned to 16). Always pad to vec4f boundaries. The C++ struct must match byte-for-byte.
- **Sampling outside [0,1] UV range:** UV distortion can push coordinates outside valid range. The existing `ClampToEdge` sampler address mode handles this, but be aware it can cause visible edge stretching at extreme distortion values.
- **Glass pass as separate additive pass:** Do NOT render glass as a separate pass that composites on top. Instead, have the glass shader output the final pixel color (background passthrough outside glass, glass effect inside glass). This avoids needing alpha blending complexity for the single-glass-region case.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rounded rectangle masking | Vertex-based clipping geometry | SDF `sdRoundedBox` + `fwidth` AA | SDF is resolution-independent, produces perfect anti-aliasing, and requires zero geometry |
| Anti-aliasing at edges | MSAA or supersampling | `fwidth()` + `smoothstep()` on SDF | fwidth gives exact pixel width for free, smoothstep produces analytically perfect AA |
| Gaussian kernel weights | Runtime computation in shader | Precomputed weights as constants | Gaussian weights are mathematically determined, compute once |
| UV coordinate clamping | Manual clamp logic | `ClampToEdge` sampler address mode | Hardware sampler handles this automatically and correctly |

**Key insight:** For Phase 4, the glass effect is entirely a fragment shader problem. No geometry, no vertex buffers, no mesh data. Everything is computed from UVs, uniforms, and texture sampling. This keeps the architecture simple.

## Common Pitfalls

### Pitfall 1: WGSL Uniform Struct Alignment Mismatch
**What goes wrong:** C++ struct layout doesn't match WGSL struct layout, causing garbled uniform values.
**Why it happens:** WGSL follows WebGPU alignment rules (similar to std140): vec2f aligns to 8 bytes, vec3f aligns to 16 bytes, vec4f aligns to 16 bytes. C++ structs may pack differently.
**How to avoid:** Use only f32 and vec4f members in the struct. Avoid vec3f (wastes space and alignment is tricky). Use explicit padding fields. Verify total struct size is a multiple of 16.
**Warning signs:** Glass appears at wrong position, parameters seem to have no effect, or values appear swapped.

### Pitfall 2: textureSample in Non-Uniform Control Flow
**What goes wrong:** WGSL shader compilation fails with "textureSample must be in uniform control flow."
**Why it happens:** `textureSample` uses implicit derivatives (for mip selection), which require all threads in a quad to execute the same path. If the sample call is inside a branch that depends on per-pixel data, it violates this rule.
**How to avoid:** Use compile-time constant loop bounds for blur sampling. Use `textureSampleLevel(tex, samp, uv, 0.0)` instead of `textureSample` if you need to sample inside non-uniform branches -- `textureSampleLevel` takes an explicit LOD and has no uniform control flow requirement.
**Warning signs:** Shader compilation error at runtime.

### Pitfall 3: Blur Kernel Too Large for Fragment Shader
**What goes wrong:** Performance drops dramatically when blur intensity is high, because each fragment samples too many texels.
**Why it happens:** A fragment shader blur with N samples means N texture reads per pixel. At 1920x1080, even 25 samples per pixel = 51M texture reads per frame.
**How to avoid:** Limit to 9-13 taps maximum for the single-pass approach. For higher quality blur, switch to separable two-pass (Phase 7). Use bilinear interpolation trick: sample between texel centers to get two texels for the price of one.
**Warning signs:** Frame rate drops below 60 FPS when blur is enabled, especially at high resolution.

### Pitfall 4: Glass Region Coordinates Wrong Space
**What goes wrong:** Glass rectangle appears at wrong position or size, doesn't match expected screen region.
**Why it happens:** Confusion between normalized UV space (0..1), pixel space, and clip space (-1..1). The SDF needs pixel-space distances for the corner radius to look correct, but the glass rect might be specified in normalized coords.
**How to avoid:** Pass glass rect in normalized [0,1] UV coordinates. Convert to pixel space inside the shader by multiplying by resolution. Corner radius should be in pixels. The SDF computation should happen in pixel space.
**Warning signs:** Corner radius appears to change with window size, glass region is offset or scaled incorrectly.

### Pitfall 5: No Visual Difference Between Glass and Background
**What goes wrong:** The glass region looks identical to the surrounding background -- no visible refraction.
**Why it happens:** Refraction strength is too low, or the background has low-frequency content where UV distortion doesn't produce visible differences.
**How to avoid:** Start with an exaggerated refraction strength (0.05-0.1 in UV space) for debugging. Add a subtle tint color so the glass region is always distinguishable. The simplex noise background has enough high-frequency detail that even small UV offsets should be visible.
**Warning signs:** Glass region blends seamlessly with background (looks like nothing is there).

### Pitfall 6: fwidth Returns Zero or Garbage on Some GPUs
**What goes wrong:** Anti-aliasing doesn't work, edges appear either fully hard or fully invisible.
**Why it happens:** fwidth behavior depends on GPU/driver. Some implementations return coarse derivatives. In compute shaders, derivatives are not available at all (not applicable here since we use fragment shaders).
**How to avoid:** Always test fwidth in a fragment shader (where it's guaranteed to work). Use `fwidthFine` if available and quality matters. Have a fallback: if fwidth returns unexpected values, use a fixed pixel-width smoothstep (e.g., 1.5 / resolution).
**Warning signs:** Aliased edges on some devices but not others.

## Code Examples

### Complete Glass Fragment Shader (Recommended Approach)

```wgsl
// Source: Synthesized from Inigo Quilez SDF + standard refraction patterns

struct GlassUniforms {
    rect: vec4f,              // x, y, w, h in normalized [0,1] coords
    cornerRadius: f32,        // pixels
    blurIntensity: f32,       // 0.0 = sharp, 1.0 = max frosted
    opacity: f32,             // 0.0 = invisible, 1.0 = solid tint
    refractionStrength: f32,  // UV distortion magnitude
    tint: vec3f,              // RGB tint color
    _pad: f32,
    resolution: vec2f,        // canvas width, height in pixels
    _pad2: vec2f,
};

@group(0) @binding(0) var texSampler: sampler;
@group(0) @binding(1) var texBackground: texture_2d<f32>;
@group(0) @binding(2) var<uniform> glass: GlassUniforms;

// SDF for rounded rectangle (Inigo Quilez)
fn sdRoundedBox(p: vec2f, b: vec2f, r: f32) -> f32 {
    let q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, vec2f(0.0))) - r;
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
    // Sample background at current UV (passthrough for non-glass pixels)
    let bgColor = textureSample(texBackground, texSampler, uv);

    // Convert UV to pixel space for SDF
    let pixelPos = uv * glass.resolution;
    let rectCenter = (glass.rect.xy + glass.rect.zw * 0.5) * glass.resolution;
    let rectHalf = glass.rect.zw * 0.5 * glass.resolution;

    // Compute SDF distance (negative = inside)
    let dist = sdRoundedBox(pixelPos - rectCenter, rectHalf, glass.cornerRadius);

    // Anti-aliased mask using screen-space derivatives
    let w = fwidth(dist);
    let mask = smoothstep(w, -w, dist);

    // Early out: outside glass region
    if (mask < 0.001) {
        return bgColor;
    }

    // --- Inside glass region ---

    // UV distortion (refraction)
    let glassCenter = glass.rect.xy + glass.rect.zw * 0.5;
    let offset = uv - glassCenter;
    let distFromCenter = length(offset / (glass.rect.zw * 0.5)); // normalized 0..1
    let distortedUV = uv + offset * glass.refractionStrength * (1.0 - distFromCenter);

    // Blur sampling (9-tap weighted)
    let texelSize = 1.0 / glass.resolution;
    let blurRadius = glass.blurIntensity * 4.0;
    var blurColor = vec4f(0.0);
    var totalWeight = 0.0;

    // 3x3 kernel with center weighting
    for (var x = -1; x <= 1; x++) {
        for (var y = -1; y <= 1; y++) {
            let sampleOffset = vec2f(f32(x), f32(y)) * texelSize * blurRadius;
            let weight = 1.0 / (1.0 + f32(x * x + y * y));
            blurColor += textureSample(texBackground, texSampler,
                                       distortedUV + sampleOffset) * weight;
            totalWeight += weight;
        }
    }
    blurColor /= totalWeight;

    // Mix blur with tint based on opacity
    let tintColor = vec4f(glass.tint, 1.0);
    let glassColor = mix(blurColor, tintColor, glass.opacity);

    // Composite: blend glass over background using SDF mask
    let result = mix(bgColor, glassColor, mask);
    return result;
}
```

### Glass Pipeline Setup (C++ Pattern)

```c++
// Source: Follows same pattern as existing createBlitPipeline()

void BackgroundEngine::createGlassPipeline() {
    // Shader module
    wgpu::ShaderSourceWGSL wgslSource{};
    wgslSource.code = glassShaderCode;
    wgpu::ShaderModuleDescriptor shaderDesc{};
    shaderDesc.nextInChain = &wgslSource;
    glassShaderModule = device.CreateShaderModule(&shaderDesc);

    // Bind group layout: sampler(0), texture(1), uniform(2)
    wgpu::BindGroupLayoutEntry entries[3]{};

    entries[0].binding = 0;
    entries[0].visibility = wgpu::ShaderStage::Fragment;
    entries[0].sampler.type = wgpu::SamplerBindingType::Filtering;

    entries[1].binding = 1;
    entries[1].visibility = wgpu::ShaderStage::Fragment;
    entries[1].texture.sampleType = wgpu::TextureSampleType::Float;
    entries[1].texture.viewDimension = wgpu::TextureViewDimension::e2D;

    entries[2].binding = 2;
    entries[2].visibility = wgpu::ShaderStage::Fragment;
    entries[2].buffer.type = wgpu::BufferBindingType::Uniform;
    entries[2].buffer.minBindingSize = sizeof(GlassUniforms);

    wgpu::BindGroupLayoutDescriptor bglDesc{};
    bglDesc.entryCount = 3;
    bglDesc.entries = entries;
    glassBindGroupLayout = device.CreateBindGroupLayout(&bglDesc);

    // Pipeline layout
    wgpu::PipelineLayoutDescriptor plDesc{};
    plDesc.bindGroupLayoutCount = 1;
    plDesc.bindGroupLayouts = &glassBindGroupLayout;
    wgpu::PipelineLayout layout = device.CreatePipelineLayout(&plDesc);

    // Color target (no blending needed -- shader does compositing)
    wgpu::ColorTargetState colorTarget{};
    colorTarget.format = surfaceFormat;
    colorTarget.writeMask = wgpu::ColorWriteMask::All;

    // Fragment state
    wgpu::FragmentState fragmentState{};
    fragmentState.module = glassShaderModule;
    fragmentState.entryPoint = "fs_main";
    fragmentState.targetCount = 1;
    fragmentState.targets = &colorTarget;

    // Render pipeline
    wgpu::RenderPipelineDescriptor pipelineDesc{};
    pipelineDesc.layout = layout;
    pipelineDesc.vertex.module = glassShaderModule;
    pipelineDesc.vertex.entryPoint = "vs_main";
    pipelineDesc.fragment = &fragmentState;
    pipelineDesc.primitive.topology = wgpu::PrimitiveTopology::TriangleList;
    pipelineDesc.multisample.count = 1;
    pipelineDesc.multisample.mask = ~0u;

    glassPipeline = device.CreateRenderPipeline(&pipelineDesc);
}
```

### Embind Parameter Setters

```c++
// Source: Follows existing Embind pattern from main.cpp

// In BackgroundEngine class:
void setGlassRect(float x, float y, float w, float h);
void setGlassParams(float cornerRadius, float blur, float opacity, float refraction);
void setGlassTint(float r, float g, float b);

// In EMSCRIPTEN_BINDINGS:
emscripten::class_<BackgroundEngine>("BackgroundEngine")
    .function("resize", &BackgroundEngine::resize)
    .function("setGlassRect", &BackgroundEngine::setGlassRect)
    .function("setGlassParams", &BackgroundEngine::setGlassParams)
    .function("setGlassTint", &BackgroundEngine::setGlassTint);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ShaderModuleWGSLDescriptor | ShaderSourceWGSL (chained) | emdawnwebgpu 2024+ | Already using current approach |
| Auto bind group layout | Explicit BindGroupLayout | Project decision (02-01) | Use explicit layouts for all new pipelines |
| Compute shader blur | Fragment shader blur | N/A (both valid) | Fragment shader is simpler for our single-pass architecture; compute shader is better for large blur radii |
| 3D mesh refraction (Snell's law) | 2D UV distortion | N/A (different domains) | We do 2D screen-space glass, not 3D object refraction |

**Current in WGSL:**
- `textureSample` for filtered texture reads in fragment shaders
- `textureSampleLevel` for explicit LOD (usable outside uniform control flow)
- `fwidth` / `fwidthFine` / `fwidthCoarse` for screen-space derivatives
- `smoothstep` builtin for SDF anti-aliasing
- Struct alignment follows WebGPU spec (similar to std140)

## Open Questions

1. **9-tap blur quality sufficient?**
   - What we know: 9-tap (3x3) blur produces a mild frosted effect. Higher quality requires 25-tap (5x5) or separable passes.
   - What's unclear: Whether 9-tap is visually convincing enough for "frosted glass" at the Phase 4 success criteria level.
   - Recommendation: Start with 9-tap. If insufficient, expand to 13-tap (diamond pattern) before committing to multi-pass. Phase 7 can add proper separable Gaussian or Kawase blur.

2. **Refraction distortion formula tuning**
   - What we know: Barrel distortion (`offset * strength * dist^2`) is the simplest plausible refraction. More physically accurate would use Snell's law with surface normals.
   - What's unclear: What refraction strength values look "right" vs. cartoonish.
   - Recommendation: Start with `refractionStrength = 0.02` as default. Expose as parameter. Success criteria only requires "visibly refracted/distorted" which is a low bar.

3. **Glass pass architecture: replace blit or add third pass?**
   - What we know: Replacing the blit pass is simpler (same pass count). Adding a third pass allows keeping the blit as fallback.
   - What's unclear: Whether future phases (multiple glass regions) will need the blit pass back.
   - Recommendation: Replace the blit pass. The glass shader includes passthrough behavior for non-glass pixels, making the blit pass redundant. If multiple glass regions are needed later, the glass shader can be extended with array uniforms or instancing.

## Sources

### Primary (HIGH confidence)
- Inigo Quilez, 2D Distance Functions: https://iquilezles.org/articles/distfunctions2d/ -- sdRoundedBox SDF formula
- WGSL Specification (W3C): https://www.w3.org/TR/WGSL/ -- language spec, builtin functions
- WebGPU Rocks WGSL Reference: https://webgpu.rocks/wgsl/functions/derivative/ -- fwidth, dpdx, dpdy function signatures
- WebGPU Rocks Texture Functions: https://webgpu.rocks/wgsl/functions/texture/ -- textureSample, textureSampleLevel, textureDimensions signatures
- WebGPU Fundamentals Transparency: https://webgpufundamentals.org/webgpu/lessons/webgpu-transparency.html -- BlendState configuration

### Secondary (MEDIUM confidence)
- WebGPU Unleashed Gaussian Blur: https://shi-yan.github.io/webgpuunleashed/2D_Techniques/implementing_gaussian_blur.html -- WGSL blur implementation patterns
- WebGPU Samples Image Blur: https://webgpu.github.io/webgpu-samples/samples/imageBlur/ -- official compute shader blur example
- Bevy WGSL SDFs: https://blog.hexbee.net/35-distance-functions-sdfs -- WGSL SDF with fwidth anti-aliasing
- Drew Cassidy SDF Antialiasing: https://drewcassidy.me/2020/06/26/sdf-antialiasing/ -- fwidth + smoothstep technique
- Dual Kawase Blur: https://blog.frost.kiwi/dual-kawase/ -- efficient blur algorithm for future reference (Phase 7)

### Tertiary (LOW confidence)
- Various Medium articles on Apple Liquid Glass effect -- conceptual approaches, not verified shader code
- ShaderToy rounded box examples -- GLSL not WGSL, syntax differs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries needed, extends existing WebGPU/WGSL patterns
- Architecture (glass pass replacing blit): HIGH - Clear extension of existing two-pass architecture
- SDF rounded rectangle: HIGH - Well-established technique, verified formula from Inigo Quilez
- Anti-aliasing with fwidth: HIGH - Standard WGSL builtin, verified in spec
- Blur approach (9-tap fragment): MEDIUM - Will work but quality/performance tradeoff needs runtime validation
- Refraction formula: MEDIUM - Simple barrel distortion will work, but exact parameters need visual tuning
- Uniform struct alignment: HIGH - Well-documented in WebGPU spec, verified with existing project patterns

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable domain, WGSL spec is finalized)

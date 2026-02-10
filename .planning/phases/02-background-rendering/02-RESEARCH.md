# Phase 2: Background Rendering - Research

**Researched:** 2026-02-10
**Domain:** Procedural noise shaders (WGSL), WebGPU render-to-texture, C++ engine API via Embind, canvas resize handling
**Confidence:** HIGH

## Summary

Phase 2 transforms the Phase 1 proof-of-concept (solid blue clear color) into a full procedural noise background animation running at 60FPS. The work involves three main technical areas: (1) creating a WGSL fragment shader that generates animated simplex noise with fractional Brownian motion (fBM), (2) setting up a render-to-texture pipeline in C++ that renders the noise to an offscreen texture (for later consumption by glass shaders in Phase 3+), while also rendering to the surface for immediate visual feedback, and (3) exposing a clean C++ engine API via Embind with init(), update(), getTexture(), and resize() functions callable from JavaScript.

The noise algorithm itself is well-established -- simplex noise WGSL implementations exist and are straightforward ports from GLSL. The fullscreen quad rendering pattern (single large triangle with hardcoded vertices) is a standard WebGPU technique. The main complexity is in properly structuring the C++ engine class, managing the render pipeline lifecycle (shader modules, bind groups, uniform buffers), handling canvas resize correctly (surface reconfiguration + offscreen texture recreation), and using the correct emdawnwebgpu C++ API conventions discovered in Phase 1.

A critical API discovery: the current emdawnwebgpu/Dawn C++ bindings use `wgpu::ShaderSourceWGSL` (not the older `wgpu::ShaderModuleWGSLDescriptor`) for creating shader modules from WGSL source. The existing Phase 1 codebase uses PascalCase method names (`CreateShaderModule`, `CreateTexture`, etc.) and the `wgpu::CallbackMode::AllowSpontaneous` pattern for async operations.

**Primary recommendation:** Build a BackgroundEngine C++ class that owns the noise render pipeline, uniform buffer (time + resolution), and offscreen texture. Render the noise via a fullscreen triangle with simplex fBM in the fragment shader. Expose via Embind. Drive animation from the existing `emscripten_set_main_loop` callback. Handle resize via JS ResizeObserver calling into the Embind-exposed resize() method.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Emscripten + emdawnwebgpu | 4.0.10+ | C++ to WASM with WebGPU bindings | Already established in Phase 1 |
| WGSL | WebGPU spec | Shader language for noise + fullscreen quad | Only shader language for WebGPU |
| Embind | Emscripten built-in | C++ class/function exposure to JS | Type-safe, handles memory, already linked via `-lembind` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Simplex noise (inline WGSL) | N/A | Procedural noise generation | Core of the background animation |
| fBM (inline WGSL) | N/A | Multi-octave noise layering | Richer visual complexity |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Simplex noise | Perlin noise | Simplex is faster, fewer directional artifacts, better for 2D |
| Fragment shader noise | Compute shader noise | Fragment is simpler, no staging buffer needed, compute is overkill for this |
| Single large triangle | Two-triangle quad | Large triangle avoids 2x2 fragment processing overhead at diagonal seam |
| Inline WGSL string | External .wgsl file | Inline keeps the build simple; external files need a file-loading mechanism in C++/WASM |

**No additional npm packages needed** -- this phase is entirely C++/WGSL with Embind exposure.

## Architecture Patterns

### Recommended Project Structure
```
engine/
├── src/
│   ├── main.cpp              # Entry point (simplified to use BackgroundEngine)
│   ├── background_engine.h   # BackgroundEngine class declaration
│   ├── background_engine.cpp # BackgroundEngine implementation
│   └── shaders/
│       └── noise.wgsl.h      # WGSL shader as C++ raw string literal
└── CMakeLists.txt            # Updated to compile new source files
```

### Pattern 1: Fullscreen Triangle with Hardcoded Vertices
**What:** Render a single triangle that covers the entire clip space, avoiding the need for vertex buffers. The vertex shader generates positions from `vertex_index`.
**When to use:** Any fullscreen effect (post-processing, procedural backgrounds, shader toys).
**Confidence:** HIGH -- standard WebGPU pattern, documented by webgpufundamentals.org

**WGSL Example:**
```wgsl
// Source: https://webgpufundamentals.org/webgpu/lessons/webgpu-large-triangle-to-cover-clip-space.html
struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    // Single triangle covering clip space [-1,1] with UVs [0,1]
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
```

### Pattern 2: Simplex Noise with fBM in Fragment Shader
**What:** Layer multiple octaves of simplex noise to produce organic, flowing patterns. Animate by passing time as a uniform.
**When to use:** Procedural backgrounds, fluid-like visual effects.
**Confidence:** HIGH -- simplex noise is well-established, WGSL ports exist (munrocket/noise-algorithms gist)

**WGSL Example:**
```wgsl
// Source: https://gist.github.com/munrocket/236ed5ba7e409b8bdf1ff6eca5dcdc39
// Adapted from Stefan Gustavson's simplex noise

struct Uniforms {
    time: f32,
    resolution: vec2f,
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

// ... simplex2D function (see Code Examples section) ...

fn fbm(st: vec2f) -> f32 {
    var value: f32 = 0.0;
    var amplitude: f32 = 0.5;
    var frequency: f32 = 1.0;
    for (var i: u32 = 0u; i < 6u; i++) {
        value += amplitude * simplexNoise2(st * frequency + uniforms.time * 0.1);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
    let st = uv * uniforms.resolution / min(uniforms.resolution.x, uniforms.resolution.y);
    let n = fbm(st * 3.0) * 0.5 + 0.5;
    return vec4f(vec3f(n * 0.2, n * 0.4, n * 0.8), 1.0);
}
```

### Pattern 3: Render-to-Offscreen-Texture + Blit-to-Surface
**What:** Render the noise to an offscreen texture (with `RENDER_ATTACHMENT | TEXTURE_BINDING` usage), then draw that texture to the surface swap chain. The offscreen texture is what Phase 3+ will sample for glass refraction.
**When to use:** When the rendered content needs to be sampled by other shaders (the glass refraction pipeline).
**Confidence:** HIGH -- standard two-pass rendering pattern

**C++ Pattern:**
```cpp
// Create offscreen texture
wgpu::TextureDescriptor texDesc{};
texDesc.size = {width, height, 1};
texDesc.format = wgpu::TextureFormat::BGRA8Unorm;
texDesc.usage = wgpu::TextureUsage::RenderAttachment |
                wgpu::TextureUsage::TextureBinding;
texDesc.dimension = wgpu::TextureDimension::e2D;
texDesc.mipLevelCount = 1;
texDesc.sampleCount = 1;
backgroundTexture = device.CreateTexture(&texDesc);
backgroundTextureView = backgroundTexture.CreateView();
```

### Pattern 4: Uniform Buffer for Per-Frame Data
**What:** Create a uniform buffer at init time, update it via `queue.WriteBuffer()` each frame with time and resolution data.
**When to use:** Passing animation time, resolution, and other per-frame parameters to shaders.
**Confidence:** HIGH -- standard WebGPU pattern, verified from Learn WebGPU C++ docs

**C++ Pattern:**
```cpp
// Source: https://eliemichel.github.io/LearnWebGPU/basic-3d-rendering/shader-uniforms/a-first-uniform.html
struct Uniforms {
    float time;
    float _pad1;  // Padding for alignment
    float resolutionX;
    float resolutionY;
};

// Creation (once at init)
wgpu::BufferDescriptor bufDesc{};
bufDesc.size = sizeof(Uniforms);
bufDesc.usage = wgpu::BufferUsage::CopyDst | wgpu::BufferUsage::Uniform;
uniformBuffer = device.CreateBuffer(&bufDesc);

// Per-frame update
Uniforms uniforms{time, 0.0f, (float)width, (float)height};
device.GetQueue().WriteBuffer(uniformBuffer, 0, &uniforms, sizeof(Uniforms));
```

### Pattern 5: Shader Module Creation (emdawnwebgpu Current API)
**What:** Use `wgpu::ShaderSourceWGSL` (not the older `wgpu::ShaderModuleWGSLDescriptor`) to create shader modules from inline WGSL strings.
**When to use:** Always when creating shaders with the current emdawnwebgpu bindings.
**Confidence:** HIGH -- verified from kainino0x/webgpu-cross-platform-demo (the official emdawnwebgpu reference)

**C++ Pattern:**
```cpp
// Source: https://github.com/kainino0x/webgpu-cross-platform-demo main.cpp
wgpu::ShaderSourceWGSL wgslSource{};
wgslSource.code = shaderCode;  // const char* with WGSL

wgpu::ShaderModuleDescriptor shaderDesc{};
shaderDesc.nextInChain = &wgslSource;
wgpu::ShaderModule shaderModule = device.CreateShaderModule(&shaderDesc);
```

### Pattern 6: Embind Class Exposure
**What:** Expose the BackgroundEngine C++ class to JavaScript via Embind, allowing JS to call init(), update(), resize(), and getTexture().
**When to use:** This is the ENGINE-03 requirement (API exposure).
**Confidence:** HIGH -- Embind is mature, stable, already linked in the project

**C++ Pattern:**
```cpp
// Source: https://emscripten.org/docs/porting/connecting_cpp_and_javascript/embind.html
#include <emscripten/bind.h>
using namespace emscripten;

EMSCRIPTEN_BINDINGS(background_engine) {
    class_<BackgroundEngine>("BackgroundEngine")
        .constructor<>()
        .function("init", &BackgroundEngine::init)
        .function("update", &BackgroundEngine::update)
        .function("resize", &BackgroundEngine::resize)
        .function("getTextureHandle", &BackgroundEngine::getTextureHandle);
}
```

**JavaScript usage:**
```typescript
const engine = new Module.BackgroundEngine();
engine.init();
// In animation loop:
engine.update(deltaTime);
// On resize:
engine.resize(newWidth, newHeight);
// Cleanup:
engine.delete(); // IMPORTANT: prevent memory leak
```

### Pattern 7: Canvas Resize Handling
**What:** Use JS ResizeObserver to detect canvas size changes, then call the C++ engine's resize() which reconfigures the surface and recreates the offscreen texture.
**When to use:** ENGINE-04 requirement (resize without crashes).
**Confidence:** HIGH -- ResizeObserver is standard and supported in all WebGPU-capable browsers

**Architecture:**
1. JS sets up ResizeObserver on canvas element
2. On resize: update canvas.width/height attributes, call engine.resize(w, h)
3. C++ resize() reconfigures surface and recreates offscreen texture at new dimensions
4. Surface reconfiguration: call `surface.Configure()` with new width/height
5. Offscreen texture: destroy old, create new at new size

### Anti-Patterns to Avoid
- **Do NOT allocate textures per frame:** Create the offscreen texture once at init (and on resize). Reuse it every frame. Per-frame allocation causes memory leaks and GC pressure.
- **Do NOT use a two-triangle quad:** Use a single large triangle (3 vertices). It avoids fragment processing overhead at the diagonal seam where two triangles meet.
- **Do NOT use `wgpu::ShaderModuleWGSLDescriptor`:** This is the OLD name. The current emdawnwebgpu API uses `wgpu::ShaderSourceWGSL`.
- **Do NOT forget WGSL uniform alignment:** Uniform structs in WGSL require 16-byte alignment for vec2/vec3/vec4 types. Pad your C++ struct to match.
- **Do NOT skip the Embind `.delete()` call in JS:** C++ objects created via Embind leak if not explicitly deleted. The React cleanup (useEffect return) must call `.delete()`.
- **Do NOT hardcode canvas dimensions:** Phase 1 uses 512x512. Phase 2 must use the actual canvas/window size.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Noise function | Custom noise algorithm | Simplex noise from Gustavson/munrocket WGSL port | Battle-tested, mathematically correct, well-optimized |
| Fullscreen rendering | Custom vertex buffer with quad geometry | Hardcoded fullscreen triangle in vertex shader | Zero vertex buffer overhead, standard pattern |
| C++/JS interop | Manual EM_JS/EM_ASM wrappers | Embind `class_<>` bindings | Type-safe, automatic binding generation, handles memory |
| Frame timing | Custom timer in C++ | `emscripten_get_now()` or `emscripten_performance_now()` | High-precision browser time, no cross-platform issues |
| Resize detection | Manual polling of window.innerWidth | JS `ResizeObserver` calling Embind resize() | Efficient, batched, handles all resize triggers |

**Key insight:** Phase 2 is fundamentally a shader authoring + render pipeline plumbing task. The noise math is solved (use existing WGSL implementations). The rendering patterns are standard WebGPU. The focus should be on clean architecture and correct pipeline setup, not algorithmic novelty.

## Common Pitfalls

### Pitfall 1: WGSL Uniform Struct Alignment Mismatch
**What goes wrong:** C++ struct fields don't match WGSL alignment rules, causing garbled uniform data in the shader.
**Why it happens:** WGSL requires specific alignment: `f32` = 4 bytes, `vec2f` = 8 bytes, `vec3f` = 16 bytes (!), `vec4f` = 16 bytes. A `vec2f` after an `f32` needs 4 bytes of padding.
**How to avoid:**
```cpp
// C++ struct matching WGSL layout
struct Uniforms {
    float time;         // offset 0, size 4
    float _pad1;        // offset 4, size 4 (padding)
    float resolutionX;  // offset 8, size 4
    float resolutionY;  // offset 12, size 4
};  // Total: 16 bytes, aligned
```
```wgsl
// WGSL uniform declaration
struct Uniforms {
    time: f32,
    _pad: f32,
    resolution: vec2f,  // vec2f at offset 8 (needs 8-byte alignment)
};
```
**Warning signs:** Shader receives wrong values (e.g., resolution appears as time), visual glitches that change with window size.

### Pitfall 2: Forgetting to Destroy Old Textures on Resize
**What goes wrong:** Memory grows with each resize event as old textures accumulate.
**Why it happens:** WebGPU textures are GPU resources that must be explicitly destroyed. The C++ `wgpu::Texture` wrapper releases on destruction, but only if the variable goes out of scope or is reassigned.
**How to avoid:** In the resize() method, explicitly call `.Destroy()` on the old texture before creating the new one, or reassign the `wgpu::Texture` member (the C++ wrapper handles release).
**Warning signs:** Growing GPU memory in DevTools, eventual out-of-memory.

### Pitfall 3: Surface Not Reconfigured on Resize
**What goes wrong:** After canvas resize, rendering shows stretched/distorted output or WebGPU validation errors.
**Why it happens:** The surface configuration stores the old width/height. Getting the current texture after resize without reconfiguring returns a texture of the wrong size.
**How to avoid:** Call `surface.Configure()` with the new dimensions in the resize handler, before the next frame render.
**Warning signs:** Stretched rendering, "Texture size mismatch" validation errors.

### Pitfall 4: Render Pipeline Not Matching Texture Format
**What goes wrong:** Pipeline creation fails or produces errors because the color target format doesn't match the render attachment format.
**Why it happens:** The surface format comes from `surface.GetCapabilities()` and may vary by platform (BGRA8Unorm on most, RGBA8Unorm on some). The offscreen texture format must match whatever format is used in the pipeline.
**How to avoid:** Query the surface format once at init, use the same format for both the offscreen texture and the pipeline's `ColorTargetState.format`.
**Warning signs:** "ColorTarget format mismatch" validation error.

### Pitfall 5: emscripten_set_main_loop Timing Issues
**What goes wrong:** Animation runs too fast or too slow, inconsistent speed across devices.
**Why it happens:** Using a fixed timestep assumption, or not calculating delta time between frames.
**How to avoid:** Use `emscripten_get_now()` to get high-precision time in milliseconds. Calculate delta time each frame. Pass delta time to the update() function.
**Warning signs:** Animation speed varies with monitor refresh rate.

### Pitfall 6: Missing Bind Group Layout in Pipeline Creation
**What goes wrong:** Pipeline creation fails because the shader declares uniform bindings but the pipeline layout doesn't include them.
**Why it happens:** Using `layout = nullptr` (auto layout) may work but creates implicit bind group layouts that are harder to manage. Explicit layouts are more reliable.
**How to avoid:** Create an explicit `BindGroupLayout` that matches the shader's `@group(0) @binding(0)` declarations, then create a `PipelineLayout` from it.
**Warning signs:** "Bind group layout mismatch" or "Missing binding" validation errors.

## Code Examples

### Complete Simplex Noise 2D in WGSL
```wgsl
// Source: https://gist.github.com/munrocket/236ed5ba7e409b8bdf1ff6eca5dcdc39
// Based on Stefan Gustavson's "Simplex noise demystified"
// MIT License

fn mod289_2(x: vec2f) -> vec2f {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn mod289_3(x: vec3f) -> vec3f {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn permute3(x: vec3f) -> vec3f {
    return mod289_3(((x * 34.0) + 1.0) * x);
}

fn simplexNoise2(v: vec2f) -> f32 {
    let C = vec4f(0.211324865405187, 0.366025403784439,
                  -0.577350269189626, 0.024390243902439);
    var i = floor(v + dot(v, C.yy));
    let x0 = v - i + dot(i, C.xx);
    var i1 = select(vec2f(0.0, 1.0), vec2f(1.0, 0.0), x0.x > x0.y);
    var x12 = x0.xyxy + C.xxzz;
    x12 = vec4f(x12.x - i1.x, x12.y - i1.y, x12.z, x12.w);
    i = mod289_2(i);
    var p = permute3(permute3(i.y + vec3f(0.0, i1.y, 1.0)) + i.x + vec3f(0.0, i1.x, 1.0));
    var m = max(0.5 - vec3f(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), vec3f(0.0));
    m *= m;
    m *= m;
    let x = 2.0 * fract(p * C.www) - 1.0;
    let h = abs(x) - 0.5;
    let ox = floor(x + 0.5);
    let a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    let g = vec3f(a0.x * x0.x + h.x * x0.y,
                  a0.yz * x12.xz + h.yz * x12.yw);
    return 130.0 * dot(m, g);
}
```

### Fractional Brownian Motion (fBM) in WGSL
```wgsl
// Source: https://thebookofshaders.com/13/ (adapted to WGSL)
fn fbm(st: vec2f, time: f32) -> f32 {
    var value: f32 = 0.0;
    var amplitude: f32 = 0.5;
    var frequency: f32 = 1.0;
    // 6 octaves gives good detail without being too expensive
    for (var i: u32 = 0u; i < 6u; i++) {
        value += amplitude * simplexNoise2(st * frequency + time * 0.15);
        frequency *= 2.0;     // lacunarity
        amplitude *= 0.5;     // persistence/gain
    }
    return value;
}
```

### Complete Render Pipeline Setup in C++ (emdawnwebgpu)
```cpp
// Source: Synthesized from kainino0x/webgpu-cross-platform-demo + LearnWebGPU
void BackgroundEngine::createPipeline() {
    // Shader module
    wgpu::ShaderSourceWGSL wgslSource{};
    wgslSource.code = noiseShaderCode;  // const char* raw string
    wgpu::ShaderModuleDescriptor shaderDesc{};
    shaderDesc.nextInChain = &wgslSource;
    shaderModule = device.CreateShaderModule(&shaderDesc);

    // Bind group layout (one uniform buffer)
    wgpu::BindGroupLayoutEntry layoutEntry{};
    layoutEntry.binding = 0;
    layoutEntry.visibility = wgpu::ShaderStage::Vertex | wgpu::ShaderStage::Fragment;
    layoutEntry.buffer.type = wgpu::BufferBindingType::Uniform;
    layoutEntry.buffer.minBindingSize = sizeof(Uniforms);

    wgpu::BindGroupLayoutDescriptor bglDesc{};
    bglDesc.entryCount = 1;
    bglDesc.entries = &layoutEntry;
    bindGroupLayout = device.CreateBindGroupLayout(&bglDesc);

    // Pipeline layout
    wgpu::PipelineLayoutDescriptor pipelineLayoutDesc{};
    pipelineLayoutDesc.bindGroupLayoutCount = 1;
    pipelineLayoutDesc.bindGroupLayouts = &bindGroupLayout;
    wgpu::PipelineLayout pipelineLayout = device.CreatePipelineLayout(&pipelineLayoutDesc);

    // Color target
    wgpu::ColorTargetState colorTarget{};
    colorTarget.format = surfaceFormat;  // from surface.GetCapabilities()
    colorTarget.writeMask = wgpu::ColorWriteMask::All;

    // Fragment state
    wgpu::FragmentState fragmentState{};
    fragmentState.module = shaderModule;
    fragmentState.entryPoint = "fs_main";
    fragmentState.targetCount = 1;
    fragmentState.targets = &colorTarget;

    // Render pipeline
    wgpu::RenderPipelineDescriptor pipelineDesc{};
    pipelineDesc.layout = pipelineLayout;
    pipelineDesc.vertex.module = shaderModule;
    pipelineDesc.vertex.entryPoint = "vs_main";
    pipelineDesc.fragment = &fragmentState;
    pipelineDesc.primitive.topology = wgpu::PrimitiveTopology::TriangleList;
    pipelineDesc.multisample.count = 1;
    pipelineDesc.multisample.mask = ~0u;

    pipeline = device.CreateRenderPipeline(&pipelineDesc);
}
```

### Uniform Buffer + Bind Group Creation
```cpp
void BackgroundEngine::createUniforms() {
    // Buffer
    wgpu::BufferDescriptor bufDesc{};
    bufDesc.size = sizeof(Uniforms);
    bufDesc.usage = wgpu::BufferUsage::CopyDst | wgpu::BufferUsage::Uniform;
    uniformBuffer = device.CreateBuffer(&bufDesc);

    // Bind group
    wgpu::BindGroupEntry entry{};
    entry.binding = 0;
    entry.buffer = uniformBuffer;
    entry.offset = 0;
    entry.size = sizeof(Uniforms);

    wgpu::BindGroupDescriptor bgDesc{};
    bgDesc.layout = bindGroupLayout;
    bgDesc.entryCount = 1;
    bgDesc.entries = &entry;
    bindGroup = device.CreateBindGroup(&bgDesc);
}
```

### Per-Frame Render Pass
```cpp
void BackgroundEngine::render() {
    // Update uniform buffer with current time and resolution
    Uniforms uniforms{currentTime, 0.0f, (float)width, (float)height};
    device.GetQueue().WriteBuffer(uniformBuffer, 0, &uniforms, sizeof(Uniforms));

    // Get surface texture
    wgpu::SurfaceTexture surfaceTexture;
    surface.GetCurrentTexture(&surfaceTexture);

    // Render pass to surface
    wgpu::RenderPassColorAttachment attachment{};
    attachment.view = surfaceTexture.texture.CreateView();
    attachment.loadOp = wgpu::LoadOp::Clear;
    attachment.storeOp = wgpu::StoreOp::Store;
    attachment.clearValue = {0.0f, 0.0f, 0.0f, 1.0f};

    wgpu::RenderPassDescriptor renderPassDesc{};
    renderPassDesc.colorAttachmentCount = 1;
    renderPassDesc.colorAttachments = &attachment;

    wgpu::CommandEncoder encoder = device.CreateCommandEncoder();
    wgpu::RenderPassEncoder pass = encoder.BeginRenderPass(&renderPassDesc);
    pass.SetPipeline(pipeline);
    pass.SetBindGroup(0, bindGroup);
    pass.Draw(3);  // 3 vertices = fullscreen triangle
    pass.End();

    device.GetQueue().Submit(1, &encoder.Finish());
}
```

### Resize Handler
```cpp
void BackgroundEngine::resize(uint32_t newWidth, uint32_t newHeight) {
    if (newWidth == 0 || newHeight == 0) return;  // Minimized window
    width = newWidth;
    height = newHeight;

    // Reconfigure surface
    wgpu::SurfaceConfiguration config{};
    config.device = device;
    config.format = surfaceFormat;
    config.width = width;
    config.height = height;
    surface.Configure(&config);

    // Recreate offscreen texture at new size
    createOffscreenTexture();
}
```

### Delta Time Calculation with emscripten_get_now()
```cpp
// In main loop callback
double lastTime = 0.0;

void MainLoop() {
    double now = emscripten_get_now();  // milliseconds
    float dt = (float)(now - lastTime) / 1000.0f;  // seconds
    lastTime = now;

    if (dt > 0.1f) dt = 0.1f;  // Cap to prevent huge jumps on tab switch

    engine->update(dt);
    engine->render();
}
```

### JS ResizeObserver Integration
```typescript
// In loader.ts or a new bridge module
function setupResize(canvas: HTMLCanvasElement, engine: any) {
    const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
            const width = entry.devicePixelContentBoxSize?.[0].inlineSize
                ?? Math.round(entry.contentBoxSize[0].inlineSize * devicePixelRatio);
            const height = entry.devicePixelContentBoxSize?.[0].blockSize
                ?? Math.round(entry.contentBoxSize[0].blockSize * devicePixelRatio);
            const maxDim = 4096;  // Reasonable limit
            const w = Math.max(1, Math.min(width, maxDim));
            const h = Math.max(1, Math.min(height, maxDim));
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
                engine.resize(w, h);
            }
        }
    });
    try {
        observer.observe(canvas, { box: 'device-pixel-content-box' });
    } catch {
        observer.observe(canvas, { box: 'content-box' });
    }
    return observer;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `wgpu::ShaderModuleWGSLDescriptor` | `wgpu::ShaderSourceWGSL` | webgpu.h header updates 2025 | Must use new name or compilation fails |
| `wgpu::SurfaceSourceCanvasHTMLSelector` | `wgpu::EmscriptenSurfaceSourceCanvasHTMLSelector` | emdawnwebgpu | Already handled in Phase 1 |
| Two-triangle fullscreen quad | Single large triangle | Long-standing best practice | Minor perf win, simpler code |
| Perlin noise (gradient-based) | Simplex noise (simplex-lattice) | Ken Perlin 2001 | Faster, fewer artifacts, especially in 2D+ |
| Manual timing in C++ | `emscripten_get_now()` for frame delta | Emscripten standard | Portable, high-precision |
| `emscripten_webgpu_get_device()` | C++ creates device via `wgpu::CreateInstance()` | emdawnwebgpu deprecation | Phase 1 already uses correct pattern |

**Deprecated/outdated:**
- `wgpu::ShaderModuleWGSLDescriptor`: Renamed to `wgpu::ShaderSourceWGSL` in current webgpu.h
- `-sUSE_WEBGPU`: Deprecated, use `--use-port=emdawnwebgpu` (already handled in Phase 1)
- Explicit `configure({width, height})` for canvas context: Now deprecated in JS WebGPU API; set canvas attributes directly. But in C++ via emdawnwebgpu, `surface.Configure()` with explicit dimensions is still the correct pattern.

## Open Questions

1. **Offscreen Texture vs Direct Surface Rendering for Phase 2**
   - What we know: Phase 3 needs the background as a sampleable texture. Phase 2's success criteria only require visual output to the canvas.
   - What's unclear: Should Phase 2 render to an offscreen texture AND blit to surface (preparing for Phase 3), or just render directly to the surface (simpler, deferring offscreen rendering to Phase 3)?
   - Recommendation: Render directly to the surface for Phase 2. The pipeline setup is identical either way -- the only difference is the render target. Phase 3 can add the offscreen texture. This keeps Phase 2 focused and testable. BUT: structure the code so the render target is easily swappable (pass the texture view as a parameter to the render function).

2. **Noise Color Palette**
   - What we know: The noise should produce an animated background with a visually appealing color scheme.
   - What's unclear: Exact color mapping (monochrome, gradient mapped, multi-layered with different noise scales for R/G/B).
   - Recommendation: Start with a simple blue/teal gradient mapped from noise value. This matches the "liquid glass" aesthetic. Easy to tune later. Map noise output [-1,1] to a color ramp via mix().

3. **Bind Group Layout: Auto vs Explicit**
   - What we know: Setting `pipelineDesc.layout = nullptr` creates an auto layout. Explicit layouts are more reliable and required for Phase 3 texture binding.
   - What's unclear: Whether emdawnwebgpu handles auto layouts correctly.
   - Recommendation: Use explicit bind group layouts from the start. It's only a few extra lines and avoids compatibility issues. Phase 3 will need explicit layouts anyway.

## Sources

### Primary (HIGH confidence)
- [kainino0x/webgpu-cross-platform-demo main.cpp](https://github.com/kainino0x/webgpu-cross-platform-demo) - Current emdawnwebgpu API patterns (`ShaderSourceWGSL`, `CreateShaderModule`, pipeline creation)
- [Learn WebGPU for C++ - Uniforms](https://eliemichel.github.io/LearnWebGPU/basic-3d-rendering/shader-uniforms/a-first-uniform.html) - Uniform buffer creation, bind groups, per-frame updates
- [Learn WebGPU for C++ - Hello Triangle](https://eliemichel.github.io/LearnWebGPU/basic-3d-rendering/hello-triangle.html) - Render pipeline descriptor setup
- [Learn WebGPU for C++ - Resizing](https://eliemichel.github.io/LearnWebGPU/basic-3d-rendering/some-interaction/resizing-window.html) - Surface reconfiguration on resize
- [Emscripten Embind docs](https://emscripten.org/docs/porting/connecting_cpp_and_javascript/embind.html) - Class binding, memory management
- [Emscripten emscripten.h API](https://emscripten.org/docs/api_reference/emscripten.h.html) - `emscripten_set_main_loop`, `emscripten_get_now`
- [WebGPU Fundamentals - Resizing Canvas](https://webgpufundamentals.org/webgpu/lessons/webgpu-resizing-the-canvas.html) - ResizeObserver pattern
- [WebGPU Fundamentals - Large Triangle](https://webgpufundamentals.org/webgpu/lessons/webgpu-large-triangle-to-cover-clip-space.html) - Fullscreen triangle pattern
- Phase 1 codebase (`engine/src/main.cpp`, `engine/CMakeLists.txt`) - Existing patterns and API conventions

### Secondary (MEDIUM confidence)
- [munrocket WGSL noise algorithms gist](https://gist.github.com/munrocket/236ed5ba7e409b8bdf1ff6eca5dcdc39) - Simplex noise WGSL port
- [WebGPU Unleashed - Rendering to Textures](https://shi-yan.github.io/webgpuunleashed/2D_Techniques/rendering_to_textures.html) - Render-to-texture two-pass pattern
- [Book of Shaders - fBM](https://thebookofshaders.com/13/) - Fractional Brownian motion technique
- [iquilezles.org - fBM](https://iquilezles.org/articles/fbm/) - Authoritative fBM reference

### Tertiary (LOW confidence)
- None -- all findings verified against at least two sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Same stack as Phase 1, no new dependencies
- Architecture: HIGH - All patterns are standard WebGPU, verified from multiple authoritative sources
- Noise shader: HIGH - Simplex noise is well-established, WGSL ports exist and are verified
- API conventions: HIGH - Verified `ShaderSourceWGSL` from official emdawnwebgpu reference demo
- Pitfalls: HIGH - Based on Phase 1 lessons learned + standard WebGPU documentation
- Resize handling: HIGH - Standard ResizeObserver pattern, documented by WebGPU Fundamentals

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable domain, 30-day validity)

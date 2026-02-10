# Phase 3: GPU Texture Bridge - Research

**Researched:** 2026-02-10
**Domain:** WebGPU offscreen render-to-texture, C++/JS texture interop via emdawnwebgpu, React lifecycle integration with GPU resources, render synchronization
**Confidence:** MEDIUM-HIGH

## Summary

Phase 3 bridges the gap between the C++ background engine (which currently renders directly to the canvas surface) and future React glass components (which need to sample the background as a texture). The work has three pillars: (1) modifying the C++ engine to render noise to an offscreen GPUTexture instead of (or in addition to) the surface, (2) making that texture available for sampling in a second render pass that also draws to the surface, and (3) integrating GPU resource lifecycle management with React's mount/unmount/re-render cycle.

The critical architectural insight is: **keep all GPU rendering in C++**. The current codebase renders directly to the canvas surface via `emscripten_set_main_loop`. Phase 3 must change this to a two-pass pipeline: Pass 1 renders noise to an offscreen texture with `RenderAttachment | TextureBinding` usage, and Pass 2 blits that texture to the surface. This structure prepares for Phase 4, where the glass shader pass will sample the same offscreen texture at distorted UVs. Since the C++ engine already owns the device, surface, and render loop, adding more render passes in C++ is straightforward and avoids the complexity of extracting JS GPUTexture objects from emdawnwebgpu's internal object tables (`WebGPU.mgrTexture`), which is an unstable internal API.

The "zero-copy" requirement (BRIDGE-02) is naturally satisfied by the two-pass C++ architecture: both passes run on the same GPUDevice and the offscreen texture is created once (per resize) and bound as a sampled texture in the second pass -- no CPU readback or data copying occurs. React's role in Phase 3 is limited to lifecycle management: ensuring the engine is properly initialized on mount, cleaned up on unmount, and that resize events are propagated. The synchronization requirement (BRIDGE-04) is met by both passes executing sequentially within a single `emscripten_set_main_loop` callback, which maps to `requestAnimationFrame` when fps=0.

**Primary recommendation:** Implement all GPU rendering in C++ with a two-pass architecture (noise -> offscreen texture, blit -> surface). Expose the offscreen texture handle via Embind for future JS-side use if needed, but Phase 3 does not require JS to create any GPU pipelines. React manages lifecycle only.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Emscripten + emdawnwebgpu | 4.0.10+ | C++ WebGPU bindings | Already established in Phase 1-2 |
| webgpu.h / webgpu_cpp.h | Dawn latest | C++ WebGPU API | Standard header, used throughout engine |
| WGSL | WebGPU spec | Shader language | Only shader language for WebGPU |
| Embind | Emscripten built-in | C++/JS interop | Already in use, type-safe |
| React 19 | 19.x | UI framework / lifecycle management | Project requirement |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| emscripten::val | Emscripten built-in | Access JS objects from C++ | If JS-side texture access is needed later |
| EM_ASM / EM_JS | Emscripten built-in | Inline JS from C++ | For optional texture handle export to JS |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| All-C++ rendering | JS creates own render pipelines sampling C++ texture | Requires unstable `WebGPU.mgrTexture.get()` internal API to extract JS GPUTexture from C++ handle; adds complexity with no benefit since glass shaders will also be WGSL in C++ |
| Two-pass blit | Render directly to surface + separate offscreen pass | Would need to render the noise twice -- once to offscreen texture for glass sampling, once to surface for display. Wasteful. |
| emscripten_set_main_loop | JS requestAnimationFrame calling into C++ | Unnecessary complexity; emscripten_set_main_loop with fps=0 already uses requestAnimationFrame internally |
| Manual texture export via WebGPU.mgrTexture | Keep texture in C++ only | mgrTexture is unstable internal API; keeping rendering in C++ avoids needing it entirely |

**No additional npm packages needed** -- this phase is entirely C++ engine modifications with React lifecycle updates.

## Architecture Patterns

### Recommended Project Structure
```
engine/
  src/
    main.cpp                  # Entry point + render loop (MODIFIED: two-pass render)
    background_engine.h       # BackgroundEngine class (MODIFIED: offscreen texture + blit)
    background_engine.cpp     # Implementation (MODIFIED: two-pass pipeline)
    shaders/
      noise.wgsl.h            # Existing noise shader (unchanged)
      blit.wgsl.h             # NEW: fullscreen blit shader (sample texture -> surface)
src/
  App.tsx                     # MODIFIED: enhanced lifecycle management
  wasm/
    loader.ts                 # MODIFIED: expose more engine methods
  hooks/
    useGPUEngine.ts           # NEW: React hook for engine lifecycle
```

### Pattern 1: Two-Pass Render Architecture (All in C++)
**What:** The C++ engine executes two render passes per frame within a single command encoder submission. Pass 1 renders noise to an offscreen texture. Pass 2 blits that texture to the surface.
**When to use:** Always -- this is the core Phase 3 architecture.
**Confidence:** HIGH -- standard multi-pass WebGPU pattern, verified from official examples and webgpu-native-examples.

**C++ Architecture (per frame):**
```cpp
// Source: Synthesized from samdauwe/webgpu-native-examples offscreen_rendering.c
// + shi-yan.github.io/webgpuunleashed rendering_to_textures

void BackgroundEngine::render() {
    // Update uniforms
    Uniforms uniforms{currentTime, 0.0f, (float)width, (float)height};
    device.GetQueue().WriteBuffer(uniformBuffer, 0, &uniforms, sizeof(Uniforms));

    wgpu::CommandEncoder encoder = device.CreateCommandEncoder();

    // === PASS 1: Render noise to offscreen texture ===
    {
        wgpu::RenderPassColorAttachment attachment{};
        attachment.view = offscreenTextureView;  // Offscreen target
        attachment.loadOp = wgpu::LoadOp::Clear;
        attachment.storeOp = wgpu::StoreOp::Store;
        attachment.clearValue = {0.0f, 0.0f, 0.0f, 1.0f};

        wgpu::RenderPassDescriptor passDesc{};
        passDesc.colorAttachmentCount = 1;
        passDesc.colorAttachments = &attachment;

        wgpu::RenderPassEncoder pass = encoder.BeginRenderPass(&passDesc);
        pass.SetPipeline(noisePipeline);
        pass.SetBindGroup(0, noiseBindGroup);
        pass.Draw(3);
        pass.End();
    }

    // === PASS 2: Blit offscreen texture to surface ===
    {
        wgpu::SurfaceTexture surfaceTexture;
        surface.GetCurrentTexture(&surfaceTexture);

        wgpu::RenderPassColorAttachment attachment{};
        attachment.view = surfaceTexture.texture.CreateView();
        attachment.loadOp = wgpu::LoadOp::Clear;
        attachment.storeOp = wgpu::StoreOp::Store;
        attachment.clearValue = {0.0f, 0.0f, 0.0f, 1.0f};

        wgpu::RenderPassDescriptor passDesc{};
        passDesc.colorAttachmentCount = 1;
        passDesc.colorAttachments = &attachment;

        wgpu::RenderPassEncoder pass = encoder.BeginRenderPass(&passDesc);
        pass.SetPipeline(blitPipeline);
        pass.SetBindGroup(0, blitBindGroup);  // References offscreen texture + sampler
        pass.Draw(3);
        pass.End();
    }

    device.GetQueue().Submit(1, &encoder.Finish());
}
```

### Pattern 2: Offscreen Texture with Dual Usage Flags
**What:** Create a texture with `RenderAttachment | TextureBinding` usage so it can be rendered to in one pass and sampled from in another.
**When to use:** Any render-to-texture-then-sample pattern.
**Confidence:** HIGH -- standard WebGPU pattern, verified from W3C spec, webgpufundamentals.org, and webgpu-native-examples.

```cpp
// Source: samdauwe/webgpu-native-examples offscreen_rendering.c
// + shi-yan.github.io/webgpuunleashed rendering_to_textures
void BackgroundEngine::createOffscreenTexture() {
    // Destroy old texture if it exists (resize case)
    if (offscreenTexture) {
        offscreenTexture.Destroy();
    }

    wgpu::TextureDescriptor texDesc{};
    texDesc.label = "Background offscreen texture";
    texDesc.size = {width, height, 1};
    texDesc.format = surfaceFormat;  // Match surface format
    texDesc.usage = wgpu::TextureUsage::RenderAttachment |
                    wgpu::TextureUsage::TextureBinding;
    texDesc.dimension = wgpu::TextureDimension::e2D;
    texDesc.mipLevelCount = 1;
    texDesc.sampleCount = 1;

    offscreenTexture = device.CreateTexture(&texDesc);
    offscreenTextureView = offscreenTexture.CreateView();

    // Recreate blit bind group (references the new texture view)
    createBlitBindGroup();
}
```

### Pattern 3: Blit Shader (Sample Texture to Surface)
**What:** A minimal fullscreen triangle shader that samples a texture and writes it to the render target. This is the "pass-through" that displays the offscreen texture on the canvas.
**When to use:** Second pass of the two-pass pipeline.
**Confidence:** HIGH -- trivial WGSL pattern.

```wgsl
// blit.wgsl.h
// Fullscreen blit: sample a texture and output to render target

@group(0) @binding(0) var texSampler: sampler;
@group(0) @binding(1) var texSource: texture_2d<f32>;

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
    // Flip Y for correct orientation (clip space Y is up, texture V is down)
    output.uv = vec2f(output.position.x * 0.5 + 0.5, 1.0 - (output.position.y * 0.5 + 0.5));
    return output;
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
    return textureSample(texSource, texSampler, uv);
}
```

### Pattern 4: Bind Group Layout for Texture Sampling
**What:** Explicit bind group layout with a sampler + texture_2d for the blit pass. Must be explicit (not auto) to allow reuse by future glass shader pipelines.
**When to use:** Any pipeline that samples a texture.
**Confidence:** HIGH -- verified from Toji.dev bind group best practices + MDN createBindGroupLayout docs.

```cpp
// Source: Toji.dev/webgpu-best-practices/bind-groups + MDN GPUDevice.createBindGroupLayout
void BackgroundEngine::createBlitPipeline() {
    // Bind group layout: sampler at 0, texture at 1
    wgpu::BindGroupLayoutEntry entries[2]{};

    // Sampler
    entries[0].binding = 0;
    entries[0].visibility = wgpu::ShaderStage::Fragment;
    entries[0].sampler.type = wgpu::SamplerBindingType::Filtering;

    // Texture
    entries[1].binding = 1;
    entries[1].visibility = wgpu::ShaderStage::Fragment;
    entries[1].texture.sampleType = wgpu::TextureSampleType::Float;
    entries[1].texture.viewDimension = wgpu::TextureViewDimension::e2D;

    wgpu::BindGroupLayoutDescriptor bglDesc{};
    bglDesc.entryCount = 2;
    bglDesc.entries = entries;
    blitBindGroupLayout = device.CreateBindGroupLayout(&bglDesc);

    // Pipeline layout
    wgpu::PipelineLayoutDescriptor plDesc{};
    plDesc.bindGroupLayoutCount = 1;
    plDesc.bindGroupLayouts = &blitBindGroupLayout;
    wgpu::PipelineLayout pipelineLayout = device.CreatePipelineLayout(&plDesc);

    // ... shader module, color target, pipeline descriptor ...
}
```

### Pattern 5: React Lifecycle Hook for GPU Engine
**What:** A custom React hook that manages the WASM engine lifecycle, coordinating initialization, resize handling, and cleanup.
**When to use:** Phase 3 App.tsx refactor.
**Confidence:** MEDIUM-HIGH -- standard React patterns applied to GPU resources.

```typescript
// Source: Standard React patterns + WebGPU device loss best practices (toji.dev)
function useGPUEngine() {
    const [engine, setEngine] = useState<EngineModule | null>(null);
    const [status, setStatus] = useState<'loading' | 'running' | 'error'>('loading');
    const observerRef = useRef<ResizeObserver | null>(null);

    useEffect(() => {
        let cancelled = false;

        initEngine().then((module) => {
            if (cancelled) return;
            setEngine(module);
            setStatus('running');

            // Setup resize observer
            const canvas = document.getElementById('gpu-canvas') as HTMLCanvasElement;
            if (!canvas) return;

            const observer = new ResizeObserver((entries) => {
                const eng = module.getEngine();
                if (!eng) return;
                for (const entry of entries) {
                    // ... DPR-aware resize logic (existing pattern) ...
                    eng.resize(w, h);
                }
            });
            try {
                observer.observe(canvas, { box: 'device-pixel-content-box' as ResizeObserverBoxOptions });
            } catch {
                observer.observe(canvas, { box: 'content-box' });
            }
            observerRef.current = observer;
        }).catch((err) => {
            if (cancelled) return;
            setStatus('error');
        });

        return () => {
            cancelled = true;
            observerRef.current?.disconnect();
            // NOTE: Engine cleanup is handled by C++ global lifetime
            // The engine persists across React re-renders by design
        };
    }, []);

    return { engine, status };
}
```

### Pattern 6: Texture Handle Export (For Future Use)
**What:** Expose the offscreen texture's internal handle via Embind so JS could access it if needed in future phases. Uses EM_ASM to extract the JS GPUTexture from emdawnwebgpu's internal object table.
**When to use:** Only if a future phase requires JS-side texture access. Not needed for Phase 3.
**Confidence:** LOW -- relies on unstable internal API (`WebGPU.mgrTexture.get()`).

```cpp
// OPTIONAL: Only implement if JS-side access is actually needed
// Source: emscripten-core/emscripten#13888 discussion
#include <emscripten/html5.h>

EM_JS(void, exportTextureToJS, (int textureId), {
    // WebGPU.mgrTexture is emdawnwebgpu's internal object table
    // WARNING: This is NOT a stable public API
    if (typeof WebGPU !== 'undefined' && WebGPU.mgrTexture) {
        Module.backgroundTexture = WebGPU.mgrTexture.get(textureId);
    }
});

// Call from C++ after creating the offscreen texture:
// The WGPUTexture handle IS the internal ID in emdawnwebgpu
// exportTextureToJS(reinterpret_cast<uintptr_t>(offscreenTexture.Get()));
```

### Anti-Patterns to Avoid
- **Do NOT have JS create separate render pipelines to sample the C++ texture:** This requires extracting the JS GPUTexture object via unstable internal APIs. Keep all rendering in C++.
- **Do NOT render the noise twice (once to offscreen, once to surface):** Use a two-pass blit architecture instead.
- **Do NOT create the offscreen texture every frame:** Create it once at init and on resize only. Per-frame allocation causes memory leaks.
- **Do NOT forget to recreate the blit bind group on resize:** The bind group references the texture view, which becomes invalid when the texture is recreated.
- **Do NOT use `wgpu::TextureUsage::CopySrc` unless readback is needed:** For GPU-only sampling, `TextureBinding` is sufficient and more efficient.
- **Do NOT rely on JS garbage collection for GPU textures:** Call `.Destroy()` explicitly on old textures during resize, or rely on C++ RAII (reassigning the `wgpu::Texture` member triggers release).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Texture sampling shader | Custom fragment shader with manual UV math | Standard blit shader with `textureSample()` | Trivial, correct, handles filtering |
| Multi-pass synchronization | Manual fence/barrier system | Sequential render passes in single command encoder | WebGPU guarantees pass ordering within an encoder |
| React-GPU lifecycle | Manual ref counting of GPU objects | useEffect cleanup + C++ RAII | React handles mount/unmount; C++ handles GPU object lifetime |
| Frame synchronization | Custom vsync/timing | `emscripten_set_main_loop(fn, 0, false)` | Automatically uses requestAnimationFrame; browser handles vsync |
| Texture format matching | Hardcoded BGRA8Unorm | `surface.GetCapabilities()` format | Platform-dependent; already queried in Phase 1-2 code |

**Key insight:** The "bridge" in Phase 3 is primarily architectural (restructuring the render pipeline), not interop (passing objects between languages). By keeping all rendering in C++, we avoid the most complex and fragile part of WASM/JS WebGPU interop.

## Common Pitfalls

### Pitfall 1: Bind Group Invalidation on Texture Resize
**What goes wrong:** After resize, the blit pass uses a bind group that references a destroyed texture view, causing a validation error.
**Why it happens:** When the offscreen texture is recreated at new dimensions, the old texture view (and any bind groups referencing it) becomes invalid. But the code only recreates the texture, not the bind group.
**How to avoid:** Always recreate the blit bind group immediately after recreating the offscreen texture. Bundle both operations in a single `createOffscreenTexture()` method.
**Warning signs:** "Texture view is not valid" or "Destroyed texture used in bind group" validation errors after resizing.

### Pitfall 2: Texture Format Mismatch Between Passes
**What goes wrong:** The noise shader renders to the offscreen texture in one format, but the blit pipeline expects a different format.
**Why it happens:** The offscreen texture format must match both the noise pipeline's color target format AND the format expected by the blit shader's texture sampling declaration.
**How to avoid:** Use the same `surfaceFormat` (from `surface.GetCapabilities()`) for both the offscreen texture and the noise pipeline's color target. The blit pipeline's color target uses the surface format naturally.
**Warning signs:** "Color target format mismatch" validation errors, garbled output.

### Pitfall 3: UV Coordinate Y-Flip in Blit Shader
**What goes wrong:** The blitted image appears upside down on the canvas.
**Why it happens:** WebGPU's clip space has Y pointing up, but texture coordinates have V pointing down. If the blit shader computes UVs from clip space without flipping Y, the image is inverted.
**How to avoid:** In the blit vertex shader, compute UV as `(clipX * 0.5 + 0.5, 1.0 - (clipY * 0.5 + 0.5))` to flip the Y axis. Alternatively, flip in the fragment shader.
**Warning signs:** Background appears upside down after Phase 3 changes.

### Pitfall 4: Missing Sampler in Blit Bind Group
**What goes wrong:** The blit shader uses `textureSample()` but no sampler is provided in the bind group.
**Why it happens:** `textureSample()` requires a sampler object. `textureLoad()` does not, but gives nearest-neighbor only.
**How to avoid:** Create a `wgpu::Sampler` with linear filtering and include it in the blit bind group at binding 0. The sampler can be created once at init and reused.
**Warning signs:** "Missing sampler binding" validation error.

### Pitfall 5: Engine Not Cleaning Up on React Unmount
**What goes wrong:** Navigating away and back (or hot-reloading) leaves orphaned GPU resources, eventually exhausting GPU memory.
**Why it happens:** The C++ engine uses a global pointer (`g_engine = new BackgroundEngine()`). React unmount does not trigger C++ destructor. On remount, a new engine is created but the old one is leaked.
**How to avoid:** Two approaches: (A) Make the engine a true singleton -- on re-init, destroy the old engine before creating a new one. (B) Expose a `destroyEngine()` Embind function that JS calls in the useEffect cleanup. Approach A is simpler since the engine already uses a global pointer pattern.
**Warning signs:** Growing GPU memory in DevTools Memory panel after React hot-reload. Multiple "BackgroundEngine initialized" console logs.

### Pitfall 6: Render Pass Ordering Assumption
**What goes wrong:** The noise pass and blit pass produce a blank or stale frame because the blit samples the texture before the noise pass has written to it.
**Why it happens:** Misunderstanding of WebGPU pass ordering. Within a single command encoder, passes execute sequentially (implicit barrier). But if passes are submitted in separate command encoders, ordering is NOT guaranteed.
**How to avoid:** Always encode both passes (noise + blit) in the same command encoder, and submit once with `queue.Submit()`. Never split them into separate submissions.
**Warning signs:** Flickering, blank frames, or one-frame-behind artifacts.

## Code Examples

### Complete Offscreen Texture + Blit Bind Group Creation
```cpp
// Source: Synthesized from samdauwe/webgpu-native-examples + LearnWebGPU texturing docs
void BackgroundEngine::createOffscreenTexture() {
    // Destroy old resources
    if (offscreenTexture) {
        offscreenTexture.Destroy();
    }

    // Create offscreen texture
    wgpu::TextureDescriptor texDesc{};
    texDesc.label = "Background offscreen";
    texDesc.size = {width, height, 1};
    texDesc.format = surfaceFormat;
    texDesc.usage = wgpu::TextureUsage::RenderAttachment |
                    wgpu::TextureUsage::TextureBinding;
    texDesc.dimension = wgpu::TextureDimension::e2D;
    texDesc.mipLevelCount = 1;
    texDesc.sampleCount = 1;
    offscreenTexture = device.CreateTexture(&texDesc);
    offscreenTextureView = offscreenTexture.CreateView();

    // Recreate blit bind group with new texture view
    createBlitBindGroup();
}

void BackgroundEngine::createBlitBindGroup() {
    wgpu::BindGroupEntry entries[2]{};

    // Sampler at binding 0
    entries[0].binding = 0;
    entries[0].sampler = blitSampler;  // Created once at init

    // Texture view at binding 1
    entries[1].binding = 1;
    entries[1].textureView = offscreenTextureView;

    wgpu::BindGroupDescriptor bgDesc{};
    bgDesc.label = "Blit bind group";
    bgDesc.layout = blitBindGroupLayout;
    bgDesc.entryCount = 2;
    bgDesc.entries = entries;
    blitBindGroup = device.CreateBindGroup(&bgDesc);
}
```

### Sampler Creation (Linear Filtering)
```cpp
// Source: LearnWebGPU a-first-texture + MDN GPUDevice.createSampler
void BackgroundEngine::createBlitSampler() {
    wgpu::SamplerDescriptor samplerDesc{};
    samplerDesc.label = "Blit sampler";
    samplerDesc.addressModeU = wgpu::AddressMode::ClampToEdge;
    samplerDesc.addressModeV = wgpu::AddressMode::ClampToEdge;
    samplerDesc.magFilter = wgpu::FilterMode::Linear;
    samplerDesc.minFilter = wgpu::FilterMode::Linear;
    blitSampler = device.CreateSampler(&samplerDesc);
}
```

### Updated Resize Handler
```cpp
void BackgroundEngine::resize(uint32_t newWidth, uint32_t newHeight) {
    if (newWidth == 0 || newHeight == 0) return;
    width = newWidth;
    height = newHeight;

    // Reconfigure surface
    wgpu::SurfaceConfiguration config{};
    config.device = device;
    config.format = surfaceFormat;
    config.width = width;
    config.height = height;
    surface.Configure(&config);

    // Recreate offscreen texture at new size (also recreates blit bind group)
    createOffscreenTexture();
}
```

### Updated Embind Bindings
```cpp
// Source: Emscripten Embind docs
BackgroundEngine* getEngine() { return g_engine; }

void destroyEngine() {
    if (g_engine) {
        delete g_engine;
        g_engine = nullptr;
    }
}

EMSCRIPTEN_BINDINGS(background_engine) {
    emscripten::function("getEngine", &getEngine, emscripten::allow_raw_pointers());
    emscripten::function("destroyEngine", &destroyEngine);
    emscripten::class_<BackgroundEngine>("BackgroundEngine")
        .function("resize", &BackgroundEngine::resize);
}
```

### WebGPU Error Scoping for Verification
```typescript
// Source: Toji.dev/webgpu-best-practices/error-handling + MDN pushErrorScope
// Use in development to verify no validation errors during lifecycle transitions

// This would require JS-side device access. For Phase 3, validation
// errors from C++ render passes surface as console errors automatically
// via the uncaptured error callback set in OnDeviceAcquired.
// The existing error callback in main.cpp is sufficient:
//
// devDesc.SetUncapturedErrorCallback(
//     [](const wgpu::Device&, wgpu::ErrorType type, wgpu::StringView msg) {
//         std::cerr << "Device error: " << static_cast<int>(type)
//                   << " - " << std::string_view(msg.data, msg.length) << "\n";
//     });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JS creates render pipelines to sample C++ textures | Keep all rendering in C++ | emdawnwebgpu object table APIs are unstable | Eliminates need for JS/C++ texture interop |
| `WebGPU.mgrTexture.get(id)` for JS texture access | C++ manages full pipeline | Ongoing instability | Not needed when rendering stays in C++ |
| Single-pass surface rendering | Two-pass: offscreen + blit | Phase 3 requirement | Enables texture sampling in Phase 4 glass shaders |
| Manual texture lifecycle | C++ RAII + explicit Destroy() on resize | Standard WebGPU practice | Prevents leaks, simplifies lifecycle |

**Deprecated/outdated:**
- `emscripten_webgpu_get_device()`: Still deprecated. Not needed -- C++ owns the device.
- `WebGPU.mgrTexture.get(id)`: Internal API, unstable, not needed with all-C++ rendering.
- `preinitializedWebGPUDevice`: Being removed from Emscripten. Not relevant.

## Open Questions

1. **Engine Singleton vs Recreate on Remount**
   - What we know: The current engine uses a global pointer (`g_engine`). React hot-reload calls `initEngine()` again, which re-invokes the Emscripten module factory.
   - What's unclear: Whether the Emscripten module factory creates a fresh WASM instance (with new globals) or reuses the existing one. If it creates fresh, the old `g_engine` is automatically cleaned up. If it reuses, we leak.
   - Recommendation: Test this behavior during implementation. If the module factory creates a fresh instance (likely with `MODULARIZE=1`), no special cleanup is needed. If not, implement a `destroyEngine()` Embind function called in useEffect cleanup.

2. **Surface Format for Offscreen Texture**
   - What we know: The surface format (from `surface.GetCapabilities()`) is typically BGRA8Unorm. The offscreen texture should match.
   - What's unclear: Whether the offscreen texture MUST use the same format as the surface, or if it could use RGBA8Unorm (more standard for texture sampling).
   - Recommendation: Use the same surface format for simplicity. The blit shader samples it directly, so format conversion would be unnecessary overhead. BGRA8Unorm works fine with `textureSample()` -- the GPU handles the channel swizzle.

3. **Noise Shader UV Changes for Offscreen Rendering**
   - What we know: The noise shader currently computes UVs from `@builtin(position)` in the fullscreen triangle vertex shader. When rendering to an offscreen texture, the coordinate system should be the same since the texture has the same dimensions.
   - What's unclear: Whether any UV adjustment is needed when switching render target from surface to offscreen texture.
   - Recommendation: The UVs should work identically since both targets have the same dimensions and the vertex shader generates normalized coordinates. Test visually -- if the output looks the same after the switch, no changes needed.

4. **React Fast Refresh and Engine State**
   - What we know: Vite's React Fast Refresh preserves state across hot reloads for components, but the WASM module is loaded via dynamic import, not through React.
   - What's unclear: Whether a React Fast Refresh (code change in .tsx) triggers the useEffect cleanup and re-initialization, potentially causing a brief visual glitch.
   - Recommendation: Accept brief glitches during development hot reload. The production experience (no hot reload) is what matters. Document that full page reload gives cleanest dev experience.

## Sources

### Primary (HIGH confidence)
- [samdauwe/webgpu-native-examples offscreen_rendering.c](https://github.com/samdauwe/webgpu-native-examples/blob/master/src/examples/offscreen_rendering.c) -- C offscreen rendering with RENDER_ATTACHMENT | TEXTURE_BINDING pattern
- [WebGPU Unleashed - Rendering to Textures](https://shi-yan.github.io/webgpuunleashed/2D_Techniques/rendering_to_textures.html) -- Two-pass render-to-texture architecture
- [Toji.dev WebGPU Bind Group Best Practices](https://toji.dev/webgpu-best-practices/bind-groups.html) -- Explicit bind group layouts for cross-pipeline reuse
- [Toji.dev WebGPU Error Handling](https://toji.dev/webgpu-best-practices/error-handling.html) -- pushErrorScope/popErrorScope patterns, uncapturedError event
- [Toji.dev WebGPU Device Loss](https://toji.dev/webgpu-best-practices/device-loss.html) -- Device cleanup, recovery, device.lost promise
- [MDN GPUDevice.createBindGroupLayout](https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/createBindGroupLayout) -- Bind group layout entry spec for sampler + texture
- [LearnWebGPU - A First Texture](https://eliemichel.github.io/LearnWebGPU/basic-3d-rendering/texturing/a-first-texture.html) -- C++ texture creation, view, sampler, bind group patterns
- [Emscripten emscripten.h API](https://emscripten.org/docs/api_reference/emscripten.h.html) -- emscripten_set_main_loop with fps=0 uses requestAnimationFrame
- [Emscripten Embind docs](https://emscripten.org/docs/porting/connecting_cpp_and_javascript/embind.html) -- Class/function binding for C++/JS interop
- Phase 1-2 codebase (`engine/src/main.cpp`, `background_engine.h/cpp`, `src/App.tsx`) -- Existing patterns and architecture

### Secondary (MEDIUM confidence)
- [emscripten-core/emscripten#13888 Mixed JS/WASM WebGPU](https://github.com/emscripten-core/emscripten/issues/13888) -- WebGPU.mgrTexture internal API, JsValStore mechanism, mixed usage patterns
- [WebGPU Fundamentals - Textures](https://webgpufundamentals.org/webgpu/lessons/webgpu-textures.html) -- Texture creation, sampling, bind group patterns
- [Emscripten val.h](https://emscripten.org/docs/api_reference/val.h.html) -- emscripten::val for JS object interop, EM_VAL handles
- [W3C WebGPU Spec](https://www.w3.org/TR/webgpu/) -- Texture usage synchronization rules between passes

### Tertiary (LOW confidence)
- WebGPU.mgrTexture.get(id) for extracting JS GPUTexture -- Internal API, not documented as public, may change between emdawnwebgpu versions. Not needed for Phase 3 but documented for future reference.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Same stack as Phase 1-2, no new dependencies needed
- Architecture (two-pass): HIGH -- Standard multi-pass WebGPU pattern, verified from multiple authoritative sources
- Blit shader: HIGH -- Trivial fullscreen sample shader, standard pattern
- React lifecycle: MEDIUM-HIGH -- Standard useEffect cleanup patterns, but GPU-specific lifecycle integration has limited community examples
- Texture interop (if needed): LOW -- WebGPU.mgrTexture is unstable internal API; avoided by keeping rendering in C++
- Pitfalls: HIGH -- Based on Phase 1-2 lessons + standard WebGPU multi-pass documentation

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable domain, 30-day validity; emdawnwebgpu internals may change but the C++ webgpu.h API is stable)

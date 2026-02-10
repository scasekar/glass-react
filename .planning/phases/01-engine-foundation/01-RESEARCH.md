# Phase 1: Engine Foundation - Research

**Researched:** 2026-02-10
**Domain:** Emscripten C++ to WASM compilation with WebGPU via emdawnwebgpu, Vite integration, GPU device sharing
**Confidence:** MEDIUM-HIGH

## Summary

Phase 1 establishes the C++ to WASM build pipeline and proves that a C++ engine can render to a GPU texture that JavaScript can consume. The core technology stack is Emscripten 4.0.10+ with emdawnwebgpu (Dawn's official WebGPU bindings), CMake via emcmake, and Vite 6+ for the dev server.

The most important finding from this research is an architectural clarification: **emdawnwebgpu is a binding layer that maps C++ webgpu.h calls to the browser's JavaScript WebGPU API**. When C++ creates a WGPUDevice via the standard `wgpu::CreateInstance()` / `instance.RequestAdapter()` / `adapter.RequestDevice()` path, it is internally creating a JavaScript GPUDevice. The internal object table (`WebGPU.mgrDevice`, `WebGPU.mgrTexture`, etc.) maps between C++ opaque pointers and actual JS WebGPU objects. This means **C++ and JS already share the same device implicitly** -- no special import/export mechanism is needed for the standard "all rendering in C++" case. However, for the hybrid case where JS needs to independently use the same device (e.g., to run its own render passes sampling C++ textures), additional interop is needed.

The prior architectural decision "JS creates device, passes to C++ (Approach A)" conflicts with the current emdawnwebgpu standard pattern. The deprecated `emscripten_webgpu_get_device()` and the `preinitializedWebGPUDevice` mechanism are being removed. **The recommended approach for this project is: C++ creates the device via standard webgpu.h API (with ASYNCIFY), C++ renders to a texture, and JS accesses the underlying JS objects through emdawnwebgpu's internal object tables or EM_ASM interop.** This is detailed in the Architecture Patterns section below.

**Primary recommendation:** Let C++ own device creation and the render-to-texture pipeline. Expose the background texture handle to JS via Embind or EM_ASM so JS can create its own render pass sampling that texture. ASYNCIFY is required for device initialization but can be limited with ASYNCIFY_ONLY.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Emscripten | 4.0.10+ (latest stable) | C++ to WASM compiler | Only maintained C++ to WASM toolchain with WebGPU support |
| emdawnwebgpu | v20251002.162335+ | WebGPU bindings for Emscripten | Dawn's official bindings, replaces unmaintained -sUSE_WEBGPU |
| CMake | 3.22+ | C++ build system | Standard for cross-platform C++ builds, emcmake integration |
| Vite | 6+ | Dev server and bundler | Fast ESM bundler with WASM support via plugins |
| React | 19+ | UI framework | Project requirement, industry standard |
| TypeScript | 5.x | Type-safe JavaScript | Project requirement |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vite-plugin-wasm | 3.5.0 | WebAssembly ESM integration for Vite | Loading .wasm modules in dev server |
| vite-plugin-top-level-await | latest | Top-level await support | Required unless targeting esnext only |
| vite-plugin-live-reload | latest | File-change triggered reload | Watch .wasm output for C++ source changes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| emdawnwebgpu | -sUSE_WEBGPU | Deprecated, unmaintained, being removed from Emscripten |
| emdawnwebgpu | wasm_webgpu (juj) | Lower-level C bindings, less official, targets JS API directly |
| ASYNCIFY | JSPI (-sASYNCIFY=2) | Smaller binary, but experimental, requires browser flags, not production-ready |
| ASYNCIFY | Callback restructuring | No binary overhead, but requires rewriting init flow to be async/event-driven |
| Vite | Webpack | Slower, more complex WASM config |
| Embind | extern "C" | Less type-safe, no automatic JS binding generation |

**Installation:**
```bash
# Emscripten SDK (if not already installed)
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk && ./emsdk install latest && ./emsdk activate latest
source ./emsdk_env.sh

# Node dependencies
npm install vite vite-plugin-wasm vite-plugin-top-level-await vite-plugin-live-reload react react-dom
npm install -D @types/react @types/react-dom typescript
```

## Architecture Patterns

### Recommended Project Structure
```
glass-react/
├── engine/                    # C++ WebGPU engine
│   ├── CMakeLists.txt         # emcmake build configuration
│   ├── src/
│   │   ├── main.cpp           # Entry point, device init, render loop
│   │   ├── engine.h           # BackgroundEngine class declaration
│   │   └── engine.cpp         # BackgroundEngine implementation
│   └── build-web/             # emcmake output directory
│       ├── engine.wasm        # Compiled WASM binary
│       └── engine.js          # Emscripten JS glue code
├── src/                       # React/TypeScript frontend
│   ├── App.tsx                # React app shell
│   ├── main.tsx               # React entry point
│   ├── wasm/
│   │   └── loader.ts          # WASM module loader
│   └── components/
│       └── Canvas.tsx          # Canvas element wrapper
├── public/
│   └── index.html             # HTML shell with <canvas>
├── vite.config.ts             # Vite configuration
├── tsconfig.json              # TypeScript configuration
└── package.json               # Node dependencies and scripts
```

### Pattern 1: C++ Device Initialization with ASYNCIFY
**What:** C++ creates the WebGPU instance, requests adapter and device using the standard webgpu.h C++ API. ASYNCIFY enables these async browser calls to appear synchronous in C++.
**When to use:** Always -- this is the standard emdawnwebgpu pattern.
**Why not JS-to-C++ device passing:** The old `emscripten_webgpu_get_device()` / `preinitializedWebGPUDevice` mechanism is deprecated and being removed. The `emscripten_webgpu_import_device()` referenced in earlier research does not exist as a stable API in emdawnwebgpu.
**Confidence:** HIGH -- verified across Chrome DevRel examples, kainino0x cross-platform demo, and beaufortfrancois cross-platform app.

**Example (verified from Chrome DevRel "Build an app with WebGPU"):**
```cpp
// Source: https://developer.chrome.com/docs/web-platform/webgpu/build-app
#include <webgpu/webgpu_cpp.h>
#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#endif

wgpu::Instance instance;
wgpu::Adapter adapter;
wgpu::Device device;

void Init() {
    // Note: instance descriptor must be nullptr/default for Emscripten
    instance = wgpu::CreateInstance();

    // RequestAdapter -- requires ASYNCIFY under the hood
    wgpu::Future f1 = instance.RequestAdapter(
        nullptr, wgpu::CallbackMode::WaitAnyOnly,
        [](wgpu::RequestAdapterStatus status,
           wgpu::Adapter a, wgpu::StringView message) {
            adapter = std::move(a);
        });
    instance.WaitAny(f1, UINT64_MAX);

    // RequestDevice -- requires ASYNCIFY under the hood
    wgpu::DeviceDescriptor desc{};
    desc.SetUncapturedErrorCallback(
        [](const wgpu::Device&, wgpu::ErrorType type,
           wgpu::StringView msg) {
            std::cout << "Error: " << type << " - " << msg << "\n";
        });

    wgpu::Future f2 = adapter.RequestDevice(
        &desc, wgpu::CallbackMode::WaitAnyOnly,
        [](wgpu::RequestDeviceStatus status, wgpu::Device d,
           wgpu::StringView message) {
            device = std::move(d);
        });
    instance.WaitAny(f2, UINT64_MAX);
}
```

### Pattern 2: Surface Configuration via Canvas Selector
**What:** C++ creates a surface from an HTML canvas element using a CSS selector string. The Emscripten GLFW integration or direct EmscriptenSurfaceSourceCanvasHTMLSelector can reference the DOM canvas.
**When to use:** For the proof-of-concept where C++ renders directly to a visible canvas.
**Confidence:** HIGH -- standard pattern in all emdawnwebgpu examples.

**Example:**
```cpp
// Direct canvas reference (without GLFW)
wgpu::EmscriptenSurfaceSourceCanvasHTMLSelector canvasDesc{};
canvasDesc.selector = "#gpu-canvas";

wgpu::SurfaceDescriptor surfaceDesc{
    .nextInChain = &canvasDesc
};
wgpu::Surface surface = instance.CreateSurface(&surfaceDesc);

// Configure the surface
wgpu::SurfaceCapabilities capabilities;
surface.GetCapabilities(adapter, &capabilities);

wgpu::SurfaceConfiguration config{
    .device = device,
    .format = capabilities.formats[0],
    .width = 512,
    .height = 512
};
surface.Configure(&config);
```

### Pattern 3: Render Loop with emscripten_set_main_loop
**What:** Replace the desktop while-loop with Emscripten's callback-based render loop. This does NOT require ASYNCIFY (ASYNCIFY is only for init).
**When to use:** Always for the per-frame render callback.
**Confidence:** HIGH -- documented in official Emscripten API reference.

**Example:**
```cpp
void Render() {
    wgpu::SurfaceTexture surfaceTexture;
    surface.GetCurrentTexture(&surfaceTexture);

    wgpu::RenderPassColorAttachment attachment{
        .view = surfaceTexture.texture.CreateView(),
        .loadOp = wgpu::LoadOp::Clear,
        .storeOp = wgpu::StoreOp::Store,
        .clearValue = {0.2f, 0.4f, 0.8f, 1.0f}  // solid color proof
    };

    wgpu::RenderPassDescriptor renderpass{
        .colorAttachmentCount = 1,
        .colorAttachments = &attachment
    };

    wgpu::CommandEncoder encoder = device.CreateCommandEncoder();
    wgpu::RenderPassEncoder pass = encoder.BeginRenderPass(&renderpass);
    pass.End();
    device.GetQueue().Submit(1, &encoder.Finish());
}

int main() {
    Init();
    ConfigureSurface();

#ifdef __EMSCRIPTEN__
    emscripten_set_main_loop(Render, 0, false);
#else
    while (!shouldClose) { Render(); }
#endif
    return 0;
}
```

### Pattern 4: Exposing C++ Engine to JS via Embind
**What:** Use Emscripten's Embind system to expose C++ functions and classes to JavaScript with type-safe bindings.
**When to use:** For the BackgroundEngine API that JS/React needs to call (init, update, resize, getTexture).
**Confidence:** HIGH -- Embind is stable, well-documented.

**Example:**
```cpp
#include <emscripten/bind.h>
using namespace emscripten;

class BackgroundEngine {
public:
    void init() { /* device init + pipeline setup */ }
    void update(float dt) { /* advance simulation */ }
    void resize(uint32_t w, uint32_t h) { /* resize textures */ }
    // Returns an opaque handle that maps to a JS GPUTexture internally
    uintptr_t getTextureHandle() {
        return reinterpret_cast<uintptr_t>(backgroundTexture.Get());
    }
};

EMSCRIPTEN_BINDINGS(engine) {
    class_<BackgroundEngine>("BackgroundEngine")
        .constructor<>()
        .function("init", &BackgroundEngine::init)
        .function("update", &BackgroundEngine::update)
        .function("resize", &BackgroundEngine::resize)
        .function("getTextureHandle", &BackgroundEngine::getTextureHandle);
}
```

### Pattern 5: JS Accessing C++ Created Textures (Device Sharing Bridge)
**What:** emdawnwebgpu maintains internal object tables mapping C++ WGPUTexture pointers to JS GPUTexture objects. JS can access these through the Module's WebGPU manager.
**When to use:** When JS needs to sample a texture that C++ rendered to (the core Phase 1 proof).
**Confidence:** MEDIUM -- based on emdawnwebgpu internal implementation, not a public stable API. The `WebGPU.mgrTexture.get(id)` pattern is used internally but not documented as a public interface.

**Example (approach for proof-of-concept):**
```javascript
// Option A: Use EM_ASM from C++ to push texture to JS
// In C++:
// EM_ASM({
//     Module.backgroundTexture = WebGPU.mgrTexture.get($0);
// }, textureId);

// Option B: C++ renders to canvas surface directly (no JS texture access needed)
// For Phase 1 proof, C++ can render a solid color to the canvas surface.
// JS verifies the color by reading the canvas pixels.

// Option C: C++ creates texture, JS reads via readback buffer (proof only)
// C++ renders to offscreen texture, copies to buffer, JS reads buffer.
```

**Important:** For Phase 1, the simplest proof is C++ rendering a solid color directly to the canvas surface. The texture-sharing bridge (C++ renders to offscreen texture, JS samples it) can be deferred to Phase 3 when it's actually needed.

### Pattern 6: Vite + Emscripten WASM Hot-Reload
**What:** Vite does not natively hot-reload WASM modules. A custom approach is needed: watch C++ source files, trigger emcmake rebuild, then trigger Vite page reload.
**When to use:** Development workflow for iterating on C++ code.
**Confidence:** MEDIUM -- assembled from multiple sources, no single authoritative pattern exists.

**Approach:**
1. npm script watches C++ source files (via chokidar or nodemon)
2. On change, runs `cmake --build build-web`
3. vite-plugin-live-reload watches the `engine/build-web/` output directory
4. When .wasm/.js files change, Vite triggers a full page reload

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import liveReload from 'vite-plugin-live-reload';

export default defineConfig({
    plugins: [
        react(),
        wasm(),
        topLevelAwait(),
        liveReload(['engine/build-web/**/*.{js,wasm}']),
    ],
    optimizeDeps: {
        exclude: ['engine']  // Don't pre-bundle WASM output
    },
    server: {
        watch: {
            // Include C++ output in watch
        }
    }
});
```

```json
// package.json scripts
{
    "scripts": {
        "build:wasm": "cd engine && emcmake cmake -B build-web && cmake --build build-web",
        "watch:wasm": "nodemon --watch engine/src -e cpp,h --exec 'npm run build:wasm'",
        "dev": "concurrently \"npm run watch:wasm\" \"vite\"",
        "dev:vite": "vite"
    }
}
```

### Anti-Patterns to Avoid

- **Do NOT use -sUSE_WEBGPU:** Deprecated, unmaintained, will be removed. Use `--use-port=emdawnwebgpu` instead.
- **Do NOT use emscripten_webgpu_get_device():** Deprecated, only exists for legacy `preinitializedWebGPUDevice` which is being removed.
- **Do NOT use emscripten_webgpu_import_device():** Not a stable API in emdawnwebgpu. The standard pattern is C++ creating its own device via webgpu.h.
- **Do NOT create a desktop while-loop on web:** Use `emscripten_set_main_loop()` -- infinite loops block the browser event loop.
- **Do NOT skip ASYNCIFY for device init:** The `instance.WaitAny()` pattern requires ASYNCIFY to pause WASM execution during async JS calls.
- **Do NOT use raw extern "C" for JS bindings:** Use Embind for type-safe bindings, prevents signature mismatch crashes.
- **Do NOT load WASM via Vite's default handler:** Use vite-plugin-wasm for proper ESM integration; Emscripten's JS glue has specific loading requirements.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebGPU C++ bindings | Custom JS interop layer | emdawnwebgpu (--use-port=emdawnwebgpu) | Maintained by Dawn team, tracks WebGPU spec |
| C++/JS function binding | Manual EM_JS wrappers | Embind (emscripten/bind.h) | Type-safe, handles memory management, generates clean JS API |
| WASM module loading | Custom fetch + compile | Emscripten's generated .js glue file | Handles streaming instantiation, memory init, ASYNCIFY setup |
| Render loop timing | Custom RAF wrapper | emscripten_set_main_loop() | Properly integrates with browser event loop, handles tab visibility |
| CMake Emscripten toolchain | Custom Makefile | emcmake cmake | Sets correct compilers, flags, and system roots automatically |
| WASM file watching | Custom fs.watch script | nodemon or chokidar CLI | Battle-tested file watchers with debouncing |

**Key insight:** The entire WebGPU binding layer is handled by emdawnwebgpu. C++ code writes standard webgpu.h calls, and emdawnwebgpu translates them to JS WebGPU API calls. Do not try to build a custom bridge.

## Common Pitfalls

### Pitfall 1: ASYNCIFY Binary Size Explosion
**What goes wrong:** Enabling -sASYNCIFY=1 instruments the entire call graph, increasing WASM binary size by ~80%.
**Why it happens:** ASYNCIFY transforms all function call chains that might lead to an async operation, adding pause/resume wrappers.
**How to avoid:**
- Use `-sASYNCIFY_ONLY='["list","of","functions"]'` to limit instrumentation
- Use `-sASYNCIFY_ADVISE` (with -O0) to see which functions get instrumented and why
- The functions that actually need ASYNCIFY for WebGPU are: `wgpuInstanceRequestAdapter`, `wgpuAdapterRequestDevice`, `wgpuBufferMapAsync`, and `wgpuInstanceWaitAny`
- Compile with -O3 in production (unoptimized ASYNCIFY builds are significantly larger)
- Run `wasm-opt -O3` on the output binary for further size reduction
**Warning signs:** .wasm file > 5MB for a minimal app, slow initial page load

### Pitfall 2: "Uncaught (in promise) unwind" Error
**What goes wrong:** JavaScript console shows "Uncaught (in promise) unwind" errors during `wgpuInstanceWaitAny` calls, even though operations complete successfully.
**Why it happens:** Known interaction bug between ASYNCIFY's promise unwinding mechanism and emdawnwebgpu's Future-based API (emscripten-core/emscripten#22493, #24154).
**How to avoid:**
- This is a benign error -- operations still complete correctly
- Add a global unhandled rejection handler to suppress the specific "unwind" message during development
- Track the upstream issue for a proper fix
- Consider that first buffer/texture operations may trigger it, but subsequent ones won't
**Warning signs:** Console noise during init, may confuse developers unfamiliar with ASYNCIFY internals

### Pitfall 3: Instance Descriptor Must Be Default on Emscripten
**What goes wrong:** Passing a non-default InstanceDescriptor to wgpu::CreateInstance() causes errors on web.
**Why it happens:** Emscripten's WebGPU instance is created via the browser, which has its own initialization path. Features like TimedWaitAny may not be available.
**How to avoid:**
```cpp
#ifdef __EMSCRIPTEN__
    instance = wgpu::CreateInstance();  // default/null descriptor
#else
    wgpu::InstanceDescriptor desc{...};
    instance = wgpu::CreateInstance(&desc);
#endif
```
**Warning signs:** "Failed to create instance" or "Unsupported feature" errors on web but not native

### Pitfall 4: Emscripten GLFW Version Mismatch
**What goes wrong:** Using GLFW functions that don't exist in Emscripten's GLFW 3 implementation causes link errors or runtime crashes.
**Why it happens:** Emscripten provides its own JavaScript implementation of GLFW 3 (`-sUSE_GLFW=3`), but it's a subset.
**How to avoid:**
- For Phase 1, consider skipping GLFW entirely and using direct canvas selector for surface creation
- If using GLFW, add `-sUSE_GLFW=3` to linker flags
- Test GLFW calls on web early, don't assume native GLFW == Emscripten GLFW
**Warning signs:** "undefined symbol: glfwXxx" link errors

### Pitfall 5: Vite Pre-bundling WASM Dependencies
**What goes wrong:** Vite tries to pre-bundle the Emscripten JS glue file, causing module resolution errors.
**Why it happens:** Vite's optimizeDeps pre-bundles dependencies for faster dev loading, but Emscripten's JS glue uses CommonJS patterns and dynamic imports.
**How to avoid:**
- Add WASM output path to `optimizeDeps.exclude` in vite.config.ts
- Serve WASM files from `public/` directory for simplest path
- Consider loading the Emscripten module directly in index.html via `<script>` tag rather than importing through Vite
**Warning signs:** "Failed to resolve import" or "Module not found" errors in dev server

### Pitfall 6: Canvas Resize Breaking WebGPU Surface
**What goes wrong:** Resizing the browser window causes WebGPU validation errors or distorted rendering because the surface configuration is stale.
**Why it happens:** The surface must be re-configured when canvas dimensions change.
**How to avoid:**
- Use ResizeObserver on the canvas element
- Debounce resize events (e.g., 100ms)
- Reconfigure the surface with new width/height on resize
- C++ engine needs a `resize(w, h)` function called from JS
**Warning signs:** Stretched rendering, WebGPU validation errors mentioning texture size mismatch

## Code Examples

### Complete CMakeLists.txt for Phase 1
```cmake
# Source: Assembled from Chrome DevRel example + emdawnwebgpu port docs
cmake_minimum_required(VERSION 3.22)
project(glass-engine LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 20)

add_executable(engine
    src/main.cpp
)

if(EMSCRIPTEN)
    set_target_properties(engine PROPERTIES SUFFIX ".html")
    target_link_libraries(engine PRIVATE emdawnwebgpu_cpp)
    target_link_options(engine PRIVATE
        "-sASYNCIFY=1"
        "-sALLOW_MEMORY_GROWTH"
        "-lembind"
    )
    # Optional: limit ASYNCIFY instrumentation for smaller binary
    # target_link_options(engine PRIVATE
    #     "-sASYNCIFY_ONLY=['wgpuInstanceWaitAny','wgpuInstanceRequestAdapter','wgpuAdapterRequestDevice']"
    # )
else()
    # Native build with Dawn (for local testing)
    set(DAWN_FETCH_DEPENDENCIES ON)
    add_subdirectory(dawn EXCLUDE_FROM_ALL)
    target_link_libraries(engine PRIVATE webgpu_dawn)
endif()
```

### Build Commands
```bash
# First time setup
cd engine
emcmake cmake -B build-web
cmake --build build-web -j4

# Subsequent rebuilds
cmake --build engine/build-web -j4

# Production build
emcmake cmake -B build-web -DCMAKE_BUILD_TYPE=Release
cmake --build build-web -j4
```

### Minimal Phase 1 Proof-of-Concept main.cpp
```cpp
// Source: Synthesized from Chrome DevRel + kainino0x cross-platform demo patterns
#include <iostream>
#include <webgpu/webgpu_cpp.h>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#include <emscripten/html5.h>
#endif

wgpu::Instance instance;
wgpu::Adapter adapter;
wgpu::Device device;
wgpu::Surface surface;
wgpu::TextureFormat format;

void Render() {
    wgpu::SurfaceTexture surfaceTexture;
    surface.GetCurrentTexture(&surfaceTexture);

    wgpu::RenderPassColorAttachment attachment{
        .view = surfaceTexture.texture.CreateView(),
        .loadOp = wgpu::LoadOp::Clear,
        .storeOp = wgpu::StoreOp::Store,
        .clearValue = {0.0f, 0.5f, 0.8f, 1.0f}  // Distinctive blue
    };

    wgpu::RenderPassDescriptor renderpass{
        .colorAttachmentCount = 1,
        .colorAttachments = &attachment
    };

    wgpu::CommandEncoder encoder = device.CreateCommandEncoder();
    wgpu::RenderPassEncoder pass = encoder.BeginRenderPass(&renderpass);
    pass.End();
    wgpu::CommandBuffer commands = encoder.Finish();
    device.GetQueue().Submit(1, &commands);

#ifndef __EMSCRIPTEN__
    surface.Present();
    instance.ProcessEvents();
#endif
}

void InitGraphics() {
    // Create surface from canvas
    wgpu::SurfaceDescriptor surfaceDesc{};
#ifdef __EMSCRIPTEN__
    wgpu::SurfaceSourceCanvasHTMLSelector canvasSource{};
    canvasSource.selector = "#gpu-canvas";
    surfaceDesc.nextInChain = &canvasSource;
#endif
    surface = instance.CreateSurface(&surfaceDesc);

    // Configure surface
    wgpu::SurfaceCapabilities capabilities;
    surface.GetCapabilities(adapter, &capabilities);
    format = capabilities.formats[0];

    wgpu::SurfaceConfiguration config{
        .device = device,
        .format = format,
        .width = 512,
        .height = 512
    };
    surface.Configure(&config);
}

void Init() {
    instance = wgpu::CreateInstance();

    wgpu::Future f1 = instance.RequestAdapter(
        nullptr, wgpu::CallbackMode::WaitAnyOnly,
        [](wgpu::RequestAdapterStatus status,
           wgpu::Adapter a, wgpu::StringView msg) {
            if (status != wgpu::RequestAdapterStatus::Success) {
                std::cerr << "RequestAdapter failed: " << msg << "\n";
                return;
            }
            adapter = std::move(a);
        });
    instance.WaitAny(f1, UINT64_MAX);

    wgpu::DeviceDescriptor devDesc{};
    devDesc.SetUncapturedErrorCallback(
        [](const wgpu::Device&, wgpu::ErrorType type,
           wgpu::StringView msg) {
            std::cerr << "Device error: " << type << " - " << msg << "\n";
        });

    wgpu::Future f2 = adapter.RequestDevice(
        &devDesc, wgpu::CallbackMode::WaitAnyOnly,
        [](wgpu::RequestDeviceStatus status, wgpu::Device d,
           wgpu::StringView msg) {
            if (status != wgpu::RequestDeviceStatus::Success) {
                std::cerr << "RequestDevice failed: " << msg << "\n";
                return;
            }
            device = std::move(d);
        });
    instance.WaitAny(f2, UINT64_MAX);

    std::cout << "WebGPU device acquired successfully\n";
}

int main() {
    Init();
    InitGraphics();

#ifdef __EMSCRIPTEN__
    emscripten_set_main_loop(Render, 0, false);
#else
    while (true) { Render(); }
#endif
    return 0;
}
```

### Vite Configuration
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
    plugins: [
        react(),
        wasm(),
        topLevelAwait(),
    ],
    optimizeDeps: {
        exclude: ['engine']
    },
    server: {
        headers: {
            // Required for SharedArrayBuffer if using threads later
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
        }
    }
});
```

### HTML Shell for Phase 1 Proof
```html
<!-- public/index.html -->
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Glass Engine - Phase 1 Proof</title>
    <style>
        body { margin: 0; background: #111; display: flex;
               justify-content: center; align-items: center;
               height: 100vh; }
        #gpu-canvas { width: 512px; height: 512px; }
    </style>
</head>
<body>
    <canvas id="gpu-canvas" width="512" height="512"></canvas>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| -sUSE_WEBGPU | --use-port=emdawnwebgpu | 2024 (PR #24220) | Must use emdawnwebgpu for all new projects |
| emscripten_webgpu_get_device() | wgpu::CreateInstance() + standard init | 2024 | Deprecated API, use standard webgpu.h device creation |
| preinitializedWebGPUDevice | ASYNCIFY + standard init | 2024 | Legacy mechanism being removed |
| Emscripten webgpu.h (built-in) | Dawn's emdawnwebgpu webgpu.h | 2024 | Emscripten's copy is unmaintained |
| -sASYNCIFY=2 (JSPI) | Still experimental | Ongoing | Not production-ready, smaller binary but needs browser flags |
| Callback-based webgpu.h | Future-based webgpu.h (WaitAny) | 2024 | New API pattern in emdawnwebgpu, requires ASYNCIFY |

**Deprecated/outdated:**
- `-sUSE_WEBGPU`: Deprecated with linker warning, use `--use-port=emdawnwebgpu`
- `emscripten_webgpu_get_device()`: Deprecated, only for legacy preinitializedWebGPUDevice
- `emscripten_webgpu_import_device()`: Not a stable API in emdawnwebgpu
- `Module.WebGPU.importJSDevice()`: Legacy mechanism from old Emscripten WebGPU
- `webgpu.h` from Emscripten core: Unmaintained, Dawn's version is authoritative

## Open Questions

1. **Texture Handle Interop (C++ to JS)**
   - What we know: emdawnwebgpu maintains internal object tables mapping WGPUTexture pointers to JS GPUTexture objects. The pattern `WebGPU.mgrTexture.get(id)` is used internally.
   - What's unclear: Whether this internal API is stable enough to rely on for the texture sharing bridge. It's not documented as a public interface.
   - Recommendation: For Phase 1, avoid needing this interop entirely -- prove device acquisition and rendering with C++ rendering directly to canvas. Defer texture interop investigation to Phase 3 when it's actually needed. If needed earlier, test with a small EM_ASM probe.

2. **ASYNCIFY_ONLY Exact Function List**
   - What we know: `wgpuInstanceRequestAdapter`, `wgpuAdapterRequestDevice`, `wgpuBufferMapAsync`, and `wgpuInstanceWaitAny` are the core async functions.
   - What's unclear: The exact call chain that ASYNCIFY_ONLY needs (including intermediate functions). Getting it wrong breaks the app with no useful error.
   - Recommendation: Start WITHOUT ASYNCIFY_ONLY (accept larger binary for Phase 1). Use `-sASYNCIFY_ADVISE` to determine the full instrumented function list. Add ASYNCIFY_ONLY optimization in a later phase when binary size matters.

3. **Vite + Emscripten Module Loading Pattern**
   - What we know: vite-plugin-wasm handles standard .wasm ESM imports. Emscripten's JS glue has a specific Module factory pattern.
   - What's unclear: Whether Emscripten's generated .js glue code can be imported as an ESM module through Vite, or if it needs to be loaded via a `<script>` tag in index.html.
   - Recommendation: Try both approaches during implementation. The `<script>` tag approach is simpler and more reliable; ESM import through Vite may need custom configuration.

4. **WASM Hot-Reload Latency**
   - What we know: C++ rebuilds via emcmake take seconds. vite-plugin-live-reload can trigger page reload on .wasm change.
   - What's unclear: Total round-trip time from C++ edit to visible change. If emcmake rebuild takes >5s, the dev experience may be poor.
   - Recommendation: Measure rebuild time with a minimal project. If slow, consider incremental builds with Ninja generator (`cmake -GNinja`) instead of Make.

5. **Revised Device Sharing Architecture**
   - What we know: The prior decision "JS creates device, passes to C++" assumed `emscripten_webgpu_import_device()` exists as a stable API. It does not in emdawnwebgpu.
   - What's unclear: Whether the standard emdawnwebgpu pattern (C++ creates device) conflicts with any downstream Phase 3-5 requirements.
   - Recommendation: **Revise the architectural decision.** C++ should create the device via standard webgpu.h. For Phase 3 (JS needing to sample C++ textures), investigate using EM_ASM to extract JS object references from emdawnwebgpu's internal tables, or restructure so C++ handles all GPU work and only passes pixel data to JS.

## Sources

### Primary (HIGH confidence)
- [Chrome DevRel: Build an app with WebGPU](https://developer.chrome.com/docs/web-platform/webgpu/build-app) -- Complete CMakeLists.txt, C++ init code, build commands with emdawnwebgpu
- [kainino0x/webgpu-cross-platform-demo](https://github.com/kainino0x/webgpu-cross-platform-demo) -- Reference implementation of emdawnwebgpu with CMake and ASYNCIFY
- [beaufortfrancois/webgpu-cross-platform-app](https://github.com/beaufortfrancois/webgpu-cross-platform-app) -- Minimal emdawnwebgpu cross-platform example
- [Emscripten ASYNCIFY docs](https://emscripten.org/docs/porting/asyncify.html) -- ASYNCIFY_ONLY, ASYNCIFY_ADVISE, ASYNCIFY_STACK_SIZE, EM_ASYNC_JS
- [Emscripten Embind docs](https://emscripten.org/docs/porting/connecting_cpp_and_javascript/embind.html) -- Function binding, class binding, emscripten::val
- [emdawnwebgpu port file](https://github.com/emscripten-core/emscripten/blob/main/tools/ports/emdawnwebgpu.py) -- Version v20251002.162335, requires Emscripten 4.0.10+

### Secondary (MEDIUM confidence)
- [Deprecate -sUSE_WEBGPU PR #24220](https://github.com/emscripten-core/emscripten/pull/24220) -- Migration path from USE_WEBGPU to emdawnwebgpu
- [Deprecate and remove -sUSE_WEBGPU #24265](https://github.com/emscripten-core/emscripten/issues/24265) -- Removal timeline discussion
- [Using WebGPU without ASYNCIFY #22207](https://github.com/emscripten-core/emscripten/issues/22207) -- JSPI alternative, callback patterns, binary size concerns
- [Mixed JS/WASM WebGPU #13888](https://github.com/emscripten-core/emscripten/issues/13888) -- JsValStore mechanism, object table internals
- [LearnWebGPU: Building for Web](https://eliemichel.github.io/LearnWebGPU/appendices/building-for-the-web.html) -- ASYNCIFY patterns, main loop, canvas integration
- [developer239/vite-react-wasm-cpp-emscripten-cmake](https://github.com/developer239/vite-react-wasm-cpp-emscripten-cmake) -- Vite + React + Emscripten boilerplate reference
- [vite-plugin-wasm npm](https://www.npmjs.com/package/vite-plugin-wasm) -- v3.5.0, Vite 2.x-7.x support
- [vite-plugin-wasm-pack-watcher](https://github.com/mtolmacs/vite-plugin-wasm-pack-watcher) -- Pattern for watch-rebuild-reload workflow

### Tertiary (LOW confidence, needs validation)
- [ASYNCIFY + WaitAny "unwind" error #24154](https://github.com/emscripten-core/emscripten/issues/24154) -- Known benign error, may be fixed upstream
- WebGPU.mgrTexture.get(id) internal API -- Observed in emdawnwebgpu source, not documented as public
- [What is WebGPU support in Emscripten? #15645](https://github.com/emscripten-core/emscripten/discussions/15645) -- emscripten_webgpu_get_device deprecation confirmation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- emdawnwebgpu is the official, verified path with multiple reference implementations
- Architecture: MEDIUM-HIGH -- C++ device creation pattern is well-documented, but texture interop between C++ and JS layers needs validation during implementation
- Build system: HIGH -- CMake + emcmake pattern is standard across all examples
- Vite integration: MEDIUM -- No authoritative Vite + Emscripten pattern; assembled from multiple community approaches
- Pitfalls: HIGH -- ASYNCIFY issues well-documented in GitHub issues; WaitAny "unwind" bug confirmed
- Device sharing: MEDIUM -- Prior architectural decision needs revision; the old import_device API doesn't exist in emdawnwebgpu

**Critical finding requiring architectural decision update:**
The prior decision "JS creates device, passes to C++ via emscripten_webgpu_import_device()" is not compatible with current emdawnwebgpu. The planner must use the pattern: **C++ creates device via standard webgpu.h, renders to surface or offscreen texture. JS accesses GPU objects through emdawnwebgpu's internal binding layer when needed.**

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (30 days -- emdawnwebgpu is actively evolving; webgpu.h API not yet stabilized)

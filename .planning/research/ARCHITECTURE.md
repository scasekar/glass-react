# Architecture Research: LiquidGlass-React-WASM

## System Overview

```
┌─────────────────────────────────────────────────────┐
│                    Browser                           │
│                                                     │
│  ┌─────────────┐    shared     ┌─────────────────┐ │
│  │  C++ Engine  │───GPUDevice──▶│  React Glass UI  │ │
│  │   (WASM)     │              │   (TypeScript)    │ │
│  │              │   GPUTexture │                   │ │
│  │  Noise/Fluid ├─────────────▶│  Refraction      │ │
│  │  Simulation  │  (zero-copy) │  Shaders (WGSL)  │ │
│  └──────┬───────┘              └────────┬──────────┘ │
│         │                               │            │
│         ▼                               ▼            │
│  ┌──────────────────────────────────────────────┐   │
│  │              Single <canvas>                   │   │
│  │              WebGPU Context                    │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Critical Architecture Decision: Shared GPUDevice

The C++ engine and React UI **must share a single GPUDevice**. WebGPU does not support cross-device texture sharing. Two approaches:

### Approach A: JS Creates Device, Passes to C++ (Recommended)

1. JavaScript requests adapter + device
2. Pass device handle to C++ via `emscripten_webgpu_import_device()` or JsValStore
3. C++ renders to a `GPUTexture` created with `RENDER_ATTACHMENT | TEXTURE_BINDING`
4. JS/React reads the same texture in its own render pass

**Why:** JS owns the lifecycle, React can manage context, C++ is a "renderer service."

### Approach B: C++ Creates Device, Exports to JS

1. C++ requests adapter/device (requires ASYNCIFY)
2. Export device handle to JS via `emscripten_webgpu_export_device()`
3. JS wraps the device for React use

**Why not:** ASYNCIFY overhead, harder React lifecycle management.

## Component Architecture

### 1. Engine Layer (C++)
- **BackgroundEngine** — owns the noise/fluid simulation
- Exposes via Embind/extern "C":
  - `init(WGPUDevice device)` — receive shared device
  - `update(float dt)` — advance simulation
  - `getTexture()` → returns WGPUTexture handle
  - `resize(uint32_t w, uint32_t h)` — handle canvas resize

### 2. Bridge Layer (TypeScript)
- **WebGPUContext** — singleton managing GPUDevice, GPUQueue
- **WASMBridge** — loads .wasm module, marshals device handle to C++
- **TextureProvider** — React context providing background GPUTexture to children

### 3. Component Layer (React)
- **GlassProvider** — wraps app, initializes WebGPU + WASM engine
- **GlassCanvas** — renders the canvas element, owns the render loop
- **GlassPanel / GlassButton / GlassCard** — consume TextureProvider context

## Render Pipeline (Per Frame)

```
requestAnimationFrame
  │
  ├─ 1. C++ engine.update(dt)        // advance fluid sim
  │     └─ Render to backgroundTexture (RENDER_ATTACHMENT)
  │
  ├─ 2. JS compositing pass
  │     ├─ Bind backgroundTexture as sampled texture
  │     ├─ For each glass component:
  │     │   └─ Draw fullscreen quad with refraction shader
  │     │      (samples backgroundTexture at distorted UVs)
  │     └─ Output to canvas swap chain texture
  │
  └─ 3. Present
```

## Data Flow

| Data | Direction | Mechanism |
|------|-----------|-----------|
| GPUDevice | JS → C++ | emscripten_webgpu_import_device() |
| Background Texture | C++ → JS | Shared GPUTexture (same device) |
| Component bounds | React → Shader | Uniform buffer (position, size) |
| Light position | React → Shader | Uniform buffer |
| Simulation params | JS → C++ | Embind function calls |
| Canvas size | JS → C++ | resize() call |

## Build Order (Dependencies)

1. **Emscripten build pipeline** — must work before anything else
2. **WebGPU device creation** — foundation for all rendering
3. **C++ background engine** — produces the texture
4. **Texture sharing bridge** — connects C++ output to JS input
5. **React WebGPU context** — manages the rendering lifecycle
6. **Glass shaders** — consume the texture
7. **React components** — wrap shaders in usable API
8. **Demo page** — showcases everything

## Key Technical References

- Figma: Pioneered C++/WASM + WebGPU architecture at scale
- emdawnwebgpu: Dawn's official Emscripten WebGPU bindings
- WebGPU render-to-texture: Texture needs RENDER_ATTACHMENT + TEXTURE_BINDING usage
- JsValStore: Emscripten's solution for bidirectional JS/WASM object sharing

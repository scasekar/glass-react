# Stack Research: LiquidGlass-React-WASM

## C++ / WASM Toolchain

| Component | Recommendation | Confidence |
|-----------|---------------|------------|
| **Compiler** | Emscripten 5.x (latest stable) | High |
| **C++ Standard** | C++20 | High |
| **WebGPU Bindings** | emdawnwebgpu (Dawn's bindings) | High |
| **Build System** | CMake 3.22+ with `emcmake` | High |
| **Async Strategy** | ASYNCIFY=1 for device init, `emscripten_set_main_loop` for render | High |

### Key Details

**emdawnwebgpu over USE_WEBGPU:** Emscripten's built-in `-sUSE_WEBGPU` bindings are unmaintained. All new development is on emdawnwebgpu, which implements the latest standardized `webgpu.h` over the browser API. Switch is a single flag change: `emcc --use-port=emdawnwebgpu`.

**ASYNCIFY trade-off:** Enables synchronous C++ code to call async JS APIs (adapter/device request). Increases binary size (~80% in some cases). Mitigate with `-sASYNCIFY_STACK_SIZE` tuning and limiting instrumented functions via `ASYNCIFY_ONLY`.

**CMake setup:**
```cmake
if(EMSCRIPTEN)
  set_target_properties(app PROPERTIES SUFFIX ".html")
  target_link_libraries(app PRIVATE emdawnwebgpu_cpp)
  target_link_options(app PRIVATE "-sASYNCIFY=1")
else()
  target_link_libraries(app PRIVATE webgpu_dawn)
endif()
```

**Render loop:** Replace desktop while-loop with `emscripten_set_main_loop(Render, 0, false)` for proper browser integration.

## Frontend

| Component | Recommendation | Confidence |
|-----------|---------------|------------|
| **Framework** | React 19+ | High |
| **Language** | TypeScript 5.x | High |
| **Bundler** | Vite 6+ | High |
| **WASM Loading** | vite-plugin-wasm + vite-plugin-top-level-await | Medium |
| **Library Build** | tsup (esbuild-powered) | Medium |

### Key Details

**Vite + WASM:** `vite-plugin-wasm` adds WebAssembly ESM integration. Requires `vite-plugin-top-level-await` unless targeting `esnext` only. Supports Vite 2.x-7.x.

**tsup for library packaging:** Fast TypeScript bundler, outputs CJS + ESM, minimal config. Handles TS compilation but WASM assets need custom handling (copy .wasm to dist).

**NOT recommended:**
- Webpack — slower, more complex config for WASM
- Rollup directly — tsup wraps it with better defaults
- WESL (WGSL Extended) — too immature (v0.2), stick with plain WGSL

## Graphics / Shaders

| Component | Recommendation | Confidence |
|-----------|---------------|------------|
| **Shader Language** | WGSL (plain, no preprocessor) | High |
| **Texture Format** | RGBA8Unorm for background texture | High |
| **Texture Usage** | RENDER_ATTACHMENT + TEXTURE_BINDING | High |

## What NOT to Use

| Technology | Reason |
|-----------|--------|
| WebGL/WebGL2 | Older API, worse texture sharing, no compute shaders |
| wasm_webgpu (juj) | Lower-level C bindings, emdawnwebgpu is the official path |
| USE_WEBGPU flag | Unmaintained, being removed from Emscripten |
| WESL | Too immature (v0.2), 91 GitHub stars |
| wasm-pack | Rust tooling, not applicable to C++ |

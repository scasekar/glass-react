# Technology Stack

**Analysis Date:** 2026-02-25

## Languages

**Primary:**
- TypeScript 5.9.3 - React library source (`src/`) and build configuration
- C++20 - WebGPU rendering engine (`engine/src/`)
- WGSL (WebGPU Shading Language) - GPU shaders embedded as C++ header files (`engine/src/shaders/*.wgsl.h`)

**Secondary:**
- TSX (React JSX) - Component files (`src/components/*.tsx`, `src/App.tsx`, `demo/App.tsx`)

## Runtime

**Environment:**
- Node.js 24.10.0 (development toolchain)
- Browser (production target) — ESM output, WebGPU API required

**Package Manager:**
- npm 11.6.0
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- React 19.2.4 - UI component library (peer dependency, `^18.0.0 || ^19.0.0`)
- React DOM 19.2.4 - DOM rendering (peer dependency)

**Build/Dev:**
- Vite 6.4.1 - Build tool and dev server (`vite.config.ts`, `vite.demo.config.ts`)
- TypeScript compiler - Type checking and declaration generation (`tsconfig.json`, `tsconfig.lib.json`)
- Emscripten 4.0.16+ - C++ to WebAssembly compiler (required `>=4.0.10`; invoked via `emcmake cmake`)
- CMake 3.22+ - C++ build system (`engine/CMakeLists.txt`)

**Testing:**
- Playwright 1.58.2 - End-to-end testing framework (present in devDependencies, no test config files detected)

## Key Dependencies

**Critical:**
- `vite-plugin-wasm` 3.5.0 - Enables importing `.wasm` files in Vite; required for the Emscripten output
- `vite-plugin-top-level-await` 1.6.0 - Required alongside `vite-plugin-wasm` for async WASM module initialization
- `emdawnwebgpu` (Emscripten port) - Dawn WebGPU C++ bindings, header-only; activated via `--use-port=emdawnwebgpu` in `engine/CMakeLists.txt`

**Infrastructure:**
- `vite-plugin-dts` 4.5.4 - Generates TypeScript declaration files for the library build
- `vite-plugin-live-reload` 3.0.5 - Reloads dev server when `engine/build-web/` WASM artifacts change
- `concurrently` 9.2.1 - Runs WASM watcher and Vite dev server in parallel (`npm run dev`)
- `nodemon` 3.1.11 - Watches `engine/src/` for C++ changes and triggers WASM rebuild
- `@vitejs/plugin-react` 4.7.0 - Babel-based React Fast Refresh for Vite

## Configuration

**TypeScript:**
- `tsconfig.json` - Compiler config for `src/`; target ES2022, strict mode, `moduleResolution: bundler`, no emit
- `tsconfig.lib.json` - Extends base; enables declaration output to `dist/`; excludes `src/main.tsx` and `src/App.tsx`

**Build:**
- `vite.config.ts` - Dual-mode config: library build (ES module, externalized React) vs. dev server
- `vite.demo.config.ts` - Separate config for `demo/` app; outputs to `demo-dist/`

**C++ Build:**
- `engine/CMakeLists.txt` - Emscripten build producing `engine/build-web/engine.js` (SINGLE_FILE, MODULARIZE, EXPORT_ES6)
- Key Emscripten link flags: `ASYNCIFY=1`, `ALLOW_MEMORY_GROWTH`, `ENVIRONMENT=web`, `MODULARIZE=1`, `EXPORT_ES6=1`, `EXPORT_NAME=createEngineModule`, `SINGLE_FILE=1`

**Environment:**
- No `.env` files present
- No `.nvmrc` or `.python-version` files present
- No environment variables required at runtime; all configuration is compile-time or browser-side

## Platform Requirements

**Development:**
- Node.js 24.x (observed), npm 11.x
- Emscripten 4.0.16+ with emdawnwebgpu port support
- CMake 3.22+
- Browser with WebGPU support for testing (Chrome 113+, Edge 113+)

**Production:**
- Browser-only library (no server component)
- Requires WebGPU API (`navigator.gpu`); enforced at runtime in `src/wasm/loader.ts`
- Distributed as ESM package via `dist/index.js` and `dist/index.d.ts`
- Published to npm; built artifact committed to `dist/`

---

*Stack analysis: 2026-02-25*

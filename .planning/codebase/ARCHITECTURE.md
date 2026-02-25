# Architecture

**Analysis Date:** 2026-02-25

## Pattern Overview

**Overall:** Hybrid C++/WebAssembly + React library with a provider/context pattern

**Key Characteristics:**
- A C++ WebGPU engine compiled to WASM via Emscripten is the rendering core
- A React provider tree exposes the engine to the component graph via context
- Glass components are transparent HTML elements; the GPU canvas renders behind them at `z-index: -1`
- DOM positions are synced to the engine each animation frame via `requestAnimationFrame`
- All per-region state lives inside the C++ engine (WASM heap); React holds only region IDs

## Layers

**C++ Engine Layer:**
- Purpose: WebGPU rendering — noise background generation, glass refraction, chromatic aberration, specular and rim lighting
- Location: `engine/src/`
- Contains: `main.cpp` (WebGPU init + Embind bindings), `background_engine.cpp/.h` (render loop, region management), WGSL shaders embedded as `.wgsl.h` header strings
- Depends on: WebGPU (`webgpu/webgpu_cpp.h`), Emscripten (`emscripten.h`, `html5.h`, `bind.h`), emdawnwebgpu port
- Used by: WASM loader in React layer

**WASM Bridge Layer:**
- Purpose: Type-safe interface between TypeScript and the compiled WASM module
- Location: `src/wasm/loader.ts`
- Contains: `EngineModule` interface (mirrors Embind-exposed `BackgroundEngine` methods), `initEngine()` factory
- Depends on: `engine/build-web/engine.js` (dynamic import at runtime)
- Used by: `GlassProvider`

**React Provider Layer:**
- Purpose: Initialize the engine, own the GPU canvas, manage region registration, sync DOM positions to the engine each frame
- Location: `src/components/GlassProvider.tsx`
- Contains: WASM init effect, ResizeObserver for canvas, rAF position sync loop, `registerRegion` / `unregisterRegion` callbacks
- Depends on: WASM bridge layer, accessibility hook, context definition
- Used by: Consumer applications wrapping their component tree

**React Context Layer:**
- Purpose: Distribute engine access to descendant components without prop drilling
- Location: `src/context/GlassContext.ts`
- Contains: `GlassContext`, `GlassContextValue` interface, `GlassRegionHandle` interface, `RegisteredRegion` interface
- Depends on: React `createContext`, types from `src/components/types.ts`
- Used by: `GlassProvider` (provides), `useGlassEngine` hook (consumes)

**Hook Layer:**
- Purpose: Encapsulate engine interaction patterns for use by glass components
- Location: `src/hooks/`
- Contains:
  - `useGlassEngine.ts` — typed `useContext(GlassContext)` with required-context guard
  - `useGlassRegion.ts` — registers/unregisters a DOM element as a glass region, syncs all style props and accessibility overrides to engine
  - `useAccessibilityPreferences.ts` — subscribes to OS `matchMedia` queries for `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-color-scheme` using `useSyncExternalStore`
  - `useMergedRef.ts` — merges internal + consumer refs into a single callback ref
- Depends on: context layer, types
- Used by: component layer

**Component Layer:**
- Purpose: Public API glass surface elements; render transparent HTML elements with glass parameters, delegate GPU work to hook layer
- Location: `src/components/`
- Contains: `GlassProvider.tsx`, `GlassPanel.tsx`, `GlassButton.tsx`, `GlassCard.tsx`, `types.ts`
- Depends on: hook layer, context layer
- Used by: library consumers

**Demo Application:**
- Purpose: Interactive showcase of the library with live parameter controls
- Location: `demo/`
- Contains: `App.tsx`, `main.tsx`, `index.html`, `controls/` (React UI controls)
- Depends on: component layer (imports from `../src/components/`)
- Used by: developers and end-users exploring the API

## Data Flow

**Engine Initialization:**

1. `GlassProvider` mounts and calls `initEngine()` from `src/wasm/loader.ts`
2. Loader dynamically imports `engine/build-web/engine.js` (Emscripten ES module) and calls `createEngineModule()`
3. WASM `main()` fires `RequestAdapter → RequestDevice` asynchronously using `AllowSpontaneous` callbacks
4. `GlassProvider` polls `module.getEngine()` every 50ms until C++ `g_engine` pointer is non-null
5. `setReady(true)` triggers downstream effects (ResizeObserver, rAF loop)

**Region Registration:**

1. A glass component (`GlassPanel`, `GlassButton`, `GlassCard`) mounts inside `<GlassProvider>`
2. `useGlassRegion` calls `ctx.registerRegion(element)` via `useGlassEngine`
3. `GlassProvider.registerRegion` calls `engine.addGlassRegion()` (C++ returns an integer ID)
4. A `GlassRegionHandle` object is created wrapping the ID and delegating to `engine.setRegion*()` methods
5. The element + handle are stored in `GlassProvider`'s `regionsRef` Map

**Per-Frame Synchronization:**

1. `GlassProvider`'s rAF loop reads `element.getBoundingClientRect()` for each registered region
2. Computes normalized UV coordinates relative to the GPU canvas bounding rect
3. Calls `handle.updateRect(x, y, w, h)` → `engine.setRegionRect()` → writes to C++ `GlassRegion.target`
4. C++ `BackgroundEngine::update(dt)` lerps `current` toward `target` using `morphSpeed`
5. `BackgroundEngine::render()` executes two WebGPU render passes:
   - Pass 1: noise shader → offscreen texture (animated procedural background)
   - Pass 2: glass shader → surface (SDF mask, refraction, blur, aberration, specular, rim per region)

**Accessibility Overrides:**

1. `useAccessibilityPreferences` subscribes to three `matchMedia` queries
2. Preferences flow into `GlassContext.preferences` via `GlassProvider`
3. `useGlassRegion` reads preferences and overrides effective visual params:
   - `reducedMotion` → `engine.setPaused(true)` (stops animation loop)
   - `reducedTransparency` → forces `blur=0`, `refraction=0`, near-opaque `opacity`, disables aberration/specular/rim
   - `darkMode` → selects dark/light default tint and opacity when props are unset

**State Management:**
- WASM heap owns all GPU state (uniforms, region data)
- React holds: engine readiness flag, region Map (element refs + handles), accessibility preferences
- No external state library; everything flows through React context and refs

## Key Abstractions

**BackgroundEngine (C++):**
- Purpose: Manages all WebGPU resources and exposes a flat region-mutation API
- Examples: `engine/src/background_engine.h`, `engine/src/background_engine.cpp`
- Pattern: Singleton owned by `g_engine` global; exposed to JS via Embind

**GlassRegionHandle:**
- Purpose: Typed JavaScript handle for a single GPU-managed glass region
- Examples: `src/context/GlassContext.ts` (interface), `src/components/GlassProvider.tsx` (implementation)
- Pattern: Value object wrapping an integer ID and closures over the engine instance

**GlassStyleProps:**
- Purpose: Shared visual parameter interface for all glass surface components
- Examples: `src/components/types.ts`
- Pattern: Plain TypeScript interface extended by each component's props type

**EngineModule:**
- Purpose: TypeScript interface describing the Emscripten-generated module's public surface
- Examples: `src/wasm/loader.ts`
- Pattern: Hand-authored declaration mirroring Embind `EMSCRIPTEN_BINDINGS` block in `engine/src/main.cpp`

## Entry Points

**Library Entry Point:**
- Location: `src/index.ts`
- Triggers: Imported by library consumers
- Responsibilities: Re-exports public components, types, hooks, context types; excludes `main.tsx` and `App.tsx` (excluded in `tsconfig.lib.json`)

**Dev/Demo Entry Point:**
- Location: `src/main.tsx` (dev), `demo/main.tsx` (demo app)
- Triggers: `index.html` script tag via Vite dev server
- Responsibilities: Mounts `<App />` into `#root`

**WASM Engine Entry:**
- Location: `engine/src/main.cpp` (`int main()`)
- Triggers: Called automatically when Emscripten module initializes
- Responsibilities: Creates WebGPU instance, requests adapter and device, creates `BackgroundEngine`, starts `emscripten_set_main_loop(MainLoop)`

## Error Handling

**Strategy:** Defensive — engine failures are logged to console and the UI degrades gracefully (components render as transparent `<div>`/`<button>`/`<article>` without glass effects)

**Patterns:**
- `initEngine()` throws synchronously if `navigator.gpu` is absent (WebGPU not supported)
- `GlassProvider` catches init errors with `.catch(err => console.error(...))`
- `registerRegion` returns `null` if engine is not ready or `addGlassRegion()` returns `< 0`; callers check for null handle
- C++ device errors are reported via `SetUncapturedErrorCallback` to `stderr`
- `useGlassEngine` throws if called outside `<GlassProvider>` (clear developer error)

## Cross-Cutting Concerns

**Logging:** `console.error` for engine init failures; C++ uses `std::cerr` for WebGPU errors; no structured logging
**Validation:** TypeScript strict mode; no runtime input validation on style props (clamping happens in WGSL shaders)
**Authentication:** Not applicable — client-side rendering library
**Accessibility:** First-class: `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-color-scheme` all handled via `useAccessibilityPreferences` and enforced in `useGlassRegion`

---

*Architecture analysis: 2026-02-25*

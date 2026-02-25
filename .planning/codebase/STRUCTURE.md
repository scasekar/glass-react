# Codebase Structure

**Analysis Date:** 2026-02-25

## Directory Layout

```
glass-react/
├── engine/                  # C++ WebGPU engine (CMake + Emscripten)
│   ├── CMakeLists.txt       # Build config (emdawnwebgpu port, Embind, ES module output)
│   ├── src/
│   │   ├── main.cpp         # WebGPU init, Embind bindings, main loop
│   │   ├── background_engine.h  # BackgroundEngine class declaration, GPU structs
│   │   ├── background_engine.cpp # Render passes, region management, lerp logic
│   │   └── shaders/
│   │       ├── noise.wgsl.h     # Procedural noise background shader (C string literal)
│   │       ├── glass.wgsl.h     # Glass refraction/SDF/aberration shader (C string literal)
│   │       └── blit.wgsl.h      # Simple blit/fullscreen triangle shader (C string literal)
│   └── build-web/           # CMake build output (generated, not committed)
│       ├── engine.js        # Emscripten ES module (MODULARIZE=1, EXPORT_ES6=1, SINGLE_FILE=1)
│       └── engine.wasm      # (embedded in engine.js via SINGLE_FILE=1)
├── src/                     # React/TypeScript library source
│   ├── index.ts             # Public library exports
│   ├── main.tsx             # Dev app entry (mounts App, excluded from lib build)
│   ├── App.tsx              # Dev app component (excluded from lib build)
│   ├── components/
│   │   ├── types.ts         # GlassStyleProps, GlassPanelProps, GlassButtonProps, GlassCardProps, GlassColor, AccessibilityPreferences
│   │   ├── GlassProvider.tsx # Engine init, GPU canvas, region registry, rAF sync loop
│   │   ├── GlassPanel.tsx   # <div> glass surface component
│   │   ├── GlassButton.tsx  # <button> glass surface with hover/active morph
│   │   └── GlassCard.tsx    # <article> glass surface component
│   ├── context/
│   │   └── GlassContext.ts  # React context, GlassContextValue, GlassRegionHandle, RegisteredRegion interfaces
│   ├── hooks/
│   │   ├── useGlassEngine.ts       # useContext(GlassContext) with required-context guard
│   │   ├── useGlassRegion.ts       # Register element as GPU glass region, sync props + a11y overrides
│   │   ├── useAccessibilityPreferences.ts  # matchMedia subscriptions via useSyncExternalStore
│   │   └── useMergedRef.ts         # Merge internal + consumer refs into callback ref
│   ├── utils/
│   │   └── contrast.ts      # WCAG 2.1 relativeLuminance, contrastRatio, meetsWCAG_AA utilities
│   └── wasm/
│       └── loader.ts        # EngineModule interface, initEngine() factory (dynamic import of engine.js)
├── demo/                    # Interactive demo application
│   ├── index.html           # Demo HTML shell
│   ├── main.tsx             # Demo entry point
│   ├── App.tsx              # Demo app with live parameter controls
│   └── controls/
│       ├── ControlPanel.tsx # Full sidebar panel with all GlassParams controls
│       ├── SliderControl.tsx # Labeled range slider
│       ├── SelectControl.tsx # Labeled select dropdown
│       └── ColorControl.tsx  # RGB color picker control
├── dist/                    # Library build output (generated, committed)
│   ├── index.js             # ES module bundle
│   ├── index.d.ts           # Type declarations entry
│   ├── engine-[hash].js     # Bundled WASM engine (content-hashed)
│   ├── components/          # Per-file .d.ts + .d.ts.map
│   ├── context/
│   ├── hooks/
│   ├── utils/
│   └── wasm/
├── .planning/               # GSD project management
│   ├── PROJECT.md
│   ├── MILESTONES.md
│   ├── ROADMAP.md
│   ├── STATE.md
│   ├── config.json
│   ├── codebase/            # Codebase analysis documents (written by map-codebase)
│   ├── milestones/
│   ├── phases/              # Phase plans (01 through 08)
│   └── research/
├── docs/                    # Additional docs
├── index.html               # Dev app HTML shell
├── package.json             # NPM package manifest (name: liquidglass-react)
├── tsconfig.json            # Base TypeScript config (strict, bundler resolution)
├── tsconfig.lib.json        # Library build config (declaration emit, excludes App.tsx/main.tsx)
├── vite.config.ts           # Dual-mode Vite config: library build (default) or dev server
├── vite.demo.config.ts      # Demo app Vite config (root: demo/, outputs to demo-dist/)
├── API.md                   # Public API documentation
└── README.md
```

## Directory Purposes

**`engine/src/`:**
- Purpose: C++ WebGPU rendering engine
- Contains: Engine class, GPU pipeline init, render passes, WGSL shaders as C header strings
- Key files: `background_engine.h` (structs and class API), `background_engine.cpp` (implementation), `main.cpp` (Embind bindings)

**`engine/build-web/`:**
- Purpose: CMake build output directory for Emscripten web target
- Contains: `engine.js` (SINGLE_FILE Emscripten ES module with embedded WASM)
- Generated: Yes — run `npm run build:wasm`
- Committed: Yes (so library consumers do not need the C++ toolchain)

**`src/components/`:**
- Purpose: Public-facing React components and shared type definitions
- Contains: `GlassProvider`, `GlassPanel`, `GlassButton`, `GlassCard`, `types.ts`
- Key files: `types.ts` is the canonical location for all shared prop interfaces

**`src/context/`:**
- Purpose: React context definition only — no provider logic (that lives in `GlassProvider.tsx`)
- Contains: `GlassContext.ts` with context object and all related interfaces

**`src/hooks/`:**
- Purpose: Reusable hooks for glass engine interaction and browser API subscriptions
- Contains: Four hooks — engine access, region management, accessibility, ref merging

**`src/wasm/`:**
- Purpose: Typed bridge between TypeScript and the Emscripten-compiled module
- Contains: `loader.ts` — `EngineModule` interface mirrors the `EMSCRIPTEN_BINDINGS` block in `main.cpp`

**`src/utils/`:**
- Purpose: Pure utility functions with no React or engine dependencies
- Contains: `contrast.ts` — WCAG 2.1 luminance and contrast ratio calculations

**`demo/controls/`:**
- Purpose: Interactive UI controls specific to the demo application
- Contains: Slider, select, color, and panel components for live parameter editing

## Key File Locations

**Entry Points:**
- `src/index.ts`: Library public exports — start here for any public API change
- `src/main.tsx`: Dev app mount point (excluded from lib build by `tsconfig.lib.json`)
- `demo/main.tsx`: Demo app mount point
- `engine/src/main.cpp`: WASM module entry — WebGPU init and Embind bindings

**Configuration:**
- `vite.config.ts`: Build modes: `vite build` → library ES module; `vite` → dev server
- `vite.demo.config.ts`: Demo app config (root: `demo/`)
- `engine/CMakeLists.txt`: Emscripten flags, Embind, module name (`createEngineModule`)
- `tsconfig.lib.json`: Library TypeScript config — excludes `App.tsx` and `main.tsx`

**Core Logic:**
- `src/components/GlassProvider.tsx`: Engine lifecycle owner, position sync loop
- `src/hooks/useGlassRegion.ts`: Accessibility-aware parameter sync — core of the glass effect API
- `engine/src/background_engine.cpp`: Two-pass WebGPU render loop with lerp morphing
- `engine/src/shaders/glass.wgsl.h`: SDF mask, refraction displacement, chromatic aberration, blur, specular, rim WGSL shader

**Type Definitions:**
- `src/components/types.ts`: All public-facing TypeScript interfaces
- `src/context/GlassContext.ts`: Internal context interfaces (`GlassRegionHandle`, `RegisteredRegion`, `GlassContextValue`)
- `src/wasm/loader.ts`: `EngineModule` interface (must stay in sync with `EMSCRIPTEN_BINDINGS` in `main.cpp`)

## Naming Conventions

**Files:**
- React components: PascalCase, named after the element — `GlassPanel.tsx`, `GlassButton.tsx`
- Hooks: camelCase prefixed with `use` — `useGlassRegion.ts`, `useMergedRef.ts`
- Utilities: camelCase noun — `contrast.ts`, `loader.ts`
- Types file: `types.ts` (singular, in the directory it serves)
- Context files: PascalCase matching the context name — `GlassContext.ts`
- WGSL shaders: `{name}.wgsl.h` — embedded as C string literals in header files

**Directories:**
- Feature groupings in `src/`: plural nouns — `components/`, `hooks/`, `context/`, `utils/`, `wasm/`
- Demo controls in `demo/`: `controls/`
- C++ engine: flat `src/` + `shaders/` subdirectory

**Exports:**
- All library exports go through `src/index.ts` — never import directly from deep paths in consumer code
- TypeScript interfaces and types use `export type` in `src/index.ts`

## Where to Add New Code

**New Glass Component (e.g., `GlassTooltip`):**
- Implementation: `src/components/GlassTooltip.tsx`
- Props interface: add to `src/components/types.ts`
- Export: add to `src/index.ts`
- Pattern: follow `GlassPanel.tsx` — use `useGlassRegion`, `useGlassEngine`, `useMergedRef`

**New C++ Engine Feature:**
- Header declaration: `engine/src/background_engine.h`
- Implementation: `engine/src/background_engine.cpp`
- Embind binding: `engine/src/main.cpp` inside `EMSCRIPTEN_BINDINGS` block
- TypeScript interface update: `src/wasm/loader.ts` `EngineModule.getEngine()` return type

**New WGSL Shader:**
- File: `engine/src/shaders/{name}.wgsl.h` as a C string literal
- Include: in `background_engine.cpp`

**New Hook:**
- File: `src/hooks/use{Name}.ts`
- Export: from `src/index.ts` if part of advanced public API

**New Utility:**
- File: `src/utils/{name}.ts`
- Not auto-exported — add to `src/index.ts` only if needed publicly

**Demo Controls:**
- File: `demo/controls/{Name}Control.tsx`
- Register: import and use in `demo/controls/ControlPanel.tsx`

## Special Directories

**`engine/build-web/`:**
- Purpose: Compiled WASM output consumed by `src/wasm/loader.ts` at runtime
- Generated: Yes — `npm run build:wasm`
- Committed: Yes — consumers do not need Emscripten installed
- Note: `engine.js` uses `SINGLE_FILE=1` so no separate `.wasm` file exists at runtime

**`dist/`:**
- Purpose: Library distribution files published to npm
- Generated: Yes — `npm run build:lib`
- Committed: Yes — allows direct GitHub installs
- Contains: `index.js` (ES module bundle), `index.d.ts`, per-module `.d.ts` files, content-hashed `engine-[hash].js`

**`.planning/`:**
- Purpose: GSD project management (phases, milestones, codebase analysis)
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-02-25*

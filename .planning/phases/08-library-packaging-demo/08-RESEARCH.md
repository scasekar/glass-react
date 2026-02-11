# Phase 8: Library Packaging & Demo - Research

**Researched:** 2026-02-10
**Domain:** npm library packaging (React + Emscripten WASM), demo page with interactive controls, API documentation
**Confidence:** MEDIUM-HIGH

## Summary

Phase 8 transforms the existing application-mode project into a distributable npm package and adds a showcase demo page. The project currently builds as a Vite application (`vite build` produces an app bundle in `dist/`); it needs to be restructured to build as a library (exporting React components + WASM engine assets) and separately as a demo application that consumes the library.

The core technical challenge is WASM asset distribution: the Emscripten-compiled `engine.js` (185KB) and `engine.wasm` (366KB) must be shipped alongside the React components so that consumers can `npm install liquidglass-react` and have everything work. Vite's library mode does not natively handle binary `.wasm` assets well -- it treats them like any other imported asset and may inline, hash, or relocate them in ways that break Emscripten's `locateFile` resolution. Two viable strategies exist: (1) use Emscripten's `-sSINGLE_FILE=1` to embed the WASM as base64 in the JS glue code, eliminating the separate `.wasm` file entirely, or (2) copy the pre-built WASM binary into the dist alongside the library bundle and configure `locateFile` to resolve it. Given the WASM size (~366KB, ~489KB as base64, ~150KB gzipped either way), the SINGLE_FILE approach is recommended for simplicity -- it eliminates the entire class of "where does the .wasm file live?" problems that plague consumer bundler setups.

**Primary recommendation:** Use `-sSINGLE_FILE=1` in the Emscripten build for the npm-distributed variant, Vite library mode with `vite-plugin-dts` for TypeScript declarations, and a separate Vite app entry point for the demo page. Build hand-rolled interactive controls (sliders, color inputs) rather than adding a UI library dependency.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vite | ^6.1.0 | Library bundling via `build.lib` | Already in project; library mode is built-in |
| vite-plugin-dts | ^4.x | Generate `.d.ts` type declarations | Standard for Vite library projects; replaces manual `tsc --emitDeclarationOnly` |
| vite-plugin-wasm | ^3.5.0 | WASM ESM integration for dev server | Already in project; needed for dev/demo only |
| vite-plugin-top-level-await | ^1.4.0 | Top-level await support | Already in project; needed for WASM init |
| typescript | ^5.7.0 | Type checking and declarations | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vite-plugin-static-copy | ^2.x | Copy .wasm to dist if NOT using SINGLE_FILE | Only if external .wasm distribution chosen |
| publint | latest | Validate package.json exports/types correctness | Run before publish to catch config errors |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SINGLE_FILE (inline WASM) | External .wasm + locateFile | External is 33% smaller but requires consumer bundler config, CDN awareness, locateFile overrides |
| Hand-rolled demo controls | leva (@pmndrs/leva) | Leva adds ~30KB dependency to demo; demo controls are simple enough to hand-roll |
| Hand-rolled demo controls | dat.gui | Dated API, not React-native, adds unnecessary dependency |
| vite-plugin-dts | manual tsc --emitDeclarationOnly | Plugin integrates with build pipeline, handles path rewriting |
| TypeDoc | Hand-written API docs | TypeDoc struggles with React component patterns; hand-written docs with JSDoc are clearer for this API surface |

**Installation (new dev dependencies):**
```bash
npm install -D vite-plugin-dts
```

## Architecture Patterns

### Recommended Project Structure

```
glass-react/
├── engine/                     # C++ WebGPU engine (unchanged)
│   ├── CMakeLists.txt
│   ├── src/
│   └── build-web/              # Emscripten output (engine.js, engine.wasm)
├── src/
│   ├── index.ts                # NEW: library entry point (re-exports)
│   ├── components/
│   │   ├── GlassProvider.tsx
│   │   ├── GlassPanel.tsx
│   │   ├── GlassButton.tsx
│   │   ├── GlassCard.tsx
│   │   └── types.ts
│   ├── context/
│   │   └── GlassContext.ts
│   ├── hooks/
│   │   ├── useGlassEngine.ts
│   │   ├── useGlassRegion.ts
│   │   ├── useAccessibilityPreferences.ts
│   │   └── useMergedRef.ts
│   ├── utils/
│   │   └── contrast.ts
│   └── wasm/
│       └── loader.ts
├── demo/                       # NEW: demo app (separate from library)
│   ├── index.html
│   ├── main.tsx
│   ├── App.tsx                 # Full demo with all components
│   └── controls/               # Interactive control components
│       ├── SliderControl.tsx
│       ├── ColorControl.tsx
│       ├── SelectControl.tsx
│       └── ControlPanel.tsx
├── dist/                       # Library build output
│   ├── index.js                # ESM bundle
│   ├── index.d.ts              # Type declarations
│   └── wasm/                   # WASM assets (if external strategy)
│       ├── engine.js
│       └── engine.wasm
├── vite.config.ts              # Library build config
├── vite.demo.config.ts         # NEW: demo app build config
├── package.json
└── tsconfig.json
```

### Pattern 1: Dual Vite Configs (Library + Demo)

**What:** Separate Vite configurations for library bundling and demo application.
**When to use:** When the same repo contains both a publishable library and a demo/docs site.
**Example:**

```typescript
// vite.config.ts — Library build
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    dts({ rollupTypes: false, tsconfigPath: './tsconfig.json' }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'react/jsx-runtime',
        },
      },
    },
  },
});
```

```typescript
// vite.demo.config.ts — Demo app build
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  root: 'demo',
  plugins: [react(), wasm(), topLevelAwait()],
  // ... standard app config
});
```

### Pattern 2: Library Entry Point with Barrel Exports

**What:** Single `src/index.ts` that re-exports all public API surface.
**When to use:** Always, for library packages.
**Example:**

```typescript
// src/index.ts
// Components
export { GlassProvider } from './components/GlassProvider';
export { GlassPanel } from './components/GlassPanel';
export { GlassButton } from './components/GlassButton';
export { GlassCard } from './components/GlassCard';

// Types
export type {
  GlassStyleProps,
  GlassPanelProps,
  GlassButtonProps,
  GlassCardProps,
  GlassColor,
  AccessibilityPreferences,
} from './components/types';

// Hooks (advanced usage)
export { useGlassEngine } from './hooks/useGlassEngine';
```

### Pattern 3: WASM Loader with locateFile Override

**What:** Pass a `locateFile` function to the Emscripten factory to resolve the WASM binary path.
**When to use:** If shipping the .wasm file separately (not using SINGLE_FILE).
**Example:**

```typescript
// src/wasm/loader.ts (adapted for library distribution)
export async function initEngine(): Promise<EngineModule> {
  if (!navigator.gpu) {
    throw new Error('WebGPU is not supported.');
  }
  const createEngineModule = (await import('./engine.js')).default;
  const module = await createEngineModule({
    locateFile: (path: string) => {
      if (path.endsWith('.wasm')) {
        // When bundled as library, resolve relative to this module
        return new URL('./engine.wasm', import.meta.url).href;
      }
      return path;
    },
  });
  return module as EngineModule;
}
```

### Pattern 4: SINGLE_FILE Distribution (Recommended)

**What:** Compile with `-sSINGLE_FILE=1` so the WASM is base64-embedded in `engine.js`. No separate `.wasm` file needed.
**When to use:** When WASM is < 1MB and consumer DX matters more than absolute load performance.
**Example:**

In `engine/CMakeLists.txt`, add to link options:
```cmake
"-sSINGLE_FILE=1"
```

This eliminates the `.wasm` file entirely. The `engine.js` file grows from ~185KB to ~490KB (185KB JS + ~366KB*1.33 base64), but gzip compression brings both approaches to similar transfer sizes (~150KB). The loader becomes simpler because there is no separate binary to locate.

### Anti-Patterns to Avoid

- **Bundling react/react-dom into the library:** These MUST be externalized via `rollupOptions.external`. Including them causes duplicate React instances, breaking hooks.
- **Using `build.assetsInlineLimit` for WASM:** Vite's inline limit base64-encodes assets as data URLs, which does NOT work for Emscripten's fetch-based loading. Use Emscripten's own SINGLE_FILE flag instead.
- **Publishing engine/build-web/ as-is:** The raw Emscripten output contains development artifacts and debug symbols. Either use SINGLE_FILE or copy only the needed files to dist.
- **postinstall scripts requiring Emscripten:** Consumers should NEVER need Emscripten installed. The WASM must be pre-built and included in the npm package.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TypeScript declaration generation | Manual `.d.ts` files | vite-plugin-dts | Automatic, stays in sync with source, handles path rewriting |
| Package.json validation | Manual review | publint (CLI) | Catches exports/types/module field misconfigurations |
| WASM binary embedding | Custom base64 loader | Emscripten `-sSINGLE_FILE=1` | Handles decode, streaming compile, memory management |

**Key insight:** The WASM distribution problem is the hardest part of this phase. Emscripten's SINGLE_FILE flag solves it at the compiler level, avoiding fragile bundler-level workarounds.

## Common Pitfalls

### Pitfall 1: Emscripten SINGLE_FILE + EXPORT_ES6 Double-Inclusion Bug
**What goes wrong:** Emscripten issue #14309 documents that combining SINGLE_FILE + EXPORT_ES6 + USE_ES6_IMPORT_META can cause the WASM binary to be included twice in the output.
**Why it happens:** The flags make conflicting assumptions about how the module scope works.
**How to avoid:** Test the built output file size to confirm the WASM is not duplicated. The single JS file should be roughly 185KB (original JS) + 489KB (WASM as base64) = ~674KB. If it is significantly larger, the bug has been triggered. This bug may be fixed in Emscripten 4.0.16 (the version in use) -- verify by checking output size.
**Warning signs:** Output JS file is > 1MB when the WASM itself is only 366KB.

### Pitfall 2: React Duplication from Bundled Dependencies
**What goes wrong:** If react and react-dom are bundled into the library, consumers get two React instances. Hooks break with "Invalid hook call" errors.
**Why it happens:** Missing `external: ['react', 'react-dom', 'react/jsx-runtime']` in Rollup config.
**How to avoid:** Always externalize React. Declare react/react-dom as peerDependencies.
**Warning signs:** "Invalid hook call" errors, `useState` returning undefined.

### Pitfall 3: WASM File Not Found at Runtime
**What goes wrong:** Consumer's bundler (webpack, Vite, etc.) cannot find the `.wasm` file after installing the package.
**Why it happens:** Emscripten's generated JS hardcodes the WASM filename and uses `fetch()` relative to the current page URL, not the module URL.
**How to avoid:** Use SINGLE_FILE to eliminate this entirely. If using external WASM, use `new URL('./engine.wasm', import.meta.url).href` in a `locateFile` override.
**Warning signs:** 404 errors for `engine.wasm` in browser console.

### Pitfall 4: Missing `"files"` Field in package.json
**What goes wrong:** `npm publish` includes everything not in `.gitignore` by default. Without `"files"`, the package includes `engine/build-web/`, `node_modules/`, source code, etc.
**Why it happens:** Forgot to whitelist only the dist output.
**How to avoid:** Set `"files": ["dist"]` in package.json. Run `npm pack --dry-run` to verify included files before publishing.
**Warning signs:** Published package is > 5MB when it should be < 1MB.

### Pitfall 5: Demo Page Using Library Source Instead of Built Output
**What goes wrong:** Demo imports from `../src/` instead of the built library, so it works in dev but doesn't validate the published artifact.
**Why it happens:** Convenience of direct imports during development.
**How to avoid:** The demo dev server can use source imports for HMR, but the demo build should verify by importing from the package name or dist output.
**Warning signs:** Demo works but consumers report import errors after installation.

### Pitfall 6: Canvas ID Collision
**What goes wrong:** GlassProvider creates a `<canvas id="gpu-canvas">` which the C++ engine references via `#gpu-canvas` selector. Multiple GlassProviders or existing elements with this ID cause conflicts.
**Why it happens:** Hardcoded canvas selector in C++ code.
**How to avoid:** This is an existing architectural constraint. For Phase 8, document clearly that only ONE GlassProvider is supported per page. Consider dynamic canvas IDs as a future enhancement.
**Warning signs:** WebGPU errors about missing canvas or surface creation failures.

## Code Examples

### Library package.json Configuration

```json
{
  "name": "liquidglass-react",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": [
    "dist"
  ],
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  },
  "scripts": {
    "build:wasm": "cd engine && emcmake cmake -B build-web && cmake --build build-web -j4",
    "build:lib": "vite build",
    "build": "npm run build:wasm && npm run build:lib",
    "dev:demo": "vite --config vite.demo.config.ts",
    "build:demo": "vite build --config vite.demo.config.ts",
    "prepublishOnly": "npm run build"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.1.0",
    "vite-plugin-dts": "^4.0.0",
    "vite-plugin-wasm": "^3.5.0",
    "vite-plugin-top-level-await": "^1.4.0"
  }
}
```

### Demo Interactive Controls (Hand-Rolled)

```tsx
// demo/controls/SliderControl.tsx
interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

function SliderControl({ label, value, min, max, step, onChange }: SliderControlProps) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ minWidth: 120 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span style={{ minWidth: 40, textAlign: 'right' }}>{value.toFixed(2)}</span>
    </label>
  );
}
```

### Consumer Usage Example (What README Should Show)

```tsx
import { GlassProvider, GlassPanel, GlassButton } from 'liquidglass-react';

function App() {
  return (
    <GlassProvider>
      <GlassPanel blur={0.6} cornerRadius={24} style={{ padding: 32 }}>
        <h2>Hello Glass</h2>
      </GlassPanel>
      <GlassButton onClick={() => alert('clicked!')}>
        Click Me
      </GlassButton>
    </GlassProvider>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `"main"` + `"module"` fields | `"exports"` field with conditions | Node 12.7+ / npm 7+ (2020+) | `exports` is the canonical way to declare package entry points; `main`/`module` kept for backwards compat |
| UMD + CJS builds | ESM-only with `"type": "module"` | 2023+ ecosystem shift | React 19 and modern bundlers all support ESM; UMD/CJS adds build complexity with diminishing benefit |
| Separate `.d.ts` authoring | vite-plugin-dts auto-generation | vite-plugin-dts v3+ (2023) | Declarations generated from source, always in sync |
| webpack for library bundling | Vite library mode | Vite 3+ (2022) | Simpler config, faster builds, Rollup under the hood |

**Deprecated/outdated:**
- `prepublish` npm script: Replaced by `prepublishOnly` + `prepare` in npm 4+.
- `"typings"` field: Use `"types"` instead (same behavior, `"types"` is canonical).
- CJS-first React libraries: React 19 is ESM-native; ship ESM, not CJS.

## Open Questions

1. **SINGLE_FILE + EXPORT_ES6 bug status in Emscripten 4.0.16**
   - What we know: Issue #14309 documented a double-inclusion bug. The project uses Emscripten 4.0.16.
   - What's unclear: Whether this specific bug was fixed in 4.0.16. The issue tracker shows the bug exists but does not clearly document which version resolved it.
   - Recommendation: Try adding `-sSINGLE_FILE=1` and verify output file size. If the bug triggers, fall back to the external .wasm + locateFile approach with `vite-plugin-static-copy`.

2. **Vite library mode + WASM import compatibility**
   - What we know: The current `loader.ts` uses `import('../../engine/build-web/engine.js')` with a relative path to the Emscripten output. In library mode, this import path needs to resolve within the built output.
   - What's unclear: Whether Vite library mode properly bundles the Emscripten JS module or if it needs to be treated as an external asset.
   - Recommendation: With SINGLE_FILE, the engine.js can potentially be imported as a regular module and bundled inline. If not, copy it to dist and use a dynamic import with `import.meta.url` resolution.

3. **Demo deployment target**
   - What we know: The demo page needs to be buildable and hostable (e.g., GitHub Pages).
   - What's unclear: No user decision on hosting platform.
   - Recommendation: Build the demo as a static site (`vite build --config vite.demo.config.ts`) that can be deployed to any static host. Use `base: './'` for relative paths.

4. **API documentation format**
   - What we know: Requirement DEMO-03 says "API documentation for all public components and props." TypeDoc does not handle React component props well.
   - What's unclear: Whether this means generated docs, a docs site, or README-level documentation.
   - Recommendation: Write hand-crafted API documentation as a section in the project README or a separate `API.md`. The API surface is small enough (4 components, ~10 props each) that generated docs add complexity without value.

## Sources

### Primary (HIGH confidence)
- Vite official docs: [Building for Production / Library Mode](https://vite.dev/guide/build) - build.lib configuration, externalization, package.json exports
- Emscripten docs: [Module object / locateFile](https://emscripten.org/docs/api_reference/module.html) - WASM file resolution
- Emscripten docs: [Modularized Output](https://emscripten.org/docs/compiling/Modularized-Output.html) - MODULARIZE, EXPORT_ES6, SINGLE_FILE interactions
- Codebase analysis: All source files in `src/`, `engine/`, `package.json`, `vite.config.ts`, `CMakeLists.txt`

### Secondary (MEDIUM confidence)
- [Recommendations when publishing a WASM library](https://nickb.dev/blog/recommendations-when-publishing-a-wasm-library/) - SINGLE_FILE vs external distribution tradeoffs, slim/standard variants
- [Build a React component library with TypeScript and Vite](https://victorlillo.dev/blog/react-typescript-vite-component-library) - vite.config.ts library mode, package.json, vite-plugin-dts
- [vite-plugin-dts on npm](https://www.npmjs.com/package/vite-plugin-dts) - Configuration, rollupTypes option
- [Guide to package.json exports](https://hirok.io/posts/package-json-exports) - exports field conditional configuration
- [Emscripten issue #14309](https://github.com/emscripten-core/emscripten/issues/14309) - SINGLE_FILE + EXPORT_ES6 double-inclusion bug
- [vite-plugin-static-copy](https://www.npmjs.com/package/vite-plugin-static-copy) - Copying binary assets in Vite builds
- [Emscripten and npm](https://web.dev/emscripten-npm/) - npm distribution patterns for Emscripten output
- [leva (pmndrs)](https://github.com/pmndrs/leva) - React GUI controls library (considered but not recommended)

### Tertiary (LOW confidence)
- WebSearch results on SINGLE_FILE + EXPORT_ES6 bug fix status - Could not confirm which Emscripten version resolved issue #14309; needs empirical validation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Vite library mode, vite-plugin-dts, and package.json exports are well-documented and widely used
- Architecture: MEDIUM-HIGH - Dual config pattern is well-established; WASM distribution strategy (SINGLE_FILE) needs empirical validation on this specific Emscripten version
- Pitfalls: HIGH - WASM packaging pitfalls are well-documented across multiple sources; React externalization is standard knowledge
- Demo controls: HIGH - Simple HTML range inputs and color inputs; no external dependencies needed

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (30 days - stable domain, Vite/Emscripten APIs are mature)

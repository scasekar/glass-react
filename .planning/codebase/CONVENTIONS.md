# Coding Conventions

**Analysis Date:** 2026-02-25

## Naming Patterns

**Files:**
- React components: PascalCase `.tsx` — `GlassPanel.tsx`, `GlassButton.tsx`, `GlassCard.tsx`
- React hooks: camelCase prefixed with `use` — `useGlassEngine.ts`, `useGlassRegion.ts`, `useMergedRef.ts`
- Context files: PascalCase suffix `Context.ts` — `GlassContext.ts`
- Utility modules: camelCase `.ts` — `contrast.ts`, `loader.ts`
- Type-only files: lowercase `types.ts` in the component directory

**Functions / Components:**
- React components: PascalCase named exports — `export function GlassPanel(...)`
- Hooks: camelCase named exports — `export function useGlassEngine()`
- Utility functions: camelCase named exports — `export function relativeLuminance(...)`
- Private helpers: camelCase, not exported — `function createMediaQueryStore(...)`
- Module-level constants: UPPER_SNAKE_CASE — `DARK_DEFAULTS`, `LIGHT_DEFAULTS`, `MAX_GLASS_REGIONS`

**Variables:**
- Local variables and parameters: camelCase — `effectiveBlur`, `cornerRadius`, `rafId`
- Boolean flags: plain adjective or past-tense — `cancelled`, `hovered`, `pressed`
- Ref variables: suffixed `Ref` — `internalRef`, `moduleRef`, `canvasRef`, `handleRef`

**TypeScript Types and Interfaces:**
- Interfaces: PascalCase, not prefixed with `I` — `GlassContextValue`, `GlassRegionHandle`
- Type aliases: PascalCase — `GlassColor`, `GlassStyleProps`
- Props interfaces: `[ComponentName]Props` — `GlassPanelProps`, `GlassButtonProps`
- Internal/non-exported interfaces: PascalCase — `MediaQueryStore`, `RegisteredRegion`

**C++ (engine):**
- Structs: PascalCase — `GlassUniforms`, `GlassRegion`, `BackgroundEngine`
- Methods: camelCase — `addGlassRegion()`, `setRegionRect()`, `lerpUniforms()`
- Private members: trailing underscore — `paused_`, `reducedTransparency_`
- Constants: constexpr UPPER_SNAKE_CASE — `MAX_GLASS_REGIONS`

## Code Style

**Formatting:**
- No Prettier or ESLint config files detected — formatting is manual/editor-driven
- TypeScript strict mode enabled (`"strict": true` in `tsconfig.json`)
- ES2022 target, ESNext modules
- Trailing commas used consistently in multi-line structures
- Single quotes for string literals in TypeScript/TSX

**TypeScript config (`tsconfig.json`):**
- `strict: true` — enables all strict checks
- `isolatedModules: true` — each file is treated as an isolated module
- `forceConsistentCasingInFileNames: true`
- `moduleResolution: "bundler"` (Vite-native resolution)
- No path aliases defined

## Import Organization

**Order (observed pattern):**
1. React core imports (`import { useState, useEffect } from 'react'`)
2. Internal project imports — context, hooks, utils, wasm (`../context/...`, `../hooks/...`, `../wasm/...`)
3. Type-only imports last using `import type` syntax (`import type { GlassPanelProps } from './types'`)

**Path Aliases:**
- None configured — all imports use relative paths

**Type Imports:**
- Always use `import type` for type-only imports — `import type { GlassButtonProps } from './types'`
- Mixed value+type imports split: value imports first, then `import type` separately

## Error Handling

**Patterns:**
- Hook context guard: throw descriptive `Error` with usage instruction when used outside provider
  ```typescript
  // src/hooks/useGlassEngine.ts
  if (!ctx) {
    throw new Error('useGlassEngine must be used within a <GlassProvider>');
  }
  ```
- Precondition checks with early return (no throw):
  ```typescript
  // src/wasm/loader.ts
  if (!navigator.gpu) {
    throw new Error('WebGPU is not supported in this browser. Use Chrome 113+ or Edge 113+.');
  }
  ```
- Async error handling via `.catch()` with `console.error`:
  ```typescript
  // src/components/GlassProvider.tsx
  initEngine().then(async module => { ... }).catch(err => {
    console.error('GlassProvider: engine init failed', err);
  });
  ```
- Cancelled async operations: local `cancelled` boolean flag, checked after `await`
- Engine handle null checks: `if (!handle) return;` before any engine call
- Try/catch for feature detection (ResizeObserver box option fallback):
  ```typescript
  try {
    observer.observe(canvas, { box: 'device-pixel-content-box' });
  } catch {
    observer.observe(canvas, { box: 'content-box' });
  }
  ```

## Logging

**Framework:** `console` (no logging library)

**Patterns:**
- `console.error` used for engine initialization failures in `GlassProvider`
- `console.log` appears only in example/demo code (JSDoc examples, `App.tsx` onClick handlers)
- No debug/info logging in library source paths
- Error messages prefixed with component name: `'GlassProvider: engine init failed'`

## Comments

**When to Comment:**
- JSDoc on every exported function and interface with `/** ... */` blocks
- Inline `// comment` for non-obvious logic (shader uniform offsets, rAF loop, accessibility branches)
- Section-separator comments in longer components — `// Initialize WASM engine`, `// ResizeObserver for canvas`
- Suppress comments always include reason: `// @ts-expect-error -- Emscripten generated module, no type declarations`
- ESLint disable comments inline with reason: `// eslint-disable-line react-hooks/exhaustive-deps`

**JSDoc/TSDoc:**
- All exported interfaces and their fields documented with `/** ... */`
- `@param` and `@returns` tags used in utility functions (`src/utils/contrast.ts`)
- `@example` code blocks included on component exports (`GlassPanel`, `GlassButton`, `GlassCard`)

## Function Design

**Size:** Functions are small and focused; the longest is `GlassProvider` (~148 lines) but it is a React component with multiple `useEffect` hooks, each with a clear comment header

**Parameters:**
- Destructured props at the top of component functions
- Default parameter values set inline in destructuring — `cornerRadius = 16`, `type = 'button'`
- Rest props captured with `...rest` and spread onto the DOM element

**Return Values:**
- Hooks returning single value return it directly
- Hooks returning multiple values return a plain object (not array)
- Nullable returns typed explicitly — `GlassRegionHandle | null`

## Module Design

**Exports:**
- All public surface area exported from `src/index.ts` — components, types, hooks
- Named exports only; no default exports in library code (default exports only in `App.tsx` entry points)
- Type re-exports use `export type { ... }` syntax

**Barrel Files:**
- Single barrel at `src/index.ts` — exports components, types, and hooks with section comments
- No nested barrel files; each module imports directly from its source file

## Component Design Patterns

**Ref Forwarding:**
- All glass components accept `ref` as a prop (React 19 pattern — no `forwardRef` wrapper needed)
- Internal ref created with `useRef`, merged with consumer ref via `useMergedRef`
  ```typescript
  const internalRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRef(internalRef, ref);
  ```

**Style Application:**
- Inline styles used exclusively — no CSS files, no CSS modules, no utility classes
- Component provides base styles; consumer `style` prop spread last to allow overrides
  ```typescript
  style={{ position: 'relative', background: 'transparent', ...style }}
  ```

**Accessibility-Aware Rendering:**
- All components call `useGlassEngine()` to access `preferences.darkMode`
- Text color and text shadow adapt to dark/light mode via a ternary `textStyles` object
- Glass effects disabled automatically via `useGlassRegion` when `reducedTransparency` is set

**Context Usage:**
- `GlassContext` typed as `createContext<GlassContextValue | null>(null)` — null default
- Access always through `useGlassEngine()` hook which throws if called outside provider
- Never consume `GlassContext` directly in components — always go through the hook

---

*Convention analysis: 2026-02-25*

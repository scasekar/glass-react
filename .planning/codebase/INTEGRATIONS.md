# External Integrations

**Analysis Date:** 2026-02-25

## APIs & External Services

**None.** This is a self-contained browser library. It does not call any external HTTP APIs or cloud services at runtime.

## Data Storage

**Databases:**
- None. No database client or ORM present.

**File Storage:**
- None. No file storage service used.

**Caching:**
- None. No caching layer present.

## Authentication & Identity

**Auth Provider:**
- None. No authentication system present.

## Browser APIs (Runtime Dependencies)

The library integrates directly with the following browser-native APIs:

**WebGPU API (`navigator.gpu`):**
- Used by: `src/wasm/loader.ts` (guarded check before WASM init), `engine/src/main.cpp` (GPU device/surface setup)
- Required: Chrome 113+, Edge 113+
- Error thrown: `'WebGPU is not supported in this browser. Use Chrome 113+ or Edge 113+.'`

**ResizeObserver API:**
- Used by: `src/components/GlassProvider.tsx`
- Purpose: Detects canvas size changes to resize the GPU surface; prefers `device-pixel-content-box`, falls back to `content-box`

**requestAnimationFrame API:**
- Used by: `src/components/GlassProvider.tsx`
- Purpose: Per-frame position sync loop that maps DOM element rects to normalized GPU coordinates

**matchMedia API:**
- Used by: `src/hooks/useAccessibilityPreferences.ts`
- Queries:
  - `(prefers-reduced-motion: reduce)` — pauses the C++ animation loop
  - `(prefers-reduced-transparency: reduce)` — signals opaque mode to engine
  - `(prefers-color-scheme: dark)` — adapts text color/shadow in components

**WebAssembly (WASM):**
- Used by: `src/wasm/loader.ts`
- WASM module loaded via dynamic `import('../../engine/build-web/engine.js')`
- The Emscripten-generated module (`engine.js`) is `SINGLE_FILE=1` (WASM embedded as base64); no separate `.wasm` file fetch

## Monitoring & Observability

**Error Tracking:**
- None. No external error tracking service (e.g., Sentry) present.

**Logs:**
- C++ engine errors written to `console.error` via `std::cerr` (Emscripten maps to browser console)
- React `GlassProvider` catches engine init failures with `console.error('GlassProvider: engine init failed', err)`

## CI/CD & Deployment

**Hosting:**
- Not detected. No hosting platform config present.

**CI Pipeline:**
- Not detected. No `.github/workflows/`, `.circleci/`, or similar CI config found.

## Environment Configuration

**Required env vars:**
- None. The library requires no environment variables at runtime or build time.

**Secrets location:**
- Not applicable. No secrets required.

## Webhooks & Callbacks

**Incoming:**
- None.

**Outgoing:**
- None.

## npm Publishing

**Registry:**
- Standard npm registry (no custom `.npmrc` detected)
- Package name: `liquidglass-react` (from `package.json`)
- Entry: `dist/index.js` (ESM only)
- Types: `dist/index.d.ts`
- `prepublishOnly` script runs `npm run build` (WASM build + library build)

---

*Integration audit: 2026-02-25*

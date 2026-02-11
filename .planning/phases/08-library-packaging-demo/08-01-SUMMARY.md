---
phase: 08-library-packaging-demo
plan: 01
subsystem: packaging
tags: [vite, library-mode, esm, wasm, npm, emscripten, single-file, dts]

# Dependency graph
requires:
  - phase: 07-visual-polish
    provides: "Complete glass components with all visual effects"
provides:
  - "npm-publishable ESM library bundle with embedded WASM"
  - "TypeScript type declarations for all public API"
  - "Barrel export (src/index.ts) for library entry point"
  - "Vite library mode build configuration"
  - "package.json configured for npm distribution"
affects: [08-02-demo-app]

# Tech tracking
tech-stack:
  added: [vite-plugin-dts]
  patterns: [vite-library-mode, single-file-wasm, peer-dependencies, barrel-export]

key-files:
  created:
    - src/index.ts
    - tsconfig.lib.json
  modified:
    - engine/CMakeLists.txt
    - vite.config.ts
    - package.json
    - package-lock.json

key-decisions:
  - "SINGLE_FILE=1 embeds WASM as base64 in engine.js (~674KB) eliminating separate .wasm file distribution"
  - "Vite config uses command+mode conditional: build (default) = library, build --mode demo = app, dev = dev server"
  - "React/ReactDOM moved to peerDependencies (^18 || ^19) with devDependencies for development"

patterns-established:
  - "Library build: npm run build:lib produces dist/index.js + dist/index.d.ts"
  - "Demo build: --mode demo flag to distinguish from library build"
  - "Barrel export pattern: src/index.ts re-exports all public components, types, and hooks"

# Metrics
duration: 2min
completed: 2026-02-10
---

# Phase 08 Plan 01: Library Packaging Summary

**Vite library-mode ESM bundle with SINGLE_FILE-embedded WASM, barrel exports, and npm-ready package.json**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-11T00:17:33Z
- **Completed:** 2026-02-11T00:19:56Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- WASM binary embedded in engine.js via Emscripten SINGLE_FILE=1 (no separate .wasm file to distribute)
- Vite library mode produces ESM bundle (~11KB code + ~639KB engine) with React externalized
- TypeScript declarations generated via vite-plugin-dts for full consumer type safety
- package.json properly configured with exports, peerDependencies, files whitelist for clean npm publishing
- npm pack produces ~203KB package containing only dist/ files

## Task Commits

Each task was committed atomically:

1. **Task 1: Configure SINGLE_FILE build and create library entry point** - `57d8356` (feat)
2. **Task 2: Configure Vite library mode and package.json for npm distribution** - `48f0eb3` (feat)

## Files Created/Modified
- `engine/CMakeLists.txt` - Added -sSINGLE_FILE=1 to embed WASM in JS
- `src/index.ts` - Library barrel export for all public components, types, and hooks
- `tsconfig.lib.json` - Library-specific TypeScript config with declaration emit
- `vite.config.ts` - Dual-mode config: library build (default) and dev server
- `package.json` - npm distribution fields (exports, peerDependencies, files, build:lib script)
- `package-lock.json` - Updated with vite-plugin-dts dependency

## Decisions Made
- **SINGLE_FILE=1 for WASM embedding:** Eliminates the "locate .wasm file" problem entirely. The ~674KB engine.js contains base64-encoded WASM, bundled into dist as a separate chunk (~639KB). Total library package is ~203KB gzipped.
- **Conditional Vite config:** Uses `command === 'build' && mode !== 'demo'` to distinguish library build from dev server and future demo build. This preserves the existing dev workflow while adding library packaging.
- **React ^18 || ^19 peer range:** Broadens compatibility beyond the project's own React 19 without testing burden.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- vite-plugin-dts reports TS2339 for `navigator.gpu` in loader.ts (missing WebGPU types). This is a type-level warning only; declarations are still generated correctly and the runtime check works. Could be resolved by installing `@webgpu/types` in a future plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Library build produces clean dist/ with ESM + declarations
- Ready for Plan 08-02 (demo app) to consume the library and validate the package
- The engine.js with embedded WASM is correctly bundled as a separate chunk

## Self-Check: PASSED

All 7 key files verified present. Both task commits (57d8356, 48f0eb3) verified in git log.

---
*Phase: 08-library-packaging-demo*
*Completed: 2026-02-10*

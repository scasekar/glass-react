# Codebase Concerns

**Analysis Date:** 2026-02-25

## Tech Debt

**`morphSpeed` silently dropped in GlassPanel and GlassCard:**
- Issue: `GlassPanel` and `GlassCard` destructure all `GlassStyleProps` fields except `morphSpeed`, which lands in `...rest` and gets spread onto the DOM element as an invalid HTML attribute. `useGlassRegion` is called without `morphSpeed`, so it always defaults to `8` in those components regardless of what the caller passes.
- Files: `src/components/GlassPanel.tsx` (line 32, 38), `src/components/GlassCard.tsx` (line 33, 39)
- Impact: `<GlassPanel morphSpeed={0} />` silently ignores the prop — no animation snap, no error. The demo (`demo/App.tsx` line 72, 129) passes `morphSpeed` to both components, so this bug is active in the shipped demo.
- Fix approach: Destructure `morphSpeed` explicitly in both components (alongside the other `GlassStyleProps` fields) and forward it in the `useGlassRegion` call object.

**`setReducedTransparency` wired in C++ but never called from JS:**
- Issue: `BackgroundEngine::setReducedTransparency()` is exported via Embind and typed in `src/wasm/loader.ts` (line 15), but `GlassProvider` never calls it. The C++ field `reducedTransparency_` is always `false`. The React side handles reduced-transparency via `useGlassRegion` by swapping parameters, so C++ is a no-op dead code path for this feature.
- Files: `engine/src/background_engine.h` (line 98), `engine/src/background_engine.cpp` (line 293), `src/wasm/loader.ts` (line 15), `src/components/GlassProvider.tsx`
- Impact: Not a functional bug (React handles it correctly), but dead API surface creates confusion about where the feature lives. Also a maintenance risk — a future developer may assume C++ handles this and not update the React side.
- Fix approach: Either call `engine.setReducedTransparency(prefs.reducedTransparency)` in `GlassProvider`'s `prefs.reducedMotion` effect (lines 70-74), or remove the C++ method and the TS type declaration.

**Two `wgpu::Instance` objects created in C++ device init path:**
- Issue: `main()` calls `wgpu::CreateInstance()` to obtain an instance for `RequestAdapter`, then `OnDeviceAcquired()` calls `wgpu::CreateInstance()` a second time to create the surface. Each Dawn instance has independent state; the adapter from the first instance is stored in `g_adapter` but queried against a surface from the second instance in `surface.GetCapabilities(g_adapter, &capabilities)`.
- Files: `engine/src/main.cpp` (line 49 and 97)
- Impact: Works in current Dawn/emdawnwebgpu builds but is technically incorrect. Mixing resources across instances can cause silent failures in future WebGPU spec updates or different Dawn versions. The project memory notes a prior bug where a second `WaitAny` corrupted the instance reference.
- Fix approach: Store the first instance in a global (like `g_adapter`) so `OnDeviceAcquired` reuses it for surface creation rather than allocating a new one.

**`-sASSERTIONS=1` left on in production build:**
- Issue: `engine/CMakeLists.txt` (line 26) enables Emscripten assertions in the output that is committed to `dist/` and shipped to users. Assertions add runtime overhead (bounds checks, type validation) and produce verbose debug output that slows the engine and increases bundle size.
- Files: `engine/CMakeLists.txt` (line 26)
- Impact: Minor performance overhead per WASM call. Emitted assertion strings inflate the already large `engine.js`.
- Fix approach: Wrap in a CMake `if(CMAKE_BUILD_TYPE STREQUAL "Debug")` block, or use `-sASSERTIONS=0` for release builds. Add a separate `build:wasm:release` script in `package.json`.

**No `ASYNCIFY_ONLY` restriction despite ASYNCIFY being enabled:**
- Issue: `-sASYNCIFY=1` in `CMakeLists.txt` (line 19) instruments the entire WASM binary for async/await support. Without `ASYNCIFY_ONLY`, every function in the call graph is instrumented, inflating binary size significantly (the research doc `PITFALLS.md` notes 80%+ increase). The built `engine/build-web/engine.js` is already 658 KB (minified + SINGLE_FILE with WASM inlined).
- Files: `engine/CMakeLists.txt` (lines 19-28)
- Impact: Increased download size and instantiation time. Users on slow connections see a longer blank screen before the glass effect appears.
- Fix approach: Add `-sASYNCIFY_ONLY=["RequestAdapter","RequestDevice"]` or switch to `-sJSPI=1` (available in modern Chrome/Emscripten) which avoids binary transformation entirely. Also add `wasm-opt -O3` as a post-build step in `build:wasm` npm script.

**eslint-disable on `registerRegion` dependency array:**
- Issue: `registerRegion` `useCallback` in `GlassProvider.tsx` (line 118) is commented `// eslint-disable-line react-hooks/exhaustive-deps` with only `[ready]` in the dependency array, despite the closure capturing `moduleRef`. This suppresses a legitimate warning: the callback captures `moduleRef.current` via `moduleRef.current?.getEngine()`, which is a ref (stable reference) but the suppression hides the intent.
- Files: `src/components/GlassProvider.tsx` (line 118)
- Impact: The current behavior is correct because `moduleRef` is a stable ref and not a dependency. However, suppressing the lint rule without a comment explaining why makes this fragile — a future refactor that changes `moduleRef` to a state variable would silently break the dependency.
- Fix approach: Add an inline comment explaining why `moduleRef` is intentionally excluded: `// moduleRef is a stable ref, not a reactive value`.

## Known Bugs

**`GlassPanel` and `GlassCard` pass `morphSpeed` via `...rest` onto DOM element:**
- Symptoms: React renders `<div morphSpeed="8" ...>` in the DOM, producing an invalid HTML attribute warning in the browser console.
- Files: `src/components/GlassPanel.tsx` (line 32, 61), `src/components/GlassCard.tsx` (line 33, 62)
- Trigger: Any usage of `<GlassPanel morphSpeed={n}>` or `<GlassCard morphSpeed={n}>`.
- Workaround: Do not pass `morphSpeed` to `GlassPanel`/`GlassCard` (they ignore it anyway). Only `GlassButton` handles it correctly.

**Engine init polling loop has no timeout or error state:**
- Symptoms: If WebGPU device acquisition fails silently (e.g., hardware not available, browser bug), the `while (!module.getEngine())` loop in `GlassProvider.tsx` (lines 20-23) polls indefinitely at 50ms intervals with no timeout. The component stays in `ready=false` state forever with no user-visible error and no way for the consumer to detect the failure.
- Files: `src/components/GlassProvider.tsx` (lines 16-36)
- Trigger: WebGPU adapter or device request fails after module loads (rare, but possible on some hardware/driver combinations).
- Workaround: None currently exposed. The `catch` on line 26 catches `initEngine()` rejections (e.g., no `navigator.gpu`) but not silent polling timeouts.

## Security Considerations

**Hardcoded canvas selector `#gpu-canvas` in C++ engine:**
- Risk: The canvas element ID `"#gpu-canvas"` is hardcoded in the C++ source at `engine/src/main.cpp` (line 53). If a page has another element with this ID, or if the library is instantiated multiple times, the wrong canvas may be selected for the WebGPU surface.
- Files: `engine/src/main.cpp` (line 53), `src/components/GlassProvider.tsx` (line 134)
- Current mitigation: `GlassProvider` also uses `id="gpu-canvas"` hardcoded (line 134), so they match as long as only one `GlassProvider` is mounted.
- Recommendations: Either make the canvas selector configurable via an Embind parameter, or remove the `id` from the canvas and use a different surface attachment mechanism. Multiple `GlassProvider` instances on one page will conflict silently.

**No input validation on C++ region ID at WASM boundary:**
- Risk: Every `BackgroundEngine` method accepts an `int id` from JavaScript. The C++ guards against out-of-range IDs (`id < 0 || id >= MAX_GLASS_REGIONS`) but this is the only validation. Embind accepts any JS number; a NaN or Infinity passed from JS would become an implementation-defined integer in C++.
- Files: `engine/src/background_engine.cpp` (lines 420-472), `src/components/GlassProvider.tsx` (lines 104-114)
- Current mitigation: Region IDs are only generated by `addGlassRegion()` (returns `int`), so in normal usage they are always valid. The risk is only relevant if the public API (`useGlassRegion`) is called with forged handles.
- Recommendations: Low priority. The API is not exposed to end-users directly; the handle is internal.

## Performance Bottlenecks

**rAF position sync loop iterates all registered regions every frame unconditionally:**
- Problem: `GlassProvider.tsx` (lines 78-97) runs `getBoundingClientRect()` on every registered region's DOM element every animation frame (~60fps), even when elements haven't moved. `getBoundingClientRect()` forces layout recalculation if any DOM mutation is pending.
- Files: `src/components/GlassProvider.tsx` (lines 78-97)
- Cause: No dirty-flag or `IntersectionObserver` to skip static elements. At 16 regions (max), this is 17 layout queries per frame (canvas + 16 elements).
- Improvement path: Cache the previous rect per region, only call `updateRect` when dimensions change. Use `IntersectionObserver` for visibility-based pausing. For regions inside fixed-position containers, a single initial measurement suffices.

**25-tap Gaussian blur runs on every fragment for every glass region per frame:**
- Problem: The glass fragment shader in `engine/src/shaders/glass.wgsl.h` (lines 105-114) runs a 5x5 Gaussian blur (25 texture samples) for every pixel covered by any glass region, every frame. With 16 regions at 4K resolution, this is a substantial fill rate cost.
- Files: `engine/src/shaders/glass.wgsl.h` (lines 98-114)
- Cause: The blur is computed inline in the fragment shader. There is no pre-computed mip chain or separate blur pass.
- Improvement path: Use a two-pass separable Gaussian (5+5 = 10 samples instead of 25) via a blur ping-pong texture, or downsample the offscreen texture before sampling. Mip-map the offscreen texture and use `textureSampleLevel` for large blur radii.

**WASM binary inlined as base64 in `engine.js` (SINGLE_FILE=1):**
- Problem: `-sSINGLE_FILE=1` in `CMakeLists.txt` (line 27) base64-encodes the WASM binary and inlines it into `engine.js`. The resulting file is 658 KB. Base64 encoding adds ~33% overhead vs a separate `.wasm` file, and inlining prevents the browser from using streaming WASM instantiation (`WebAssembly.instantiateStreaming`), which is ~1.8x faster than standard instantiation.
- Files: `engine/CMakeLists.txt` (line 27), `engine/build-web/engine.js` (658 KB)
- Cause: `SINGLE_FILE` simplifies deployment (one file to import) but sacrifices streaming and adds size.
- Improvement path: Remove `-sSINGLE_FILE=1` and ship `engine.js` + `engine.wasm` separately. Update `src/wasm/loader.ts` to serve the WASM with correct `Content-Type: application/wasm` headers. Vite's `vite-plugin-wasm` already handles this.

## Fragile Areas

**Engine init polling `while (!module.getEngine())` is timing-dependent:**
- Files: `src/components/GlassProvider.tsx` (lines 20-23)
- Why fragile: The 50ms polling interval works because WebGPU adapter+device acquisition typically resolves within a few hundred milliseconds. This is an empirical assumption. If browser WebGPU implementation becomes slower (e.g., on lower-end hardware or under memory pressure), more polls are needed, extending the `ready=false` window during which glass components silently render without any effect.
- Safe modification: Do not reduce the polling interval below 50ms. Do not assume `getEngine()` will return non-null within any specific number of polls.
- Test coverage: No test coverage. Untested against slow GPU acquisition.

**`useGlassRegion` second effect depends on `handleRef.current` which is set by first effect:**
- Files: `src/hooks/useGlassRegion.ts` (lines 39-121)
- Why fragile: The first `useEffect` (lines 39-50) sets `handleRef.current` when `ctx.ready` becomes true. The second `useEffect` (lines 53-121) reads `handleRef.current` to sync params. Both have `ctx.ready` in their dependency arrays indirectly (through `ctx`). If React batches both effects in the same commit, the second effect may fire before the first has run, reading `null` from `handleRef.current` and silently skipping the initial param sync.
- Safe modification: When props change before `ctx.ready` becomes true, the second effect exits early (correct). After engine is ready, both effects fire — React guarantees effects run in order within a component, so the registration effect runs before the sync effect. This is safe in current React but depends on single-component effect ordering guarantee.
- Test coverage: None.

**`GlassProvider` canvas element has no z-index isolation from consumer CSS:**
- Files: `src/components/GlassProvider.tsx` (lines 133-145)
- Why fragile: The canvas uses `zIndex: -1` with `position: fixed`. Consumer CSS that sets `transform`, `filter`, or `will-change` on an ancestor element creates a new stacking context, which can put the canvas above or below the wrong layers, breaking the glass visual effect.
- Safe modification: Document that parent elements of `GlassProvider` must not have CSS properties that create a stacking context.
- Test coverage: None.

## Scaling Limits

**Hard cap of 16 glass regions (`MAX_GLASS_REGIONS = 16`):**
- Current capacity: 16 concurrent glass components (`engine/src/background_engine.h` line 29)
- Limit: The 17th `<GlassPanel>`, `<GlassButton>`, or `<GlassCard>` mounted on a page will receive `id = -1` from `addGlassRegion()`. `registerRegion` returns `null`, `handleRef.current` stays `null`, and the component renders with no glass effect but also no error.
- Scaling path: Increase `MAX_GLASS_REGIONS` (GPU uniform buffer is pre-allocated for all slots, so increasing requires a rebuild). Or dynamically allocate regions and resize the uniform buffer on demand.

**Noise background renders at full canvas resolution every frame regardless of motion:**
- Current capacity: Background noise pass (Pass 1) runs the full fBM 6-octave simplex noise shader for every pixel every frame, even when `paused_` is true.
- Limit: At 4K (3840×2160), Pass 1 processes ~8.3 million pixels per frame. The noise is animated (time-driven), so pausing stops animation but not the render itself — `render()` is called unconditionally from `MainLoop()`.
- Scaling path: Skip Pass 1 when paused (only render Pass 2 from the last offscreen texture). Add a dirty flag to avoid rerendering when no region params changed and time is paused.

## Dependencies at Risk

**`emdawnwebgpu` is a port-based dependency with no version pinning:**
- Risk: `--use-port=emdawnwebgpu` in `CMakeLists.txt` (lines 14, 15) fetches the port based on the installed Emscripten version (currently 4.0.16). The port API is not stable — the project memory records multiple breaking API changes (`SurfaceSourceCanvasHTMLSelector` → `EmscriptenSurfaceSourceCanvasHTMLSelector`, `wgpu::StringView` not streamable). Future Emscripten upgrades may silently break the build.
- Impact: Build fails on Emscripten upgrade; no npm lockfile equivalent for the C++ dependency.
- Migration plan: Pin to a specific Emscripten version in `.nvmrc`-equivalent or a `Dockerfile`. Document the minimum required version (`>= 4.0.10`) in the README.

**`vite-plugin-wasm` and `vite-plugin-top-level-await` are not in `peerDependencies`:**
- Risk: Both plugins (`package.json` lines 42-44) are in `devDependencies`. When users install `liquidglass-react` as an npm package, they must configure their own Vite setup to support WASM imports and top-level await. This is not documented as a peer requirement, so consumer projects may see cryptic Vite build errors.
- Impact: Library unusable without additional Vite configuration that the library does not document as required.
- Migration plan: Add to `peerDependencies` or `peerDependenciesMeta` with `optional: true`, and document required Vite plugin setup in the README/API.md.

## Missing Critical Features

**No WebGPU unsupported fallback UI:**
- Problem: When `navigator.gpu` is absent (Firefox < 141, Safari < 26, most mobile browsers), `initEngine()` throws an error (`src/wasm/loader.ts` line 22). `GlassProvider` catches it (`GlassProvider.tsx` line 26-27) and logs to console, but renders `children` without any visual indication that glass is unavailable. Glass components render as transparent overlays with no background effect — invisible on dark backgrounds, confusing on light ones.
- Blocks: Library usability on non-WebGPU browsers.

**No loading state exposed to consumers:**
- Problem: During WASM load and GPU init (typically 200ms–2s), `GlassProvider` renders children with `ready=false`. Glass components are mounted but have no effect (they render transparent divs). The library provides no `onReady`, `onError`, or `loading` slot for consumers to show a skeleton or fallback.
- Blocks: Preventing layout shift / flash of invisible content during init.

## Test Coverage Gaps

**Zero unit or integration tests:**
- What's not tested: All React components, all custom hooks, the WASM loader, the contrast utilities, the accessibility preference hook.
- Files: `src/components/`, `src/hooks/`, `src/utils/contrast.ts`, `src/wasm/loader.ts`
- Risk: Regressions in parameter handling (e.g., the `morphSpeed` bug above) are invisible until visually spotted. The `contrast.ts` utility functions are pure and easily testable but have no tests.
- Priority: High — `contrast.ts` and `useAccessibilityPreferences` should be the first test targets (pure logic, no WebGPU dependency).

**Playwright is installed but no test files exist:**
- What's not tested: End-to-end rendering, glass effect appearance, resize behavior, accessibility preference detection.
- Files: `package.json` (line 36 — `playwright` in `devDependencies`), no `tests/` or `e2e/` directory exists.
- Risk: Glass effect correctness (blur, refraction, aberration) cannot be verified programmatically. No regression detection for shader changes.
- Priority: Medium — at minimum, a smoke test that loads the demo and verifies the canvas renders non-zero pixels.

**No tests for the 16-region limit overflow path:**
- What's not tested: Behavior when `addGlassRegion()` returns `-1` (all slots full). The JS handle returns `null`, the component silently renders without glass.
- Files: `src/components/GlassProvider.tsx` (line 103), `engine/src/background_engine.cpp` (line 417)
- Risk: Silent rendering failure with no console error when >16 components are mounted. Users see no glass effect and have no diagnostic information.
- Priority: Low — cover with a unit test that mounts 17 `<GlassPanel>` components and asserts graceful degradation.

---

*Concerns audit: 2026-02-25*

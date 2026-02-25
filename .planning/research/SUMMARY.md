# Project Research Summary

**Project:** LiquidGlass-React-WASM — v2.0 Visual Parity Milestone
**Domain:** WebGPU/WASM glass effect component library — image backgrounds, shader tuning, automated visual diffing
**Researched:** 2026-02-25
**Confidence:** MEDIUM-HIGH (image background texture pipeline and headless WebGPU capture have known unknowns; core WebGPU patterns and architecture are HIGH confidence)

## Executive Summary

The v2.0 milestone has a clear goal: achieve visual parity between this library's WebGPU glass rendering and Apple's native SwiftUI `.glassEffect()` modifier, using a structured pipeline of image backgrounds, parameter tuning, and automated screenshot comparison. The architecture is well-defined and builds directly on the existing v1.0 two-pass render pipeline (noise pass -> offscreen texture -> glass composite pass). The core changes are surgical: add image loading to Pass 1, expose three hardcoded shader constants as uniforms (using existing padding slots — no struct size change), build a SwiftUI reference app in a separate Xcode project, and construct a Playwright + pixelmatch diff pipeline to measure the gap.

The recommended approach is to execute in dependency order: image backgrounds first (it unlocks the comparison workflow), shader parameter exposure in parallel (orthogonal change), the SwiftUI reference app in parallel (no code dependencies), then the diff pipeline, then manual tuning to parity. The key technology additions are minimal: JS-side `createImageBitmap` + `copyExternalImageToTexture` for image loading (no new libraries), `leva` as a dev-only tuning UI, and `pixelmatch` + `pngjs` for the diff pipeline. No production dependencies change.

The primary risks cluster around three areas: (1) color space and format mismatches when introducing image textures — sRGB/linear handling, BGRA vs RGBA format, premultiplied alpha, and the `RENDER_ATTACHMENT` usage flag requirement must all be addressed simultaneously and in the correct order; (2) the iOS Simulator has a confirmed bug in iOS 26.0-26.0.1 where `.glassEffect()` renders correctly in the simulator but appears dark on physical hardware — use the simulator as the reference target and document this limitation prominently; (3) WebGPU canvas screenshot capture in headless Playwright is documented but potentially flaky and must be validated early. The current 5x5 Gaussian blur kernel cannot be made to exactly match Apple's multi-pass blur quality through parameter tuning alone — this is a known structural gap that should be acknowledged and excluded from the initial convergence target.

## Key Findings

### Recommended Stack

The existing stack (Emscripten 4.0.16, emdawnwebgpu, React 19, Vite 6, C++20) is unchanged for v2.0. New additions are all dev-dependencies. Image loading uses the browser's native `createImageBitmap` + JS-side OffscreenCanvas decode to extract RGBA pixels, which are then passed to C++ via WASM heap for `queue.WriteTexture()`. This avoids `stb_image` in C++ (slower, larger binary) and sidesteps the `copyExternalImageToTexture` C++ binding gap — that API does not exist in emdawnwebgpu, confirmed as "not planned" in Emscripten issue #18190. The SwiftUI reference app requires Xcode 26.2 and iOS 26 — `.glassEffect()` is only available on iOS 26+.

**Core technology additions:**
- `leva ^0.10.1` (devDependency): React-native shader parameter tuning UI — purpose-built for real-time parameter adjustment, same pmndrs ecosystem as react-three-fiber. React 19 peer dep warnings from radix-ui are cosmetic and functional. Install with `--legacy-peer-deps` if needed.
- `pixelmatch ^7.1.0` + `pngjs ^7.0.0` (devDependency): Cross-platform pixel diff pipeline — zero-dependency, deterministic, fast (<50ms for 1280x720), works on raw RGBA typed arrays. Preferred over Playwright's built-in `toHaveScreenshot()` because this is a cross-platform comparison (web vs iOS), not same-source regression testing.
- `Xcode 26.2` + SwiftUI iOS 26 (build tool): The ONLY way to capture authentic `.glassEffect()` output. Any cross-platform layer would approximate, not replicate.
- `xcrun simctl io screenshot` (CLI): Stable since Xcode 8.2, no Xcode UI test boilerplate needed.

**Libraries explicitly NOT added:** `stb_image` in C++ (browser decode is hardware-accelerated and avoids WASM heap round-trip), `odiff` (FEATURES.md mentions it but pixelmatch is sufficient and already fits the cross-platform pattern), `sharp` (overkill for crop/resize in diff script; simple canvas-based resize is sufficient), `dat.gui`/`lil-gui`/Tweakpane (unmaintained or vanilla-JS wrappers; leva is React-native).

### Expected Features

**Must have (table stakes for v2.0):**
- Image background rendering with cover/contain fit modes and bundled default wallpaper (~100-200KB JPEG/WebP)
- Toggle between noise mode (v1.0, no regression) and image mode via `backgroundMode: 'noise' | 'image'` prop on GlassProvider
- sRGB-correct texture handling throughout the image pipeline (textures as `rgba8unorm-srgb`, linear space in shader math)
- All glass uniforms exposed as React props — verify no remaining hardcoded constants in the shader
- Expose three currently-hardcoded shader constants: `contrast` (0.85), `saturation` (1.4), and `blurRadius` (30 texels) — fits exactly into the three existing padding floats in the 80-byte GlassUniforms struct, no struct size change
- Real-time slider controls in demo app for all parameters, grouped sections, reset to defaults
- SwiftUI reference app with `.regular` and `.clear` glass variants over the same wallpaper
- Screenshot capture from WebGPU canvas via Playwright
- iOS Simulator screenshot capture via `xcrun simctl io booted screenshot`
- Pixel-diff comparison with diff image output and mismatch percentage

**Should have (differentiators):**
- Named presets (Apple Standard, Apple Prominent) for one-click comparison starting points
- Export/import parameter config as JSON (enables the auto-tuning loop)
- Mipmap generation for background texture (eliminates shimmer at larger blur radii; increases VRAM by ~33%; requires manual mipmap downsample chain in WebGPU)
- Region-of-interest masking in the diff pipeline (compare only the glass panel area, not background rendering differences)
- SSIM perceptual scoring alongside pixel diff for better quality metrics
- Dark mode and light mode reference screenshots from the SwiftUI app
- Image drag-and-drop / file picker in demo app for quick wallpaper swapping during comparison sessions

**Defer to v2.1 or v3:**
- Dual Kawase blur (high complexity; current 25-tap Gaussian with mipmaps may be acceptable)
- Automated convergence loop with coordinate descent (needs well-tuned manual parameters first)
- CI visual regression (build after manual parity is achieved and committed)
- A/B split-screen parameter comparison in tuning UI
- Undo/redo for parameter changes
- Real-time video backgrounds, content-blur over DOM, nested glass compositing, gyroscope interaction

**Key parameter gaps vs Apple reference (community-estimated, MEDIUM confidence):**
- Current blur radius (~15px effective at default 0.5) is too low — Apple's `.regular` uses ~20-30px effective
- Current chromatic aberration (3.0px) is too strong — Apple uses ~1-2px
- Current rim intensity (0.15) is too strong — Apple uses ~0.05-0.10
- Current refraction (0.15) is slightly too strong — Apple uses ~0.05-0.10
- Missing entirely: Fresnel IOR/exponent, environment reflection strength, glare direction angle

### Architecture Approach

The v2.0 architecture extends the existing two-pass WebGPU pipeline minimally. Pass 1 becomes dual-mode: run the noise shader when `backgroundMode == Noise` (unchanged), or blit a loaded image texture when `backgroundMode == Image`. Pass 1 can be skipped entirely in image mode when the offscreen texture has not changed (major GPU savings — the 6-octave simplex fBM is the most expensive pass). Pass 2 (glass compositing) is unchanged except for replacing three padding floats in the 80-byte GlassUniforms struct with `contrast`, `saturation`, and `blurRadius` fields — no struct size change, no pipeline recreation, no impact on dynamic offset alignment.

The image loading boundary is strictly JS-to-C++: JavaScript decodes the image via `createImageBitmap` + OffscreenCanvas, extracts raw RGBA bytes, passes them to C++ via WASM heap for `queue.WriteTexture()`. The new `TuningPanel` component lives in the demo app only, never in the library package. The SwiftUI reference app is a completely separate Xcode project outside the glass-react repo.

**Major components:**
1. `BackgroundEngine` (C++) — gains `BackgroundMode` enum, `imageTexture` (persistent GPU texture), `imageBlitPipeline`, `loadBackgroundImage(w, h, rgba*, len)`, `setBackgroundMode(int)`, and conditional Pass 1 skip when `!imageDirty`
2. `GlassUniforms` (C++ struct + glass.wgsl) — three padding floats become `contrast`, `saturation`, `blurRadius`; WGSL replaces hardcoded constants with uniform reads
3. `GlassProvider` (React) — gains `backgroundSrc?: string` prop and JS-side image decode/upload; calls new Embind methods
4. `GlassStyleProps` (TypeScript interface) — gains `contrast?`, `saturation?`, `blurRadius?` flowing through `useGlassRegion` → `GlassRegionHandle` → Embind to engine
5. `TuningPanel` (demo app only) — standalone controls component with all shader params, JSON export/import, preset switching
6. SwiftUI Reference App (separate Xcode project) — minimal app: wallpaper + glass panel + glass button, same image asset as web demo
7. Diff Pipeline (Playwright + pixelmatch scripts) — captures both sources, normalizes to sRGB, crops to glass region, pixel comparison with diff image output

**Key patterns to follow:**
- Uniform extension via padding slots: use existing 3-float padding before any struct size change (176 bytes of headroom remain)
- Conditional Pass 1 skip: skip noise/image re-render when offscreen texture is already current
- JS-side image decode + C++ upload: `createImageBitmap` -> OffscreenCanvas -> RGBA bytes -> WASM heap -> `queue.WriteTexture()`
- URL-driven parameter injection for automated tuning: `?params=base64json` avoids rebuild/HMR cycles

### Critical Pitfalls

1. **sRGB vs linear color space mismatch (C1)** — Load image textures as `rgba8unorm-srgb` (not `rgba8unorm`) so `textureSample()` returns linear values automatically. All glass shader math (blur averaging, tint mixing, specular) must operate in linear space. Failing to do this means blur averages are gamma-encoded values — results appear darker than expected and visual comparison with iOS will never converge. Detect with a gray card test: 50% gray input must produce 50% gray output with zero glass effects applied.

2. **Image loading must stay in JS — not C++ (C4)** — `copyExternalImageToTexture` accepts browser-native `ImageBitmap` types that do not exist in C++. emdawnwebgpu does not expose this API (Emscripten issue #18190, closed "not planned"). If image loading code appears in a `.cpp` file, stop and redesign. Architecture: JS decodes, extracts RGBA bytes, passes byte array to C++ for `queue.WriteTexture()`.

3. **`RENDER_ATTACHMENT` usage flag required for image textures (C3)** — Despite the name "copy," `copyExternalImageToTexture` internally may use a render pass for color space conversion. Image textures must be created with `COPY_DST | TEXTURE_BINDING | RENDER_ATTACHMENT`. Validation rejects the call immediately with a clear error. Follow the same usage pattern as the existing offscreen texture.

4. **Surface format mismatch: `bgra8unorm` (canvas) vs `rgba8unorm` (image data) (C5)** — macOS Chrome returns `bgra8unorm` as the preferred canvas format (Metal/IOSurface requirement). External image data is always RGBA. Solution: standardize the offscreen texture on `rgba8unorm`, handle channel swizzle in the blit shader, and use a dedicated image-blit render pass in Pass 1 to normalize formats before the glass pass.

5. **SwiftUI `.glassEffect()` renders dark on physical device, correct in simulator (C6)** — Confirmed iOS 26.0-26.0.1 bug (Apple Developer Forums thread #814005). No code-level workaround. Use the iOS Simulator as the canonical reference target. Pin Xcode version and iOS Simulator runtime. Build the pipeline to be re-runnable when Apple releases a fix. Document this limitation prominently in the v2.0 release notes.

6. **iOS Simulator screenshots have unmanaged color profiles — P3 vs sRGB (C7)** — Pixel diffs against unmanaged color profiles produce 5-15% false differences on solid colors. Normalize both screenshots to sRGB before comparison: `sips --matchTo "/System/Library/ColorSync/Profiles/sRGB Profile.icc" screenshot.png`. Disable "Optimize Rendering for Window Scale" in the simulator. Must resolve this before any automated tuning — otherwise the optimizer chases color space artifacts instead of real shader differences.

7. **5x5 Gaussian blur cannot match Apple's multi-pass blur quality (M5)** — Structural limitation, not a parameter tuning gap. The current 25-tap single-pass kernel produces visible banding at larger radii. Apple likely uses Kawase or multi-pass blur. Acknowledge this: exclude blur-heavy interior regions from the initial diff loss function. Plan a separable Gaussian (horizontal + vertical passes for ~15-tap equivalent) as a future upgrade.

## Implications for Roadmap

The dependency graph is clear. Steps 1 and 2 (image engine and shader params) can run in parallel. Step 3 (SwiftUI reference) can run in parallel with steps 1-4. All other steps are sequential. This is a 7-phase milestone.

### Phase 1: Image Background Engine

**Rationale:** The entire comparison workflow depends on rendering real wallpaper images. This unblocks all downstream phases. The JS/C++ boundary, texture formats, and color space decisions made here are load-bearing for every phase that follows.

**Delivers:** `<GlassProvider backgroundSrc="url">` renders a real image background through the glass shader. Noise mode continues working without regression. Bundled default wallpaper (~200KB WebP) ships as a Vite `?url` asset. Pass 1 optimization: skip re-render when image is unchanged.

**Addresses:** Table stakes A from FEATURES.md (Image Background Rendering — all five sub-features)

**Avoids:** Must resolve C1, C3, C4, C5 in this order: C4 (architecture boundary — JS vs C++) → C3 (RENDER_ATTACHMENT usage flags) → C5 (format normalization via blit shader) → C1 (sRGB color space). Test each step independently before combining. Also avoid N1 (use `colorSpaceConversion: 'none'` in `createImageBitmap` for raw data, `'default'` for wallpapers), N2 (verify Y-axis orientation with asymmetric test image), N4 (bundle wallpaper as separate Vite asset, not embedded in WASM).

**Research flag:** No additional research needed — solutions to all four critical pitfalls are documented. Requires disciplined implementation with step-by-step validation.

### Phase 2: Shader Parameter Exposure

**Rationale:** Orthogonal to Phase 1 — can run in parallel. Exposing the three hardcoded constants as uniforms is a prerequisite for meaningful parameter tuning. Zero risk: the struct extension uses existing padding slots with no size change.

**Delivers:** `<GlassPanel contrast={0.85} saturation={1.4} blurRadius={30}>` with all three new parameters flowing from React props through `useGlassRegion` → `GlassRegionHandle` → Embind → C++ `regions[id].target` → lerpUniforms → GPU uniform buffer. TypeScript interface with JSDoc comments and sensible defaults. WGSL shader reads uniforms instead of hardcoded constants.

**Addresses:** Table stakes B from FEATURES.md (Shader Parameter Exposure)

**Avoids:** M1 (excessive WriteBuffer calls) — new params must follow the existing lerpUniforms architecture; write happens once per frame in `render()`, not per-prop.

**Research flag:** Standard patterns. No additional research needed.

### Phase 3: SwiftUI Reference App

**Rationale:** No code dependencies on the web app — can run in parallel with phases 1-2. Build early so reference screenshots are available before the diff pipeline needs them. The reference app is the ground truth for all visual comparison.

**Delivers:** A minimal Xcode project (outside the glass-react repo) with `.regular` and `.clear` glass variants over the same wallpaper JPEG. Light and dark mode variants. `xcrun simctl io booted screenshot` capture scripts. Pinned Xcode version and simulator runtime documented in metadata.

**Addresses:** Features H from FEATURES.md (SwiftUI Reference App)

**Avoids:** C6 (dark on device) — simulator-only reference, documented limitation. M4 (flaky screenshots) — capture 3 consecutive frames, assert they are identical within 0.1% pixel diff before accepting as reference. Use `GlassEffectContainer` to group elements and reduce offscreen texture count.

**Research flag:** No code research needed. macOS + Xcode 26.2 environment dependency. Monitor Apple Developer Forums thread #814005 for C6 bug resolution.

### Phase 4: Live Tuning UI

**Rationale:** Depends on Phase 1 (image mode) and Phase 2 (all params exposed). The TuningPanel is the primary developer workflow for finding Apple-parity parameters through visual iteration.

**Delivers:** `TuningPanel` in the demo app with sliders for all shader params, grouped sections (Material Constants, Image Background, Comparison Tools), reset-to-defaults per section and global, JSON export/import, and named presets (Apple Standard, Apple Prominent). Leva installed as dev-only dependency.

**Addresses:** Table stakes C from FEATURES.md (Live Tuning UI), differentiators F (presets, export/import)

**Avoids:** N3 (layout thrash from controls panel) — position TuningPanel as `position: fixed`, use `transform`/`opacity` for show/hide animations, measure frame time with and without the panel as a gate criterion.

**Research flag:** Standard patterns. Validate React 19 + leva peer dep compatibility at install time (`--legacy-peer-deps` if needed).

### Phase 5: Screenshot Diff Pipeline

**Rationale:** Requires Phase 1 (image background in web app) and Phase 3 (iOS reference screenshots) to both be ready. This is the measurement infrastructure that all tuning depends on.

**Delivers:** Playwright test that captures the WebGPU canvas at a standardized pixel dimension (1179x2556 matching iPhone 16 Pro logical pixels). Node.js diff script that: normalizes both screenshots to sRGB via `sips`, crops to the glass region, runs pixelmatch, outputs diff.png with mismatch percentage. Verification: diff of identical solid colors shows < 1% mismatch after normalization.

**Addresses:** Table stakes D from FEATURES.md (Visual Diffing Workflow), differentiators G (region masking, SSIM)

**Avoids:** C7 (color space normalization) — must be resolved and verified with a color calibration patch before running any automated diffs. M3 (DPI scaling) — standardize capture at fixed pixel dimension, disable "Optimize Rendering for Window Scale" in simulator. Anti-Pattern 3 (full-screen diff) — crop to glass region only.

**Research flag:** WebGPU canvas screenshot capture in headless Playwright is MEDIUM confidence. Validate that `page.locator('canvas').screenshot()` captures GPU-rendered content with `--use-angle=gl` or `--enable-unsafe-webgpu` flags before building the rest of the pipeline. May need headed mode as fallback.

### Phase 6: Manual Tuning to Parity

**Rationale:** Once the diff pipeline produces reliable scores, a human operator uses the TuningPanel (Phase 4) and diff output (Phase 5) to tune parameters toward the reference. This is an iterative human-in-the-loop phase. Output is a set of validated preset values committed to the library.

**Delivers:** Validated "Apple Standard" and "Apple Prominent" preset parameter sets with documented SSIM and mismatch percentage against the simulator reference. These become committed defaults in the library. A documented parameter guide explaining valid ranges and what each parameter does perceptually.

**Addresses:** Differentiators F from FEATURES.md (named presets with validated values), establishes the baseline for CI regression

**Avoids:** M2 (local minimum) — constrain parameter ranges to physically plausible bounds before tuning; human validation required at each iteration. M5 (blur quality gap) — document the structural blur limitation; exclude blur interior from convergence target; set explicit acceptance threshold (e.g., <10% pixel mismatch in non-blur regions).

**Research flag:** No software research needed. Empirical tuning phase.

### Phase 7: Automated Tuning Loop (Stretch Goal)

**Rationale:** Build only after Phase 6 establishes well-tuned manual baselines. The automated loop refines around manually-established starting points using URL-driven parameter injection and coordinate descent. Defer to v2.1 if manual tuning achieves acceptable parity.

**Delivers:** `scripts/tune.ts` — Node.js script that drives Playwright with `?params=base64json` URL injection, captures screenshots, runs pixelmatch, performs coordinate descent on one parameter at a time, logs convergence per iteration. Does not modify shader code — only changes uniform values via URL.

**Addresses:** Differentiators G from FEATURES.md (automated convergence loop)

**Avoids:** M2 (local minimum) — start from Phase 6 manual baseline, constrain ranges, require human sign-off. Anti-Pattern 4 (hot-reloading C++ in tuning loop) — loop only changes URL params, never source files.

**Research flag:** Validate URL-based parameter injection reliability in headless Playwright before investing in the optimizer. If basic round-trip (set params → capture → read diff) is unreliable, headless Playwright is the blocker, not the optimizer.

### Phase Ordering Rationale

- Phase 1 before Phase 5: The diff pipeline needs image mode to render the same scene as iOS.
- Phase 1 parallel with Phase 2: Both are engine changes, no cross-dependencies. Shader param exposure is zero-risk and can proceed concurrently.
- Phase 3 parallel with Phases 1-2: SwiftUI app is fully independent from the web app. Build early to have reference screenshots available.
- Phase 4 after Phases 1+2: TuningPanel needs both image mode and all params exposed to be meaningful.
- Phase 5 after Phase 1 and Phase 3: Needs both sides of the comparison working.
- Phase 6 after Phases 4+5: Human tuning requires both the UI and the measurement pipeline.
- Phase 7 after Phase 6: Automated loop needs well-tuned starting points to avoid local minima.

### Research Flags

Phases needing validation or early risk mitigation:
- **Phase 1 (Image Background):** The four-pitfall cluster (C1/C3/C4/C5) must be addressed in order. Recommend a written validation checklist and testing each constraint independently before combining. All solutions are known — discipline in implementation is the requirement.
- **Phase 5 (Diff Pipeline):** WebGPU canvas capture in headless Playwright is MEDIUM confidence. Validate early (first day of Phase 5) before building the full pipeline. Known mitigation: `page.locator('canvas').screenshot()` captured immediately after `waitForTimeout(2000)`, with `--use-angle=gl` flag.
- **Phase 7 (Auto-Tuning):** Validate URL-based parameter injection end-to-end before investing in the coordinate descent optimizer.

Phases with well-established patterns (no additional research needed):
- **Phase 2 (Shader Params):** Standard uniform buffer extension. Zero-risk using existing padding slots.
- **Phase 3 (SwiftUI App):** Apple APIs well-documented. xcrun simctl is stable. C6 is a known bug with a known mitigation.
- **Phase 4 (Tuning UI):** Leva is well-documented. Standard React component patterns.
- **Phase 6 (Manual Tuning):** Empirical process, no software research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core stack unchanged and validated in v1.0. New additions (leva, pixelmatch, pngjs) are well-documented. Approach A (JS image decode via createImageBitmap) verified against Emscripten issue #18190. |
| Features | MEDIUM | Table stakes and must-haves are clear. Parameter gap estimates (blur, aberration, rim) are community-derived with no official Apple documentation. Apple does not expose `.glassEffect()` internals. |
| Architecture | HIGH | Based primarily on existing codebase analysis (highest confidence source) plus verified WebGPU patterns from official sources. Uniform struct extension approach is mechanically confirmed. JS/C++ image boundary design is based on confirmed Emscripten limitations. |
| Pitfalls | HIGH | Most critical pitfalls verified against official gpuweb issues, MDN, and Apple Developer Forums. C6 (dark on device) is directly confirmed by multiple developers. C7 (P3 color space) is MEDIUM. M5 (blur quality) is directly observable in source code. |

**Overall confidence:** MEDIUM-HIGH. The engineering approach is clear and well-sourced. Uncertainty is in the visual parity targets: Apple's glass internals are not documented, parameter estimates are community-derived, and the iOS 26 bug landscape may shift between beta versions.

### Gaps to Address

- **Apple parameter ground truth:** The parameter estimates in FEATURES.md are community-derived (MEDIUM confidence). During Phase 6 (Manual Tuning), empirical measurement against the simulator reference will produce the actual ground truth values. Treat FEATURES.md estimates as starting points only, not targets.

- **Blur quality ceiling:** The 5x5 Gaussian is a structural limitation. Research into a separable Gaussian (horizontal + vertical passes, ~15-tap equivalent at the same cost) should be scoped during or after Phase 2 as a potential Phase 2.5 addition, before Phase 5 (diff pipeline), so the comparison is against the best achievable blur quality. This is not a blocking gap but affects the achievable parity score.

- **Playwright WebGPU headless reliability:** MEDIUM confidence. Needs early empirical validation on Phase 5 day 1. If headless Chrome does not capture WebGPU canvas content reliably, headed mode is the fallback; document in CI setup as a constraint.

- **iOS 26 bug resolution:** C6 (dark on device) is confirmed in iOS 26.0-26.0.1. Monitor Apple Developer Forums thread #814005. If Apple fixes it before v2.0 ships, re-capture reference screenshots and re-run Phase 6 tuning. Build Phase 5-7 to be fully re-runnable for this reason.

- **Premultiplied alpha edge case (C2):** Latent — may not surface until visual comparison phase when background images with partial alpha are tested. Test early with a PNG that has alpha regions, even though the initial bundled wallpaper is opaque.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `engine/src/background_engine.cpp`, `engine/src/shaders/glass.wgsl.h`, `src/components/GlassProvider.tsx`, `src/hooks/useGlassRegion.ts` — architectural baseline and uniform layout
- [MDN: GPUQueue.copyExternalImageToTexture](https://developer.mozilla.org/en-US/docs/Web/API/GPUQueue/copyExternalImageToTexture) — usage flag requirements, flipY, premultiplied alpha
- [WebGPU Fundamentals: Importing Textures](https://webgpufundamentals.org/webgpu/lessons/webgpu-importing-textures.html) — sRGB handling, createImageBitmap options, color space
- [toji.dev: WebGPU Image Texture Best Practices](https://toji.dev/webgpu-best-practices/img-textures.html) — JS decode / WASM upload patterns
- [Emscripten issue #18190](https://github.com/emscripten-core/emscripten/issues/18190) — copyExternalImageToTexture not in C++ bindings, closed "not planned"
- [gpuweb issues #3357, #1715, #1762, #2535](https://github.com/gpuweb/gpuweb/issues/) — RENDER_ATTACHMENT requirement, linear color space, premultiplied alpha, bgra8unorm format
- [Apple Developer Forums thread #814005](https://developer.apple.com/forums/thread/814005) — .glassEffect() dark on physical device, confirmed bug
- [JuniperPhoton: Adopting Liquid Glass pitfalls](https://juniperphoton.substack.com/p/adopting-liquid-glass-experiences) — GlassEffectContainer offscreen texture overhead in simulator
- [Apple: glassEffect(_:in:) documentation](https://developer.apple.com/documentation/swiftui/view/glasseffect(_:in:)) — API reference, preset styles
- [WWDC25 Session 323](https://developer.apple.com/videos/play/wwdc2025/323/) — Liquid Glass API design confirmed
- [pixelmatch (mapbox)](https://github.com/mapbox/pixelmatch) — pixel diff library, API, threshold semantics
- [leva (pmndrs)](https://github.com/pmndrs/leva) — React parameter controls

### Secondary (MEDIUM confidence)
- [Apple Developer Forums: color management](https://developer.apple.com/forums/thread/111818) — iOS Simulator P3 color profile behavior
- [Emscripten issue #13888](https://github.com/emscripten-core/emscripten/issues/13888) — mixed JS/WASM WebGPU patterns
- [Playwright WebGPU headless blog](https://blog.promaton.com/testing-3d-applications-with-playwright-on-gpu-1e9cfc8b54a9) — GPU headless screenshot capture patterns
- Community glass implementations for parameter reference: [dashersw/liquid-glass-js](https://github.com/dashersw/liquid-glass-js), [rdev/liquid-glass-react](https://github.com/rdev/liquid-glass-react), [DnV1eX/LiquidGlassKit](https://github.com/DnV1eX/LiquidGlassKit), [iyinchao/liquid-glass-studio](https://github.com/iyinchao/liquid-glass-studio)
- [leva React 19 issue #539](https://github.com/pmndrs/leva/issues/539) — peer dep warning status

### Tertiary (LOW confidence)
- Apple native glass parameter values — no official source; all estimates are community reverse-engineering and should be treated as starting points only

---
*Research completed: 2026-02-25*
*Ready for roadmap: yes*

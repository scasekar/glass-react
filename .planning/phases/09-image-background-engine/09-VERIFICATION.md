---
phase: 09-image-background-engine
verified: 2026-02-25T18:00:00Z
status: gaps_found
score: 9/11 must-haves verified
gaps:
  - truth: "User can pass a backgroundSrc URL to GlassProvider to render a custom image"
    status: failed
    reason: "ROADMAP success criterion 1 specifies a 'backgroundSrc' URL prop for user-supplied images. The implementation only supports the hardcoded bundled wallpaper; there is no backgroundSrc prop on GlassProvider."
    artifacts:
      - path: "src/components/GlassProvider.tsx"
        issue: "GlassProviderProps has backgroundMode prop but no backgroundSrc prop. loadAndUploadWallpaper is hardcoded to the bundled wallpaper URL; no mechanism for user-supplied image URLs."
    missing:
      - "Add 'backgroundSrc?: string' prop to GlassProviderProps"
      - "Pass backgroundSrc to loadAndUploadWallpaper so user-supplied URLs can be fetched and uploaded"
      - "Add useEffect that re-uploads when backgroundSrc changes"
  - truth: "IMG-03 requirement checkbox reflects actual state"
    status: failed
    reason: "REQUIREMENTS.md marks IMG-03 as '[ ] Pending' and the traceability table says 'Pending', but the implementation does ship a bundled wallpaper.jpg (1920x1080, 190KB). The checkbox was never updated after implementation. This is a documentation accuracy gap."
    artifacts:
      - path: ".planning/REQUIREMENTS.md"
        issue: "IMG-03 marked '[ ]' (Pending) at lines 12 and 84 but implementation satisfies it"
    missing:
      - "Update REQUIREMENTS.md: change '- [ ] **IMG-03**' to '- [x] **IMG-03**'"
      - "Update traceability table: change 'IMG-03 | Phase 9 | Pending' to 'IMG-03 | Phase 9 | Complete'"
human_verification:
  - test: "sRGB correctness — 50% gray test"
    expected: "A 50% gray image (all pixels #808080) passed through the full pipeline with zero glass effects produces approximately 50% gray output on screen"
    why_human: "Verifying gamma correctness requires visual inspection or pixel readback; cannot be confirmed programmatically from source inspection alone. The rgba8unorm-srgb format and colorSpaceConversion:'none' are correctly set in code, but the end-to-end result depends on browser/GPU behavior."
  - test: "Image renders as default background behind glass components"
    expected: "On page load with no backgroundMode prop, the mountain landscape wallpaper is visible behind glass components (not procedural noise)"
    why_human: "Requires running 'npm run dev' and visual inspection in Chrome with WebGPU enabled. WASM build must be up to date."
  - test: "Mode switch is instant and preserves glass state"
    expected: "Clicking the 'Background: Image/Noise' toggle button in the bottom-left switches backgrounds without delay and glass components remain functional (refraction/blur visible over both backgrounds)"
    why_human: "Requires interactive testing in a live browser session."
---

# Phase 9: Image Background Engine — Verification Report

**Phase Goal:** Add image background rendering — C++ texture upload, sRGB blit pipeline, JS decode + WASM transfer, GlassProvider backgroundMode prop
**Verified:** 2026-02-25T18:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from Plan must_haves)

**Plan 01 Truths:**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | C++ engine can receive raw RGBA pixel data and upload it to a WebGPU texture | VERIFIED | `uploadImageData()` in background_engine.cpp:184 creates RGBA8UnormSrgb texture and calls WriteTexture |
| 2 | Engine renders the image texture to the offscreen texture when in image mode | VERIFIED | render() at line 472: `if (backgroundMode_ == BackgroundMode::Image && hasImageTexture_)` sets imageBlitPipeline_ |
| 3 | Engine renders the noise pipeline to the offscreen texture when in noise mode | VERIFIED | Same branch: `else { pass.SetPipeline(noisePipeline); }` — also fallback when no image loaded |
| 4 | Image texture uses rgba8unorm-srgb format for automatic sRGB-to-linear conversion on sample | VERIFIED | background_engine.cpp:194: `texDesc.format = wgpu::TextureFormat::RGBA8UnormSrgb` |
| 5 | Mode switching between image and noise is instant and preserves glass state | HUMAN NEEDED | setBackgroundMode() just sets backgroundMode_ = mode; glass regions unchanged. Instant in code, needs visual confirmation |

**Plan 02 Truths:**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 6 | GlassProvider renders the bundled wallpaper image as background by default | VERIFIED | wallpaper.jpg exists (1920x1080 JPEG, 190KB); loadAndUploadWallpaper triggers on `[ready]`; backgroundMode defaults to 'image' |
| 7 | User can switch between backgroundMode='image' and backgroundMode='noise' | VERIFIED | backgroundMode prop wired; useEffect syncs to module.setBackgroundMode(0 or 1); demo toggle button present |
| 8 | When backgroundMode is 'image', bundled default wallpaper loads automatically | VERIFIED | loadAndUploadWallpaper called unconditionally on engine ready; wallpaper.jpg bundled in src/assets/ |
| 9 | When backgroundMode is 'noise', procedural noise renders unchanged | VERIFIED | setBackgroundMode(1) sets Noise enum; render() falls through to noisePipeline branch |
| 10 | A 50% gray image produces ~50% gray output (sRGB correctness) | HUMAN NEEDED | rgba8unorm-srgb format + colorSpaceConversion:'none' are correct in code; end-to-end pixel result needs human/device test |
| 11 | User can pass a backgroundSrc URL to GlassProvider for a custom image | FAILED | No backgroundSrc prop exists on GlassProvider; only bundled wallpaper supported |

**Score:** 9/11 truths verified (2 human needed, 1 failed)

### Required Artifacts

**Plan 01 Artifacts:**

| Artifact | Provides | Level 1: Exists | Level 2: Substantive | Level 3: Wired | Status |
|----------|----------|-----------------|----------------------|----------------|--------|
| `engine/src/shaders/image_blit.wgsl.h` | Fullscreen triangle shader sampling sRGB texture | Yes (40 lines) | Yes — complete WGSL shader with vs_main, fs_main, textureSample, UV Y-flip | Yes — `imageBlitShaderCode` loaded at background_engine.cpp:97 | VERIFIED |
| `engine/src/background_engine.h` | BackgroundMode enum, image texture members, method declarations | Yes (117 lines) | Yes — BackgroundMode enum at line 38, uploadImageData/setBackgroundMode declarations at lines 63-64, all image members at lines 104-113 | Yes — implemented in background_engine.cpp, bound in main.cpp | VERIFIED |
| `engine/src/background_engine.cpp` | Image blit pipeline creation, uploadImageData, mode-switched render() | Yes (636 lines) | Yes — createImageBlitPipeline (94-160), uploadImageData (184-239), mode-switch in render() (472-482) | Yes — #include "shaders/image_blit.wgsl.h" at line 3 | VERIFIED |
| `engine/src/main.cpp` | Embind free functions uploadImageDataJS and setBackgroundModeJS | Yes (149 lines) | Yes — uploadImageDataJS at line 118, setBackgroundModeJS at line 123, both registered in EMSCRIPTEN_BINDINGS at lines 131-132 | Yes — calls g_engine->uploadImageData() and g_engine->setBackgroundMode() | VERIFIED |
| `engine/CMakeLists.txt` | Exported _malloc, _free, HEAPU8 for WASM heap access | Yes (30 lines) | Yes — line 22: `-sEXPORTED_RUNTIME_METHODS=['ccall','HEAPU8']` line 23: `-sEXPORTED_FUNCTIONS=['_main','_malloc','_free']` | Yes — these flags are active in the link step | VERIFIED |

**Plan 02 Artifacts:**

| Artifact | Provides | Level 1: Exists | Level 2: Substantive | Level 3: Wired | Status |
|----------|----------|-----------------|----------------------|----------------|--------|
| `src/assets/wallpaper.jpg` | Bundled default wallpaper 1920x1080 ~200KB JPEG | Yes (190KB) | Yes — verified JPEG 1920x1080 by `file` command | Yes — imported in GlassProvider.tsx line 5 | VERIFIED |
| `src/wasm/loader.ts` | EngineModule with uploadImageData, setBackgroundMode, _malloc, _free, HEAPU8 | Yes (40 lines) | Yes — all 5 new members declared at lines 20-26 | Yes — consumed by GlassProvider.tsx via import at line 3 | VERIFIED |
| `src/components/GlassProvider.tsx` | backgroundMode prop, image loading/upload, mode switching | Yes (202 lines) | Yes — backgroundMode prop at line 8, loadAndUploadWallpaper function at lines 12-42, two useEffects for upload/mode-sync at lines 115-127 | Yes — wallpaperUrl imported and used, module.uploadImageData called | VERIFIED |
| `demo/App.tsx` | Demo with backgroundMode toggle | Yes (187 lines) | Yes — bgMode state at line 22, passed to GlassProvider at line 25, toggle button at lines 158-180 | Yes — GlassProvider receives backgroundMode={bgMode} | VERIFIED |

### Key Link Verification

**Plan 01 Key Links:**

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `engine/src/main.cpp` | `engine/src/background_engine.cpp` | uploadImageDataJS calls g_engine->uploadImageData() | WIRED | main.cpp line 120: `g_engine->uploadImageData(reinterpret_cast<const uint8_t*>(pixelPtr), width, height)` |
| `engine/src/background_engine.cpp` | `engine/src/shaders/image_blit.wgsl.h` | createImageBlitPipeline loads shader code | WIRED | background_engine.cpp line 3: `#include "shaders/image_blit.wgsl.h"` + line 97: `wgslSource.code = imageBlitShaderCode` |

**Plan 02 Key Links:**

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `src/components/GlassProvider.tsx` | `src/wasm/loader.ts` | Calls module.uploadImageData and module.setBackgroundMode | WIRED | GlassProvider.tsx line 40: `module.uploadImageData(ptr, width, height)` and line 126: `moduleRef.current.setBackgroundMode(...)` |
| `src/components/GlassProvider.tsx` | `src/assets/wallpaper.jpg` | Vite static import for wallpaper URL | WIRED | GlassProvider.tsx line 5: `import wallpaperUrl from '../assets/wallpaper.jpg'` — used in fetch(wallpaperUrl) at line 13 |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| IMG-01 | 09-01-PLAN.md, 09-02-PLAN.md | User can render a loaded image as background texture through glass components | SATISFIED | uploadImageData API wired end-to-end: C++ texture upload → WASM embind → JS fetch+decode → WASM heap transfer. GlassProvider calls this on engine ready. |
| IMG-02 | 09-01-PLAN.md, 09-02-PLAN.md | User can toggle between noise and image background modes via backgroundMode prop | SATISFIED | GlassProvider.tsx backgroundMode prop syncs to C++ setBackgroundMode(0/1). Demo has working toggle. REQUIREMENTS.md correctly marks [x]. |
| IMG-03 | 09-02-PLAN.md | Library ships a bundled default wallpaper image (~200KB) as a Vite asset | SATISFIED (documentation gap) | src/assets/wallpaper.jpg exists: 1920x1080, 190KB JPEG, imported via Vite static import. The implementation fully satisfies this requirement. However, REQUIREMENTS.md incorrectly marks it as [ ] Pending — the checkbox was never updated after implementation. |
| IMG-04 | 09-01-PLAN.md, 09-02-PLAN.md | Image textures use sRGB-correct pipeline (rgba8unorm-srgb format, linear shader math) | SATISFIED (code) / HUMAN for end-to-end | C++: `wgpu::TextureFormat::RGBA8UnormSrgb` (background_engine.cpp:194). JS: `createImageBitmap(blob, { colorSpaceConversion: 'none' })` (GlassProvider.tsx:22). No manual pow() gamma in shader. End-to-end visual correctness requires human test. |

**ROADMAP Success Criteria Assessment:**

| # | Success Criterion | Status | Notes |
|---|-------------------|--------|-------|
| 1 | User can pass a `backgroundSrc` URL to GlassProvider and see that image rendered | FAILED | No `backgroundSrc` prop implemented. Plans deviated from ROADMAP spec — plans used hardcoded bundled wallpaper only. |
| 2 | User can switch between backgroundMode="noise" and backgroundMode="image" | SATISFIED | Implemented and wired. |
| 3 | Bundled default wallpaper loads automatically when no backgroundSrc provided | SATISFIED | Wallpaper always loads on engine ready regardless of prop. |
| 4 | 50% gray test image produces 50% gray output (sRGB correctness) | HUMAN NEEDED | Code is correct; visual test required. |

### Anti-Patterns Found

No TODO/FIXME/PLACEHOLDER/stub patterns found in any Phase 9 modified files. No empty implementations, console.log-only handlers, or return-null stubs detected.

**Pre-existing TypeScript issue (not introduced by Phase 9):**

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/wasm/loader.ts` | 30 | `navigator.gpu` — TS2339 (Property 'gpu' does not exist on 'Navigator') | Info | Pre-existing from Phase 1; tsconfig lacks `@webgpu/types` or `lib: ["WebGPU"]`. Vite builds succeed despite this (skipLibCheck). Not a Phase 9 regression. |

### Human Verification Required

#### 1. Image Background Renders by Default

**Test:** Run `npm run dev:demo` (or `npm run dev`) in `/Users/asekar/code/glass-react`. Open Chrome at the displayed URL with WebGPU enabled.
**Expected:** Mountain landscape photograph visible as background behind glass components on page load — not procedural noise.
**Why human:** Requires WASM build to be current and a browser with WebGPU support. Visual inspection of running app.

#### 2. Mode Toggle Works Instantly

**Test:** With the dev server running, click the "Background: Image" button in the bottom-left corner.
**Expected:** Background switches immediately to animated procedural noise. Button label changes to "Background: Noise". Glass refraction/blur effects remain visible over both backgrounds. No console errors.
**Why human:** Requires interactive browser session.

#### 3. sRGB Correctness (IMG-04 end-to-end)

**Test:** Pass a solid 50% gray image (#808080 RGBA = [128,128,128,255]) through the pipeline. Compare output pixel color at the canvas to the input.
**Expected:** Output reads approximately 50% gray (not washed out to ~73% or darkened to ~21% which would indicate gamma double-application or missing sRGB conversion).
**Why human:** End-to-end pixel measurement requires browser pixel readback or DevTools color picker over the canvas. The code path (rgba8unorm-srgb + colorSpaceConversion:'none') is correct in source; the GPU/driver behavior is what needs confirming.

### Gaps Summary

**Gap 1 — Missing backgroundSrc prop (ROADMAP criterion 1 not met)**

ROADMAP.md Phase 9 success criterion 1 states: "User can pass a `backgroundSrc` URL to GlassProvider and see that image rendered behind glass components with correct refraction." The implementation never built this. The plans (09-01, 09-02) scoped only the bundled wallpaper path — the plans did not include a user-supplied image URL prop. The result is that users cannot bring their own background images without modifying GlassProvider source.

This is a scope reduction: the plans narrowed the ROADMAP criterion to "bundled default only" without documenting the reduction. The `backgroundMode` prop exists and works, but the URL-based image loading does not.

**Gap 2 — IMG-03 checkbox in REQUIREMENTS.md not updated**

REQUIREMENTS.md marks IMG-03 as `[ ] Pending` but `src/assets/wallpaper.jpg` fully satisfies the requirement ("Library ships a bundled default wallpaper image (~200KB) as a Vite asset"). The traceability table also says "Pending". This is a documentation accuracy issue — the implementation is complete but the requirements tracking was not updated after Plan 02 ran. This creates false signals in any system reading REQUIREMENTS.md for completion status.

**Root cause:** Both gaps stem from the same planning decision — Plan 02 scoped the wallpaper to "bundled default only" without reflecting that this was narrower than the ROADMAP criterion, and without updating REQUIREMENTS.md after completion.

---

_Verified: 2026-02-25T18:00:00Z_
_Verifier: Claude (gsd-verifier)_

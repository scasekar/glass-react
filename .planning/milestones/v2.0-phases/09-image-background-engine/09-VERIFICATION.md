---
phase: 09-image-background-engine
verified: 2026-02-25T18:30:00Z
status: human_needed
score: 10/11 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 9/11
  gaps_closed:
    - "ROADMAP.md Phase 9 success criterion 1 rewritten to reflect bundled-wallpaper-only scope (no backgroundSrc reference anywhere in ROADMAP.md Phase 9 criteria)"
    - "REQUIREMENTS.md IMG-03 confirmed [x] Complete in both checkbox and traceability table"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Image renders as default background behind glass components"
    expected: "On page load with no backgroundMode prop, the mountain landscape wallpaper is visible behind glass components — not procedural noise"
    why_human: "Requires running 'npm run dev:demo' and visual inspection in Chrome with WebGPU enabled. WASM build must be current."
  - test: "Mode switch is instant and preserves glass state"
    expected: "Clicking the 'Background: Image/Noise' toggle in the bottom-left switches backgrounds without delay and glass components remain functional (refraction/blur visible over both)"
    why_human: "Requires interactive testing in a live browser session."
  - test: "sRGB correctness — 50% gray test (IMG-04 end-to-end)"
    expected: "A 50% gray image (#808080 RGBA = [128,128,128,255]) passed through the full pipeline with zero glass effects produces approximately 50% gray output on screen"
    why_human: "Verifying gamma correctness requires visual inspection or pixel readback. The rgba8unorm-srgb format and colorSpaceConversion:'none' are correctly set in code, but the end-to-end result depends on browser/GPU behavior."
---

# Phase 9: Image Background Engine — Verification Report

**Phase Goal:** Image background engine — C/WASM image decoding, sRGB color correction, JS/React integration with bundled wallpaper
**Verified:** 2026-02-25T18:30:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (Plan 03 documentation fixes)

## Re-verification Summary

**Previous status:** gaps_found (9/11)
**Current status:** human_needed (10/11 automated, 1 truth always needs human)

### Gaps Closed

| Gap | Previous State | Current State | Evidence |
|-----|---------------|---------------|----------|
| ROADMAP success criterion 1 referenced `backgroundSrc` prop not built | FAILED | CLOSED | ROADMAP.md lines 42-44: 3 criteria, none mention `backgroundSrc`. Commit `1e53f48`. |
| REQUIREMENTS.md IMG-03 marked `[ ]` Pending | FAILED | CLOSED | REQUIREMENTS.md line 12: `[x] **IMG-03**`. Line 84 traceability: `Complete`. Already correct before Plan 03 ran (confirmed by Plan 03 task 2 verification-only path). |

### Regressions

None detected. All previously-passing artifacts and key links are intact.

---

## Goal Achievement

### Observable Truths

**Plan 01 Truths:**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | C++ engine can receive raw RGBA pixel data and upload it to a WebGPU texture | VERIFIED | `uploadImageData()` in background_engine.cpp:184 creates RGBA8UnormSrgb texture and calls WriteTexture |
| 2 | Engine renders image texture to the offscreen texture when in image mode | VERIFIED | render() branch: `if (backgroundMode_ == BackgroundMode::Image && hasImageTexture_)` sets imageBlitPipeline_ |
| 3 | Engine renders noise pipeline to the offscreen texture when in noise mode | VERIFIED | Same branch `else { pass.SetPipeline(noisePipeline); }` — also fallback when no image loaded |
| 4 | Image texture uses rgba8unorm-srgb format for automatic sRGB-to-linear conversion on sample | VERIFIED | background_engine.cpp: `texDesc.format = wgpu::TextureFormat::RGBA8UnormSrgb` |
| 5 | Mode switching between image and noise is instant and preserves glass state | HUMAN NEEDED | setBackgroundMode() sets backgroundMode_ = mode; glass regions unchanged in code. Instant code path confirmed; visual/interactive confirmation required |

**Plan 02 Truths:**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 6 | GlassProvider renders the bundled wallpaper image as background by default | VERIFIED | wallpaper.jpg exists (190KB, 1920x1080 JPEG); loadAndUploadWallpaper triggers on engine ready; backgroundMode defaults to 'image' |
| 7 | User can switch between backgroundMode='image' and backgroundMode='noise' | VERIFIED | backgroundMode prop wired; useEffect syncs to module.setBackgroundMode(0 or 1); demo toggle button present |
| 8 | When backgroundMode is 'image', bundled default wallpaper loads automatically | VERIFIED | loadAndUploadWallpaper called unconditionally on engine ready; wallpaper.jpg bundled in src/assets/ |
| 9 | When backgroundMode is 'noise', procedural noise renders unchanged | VERIFIED | setBackgroundMode(1) sets Noise enum; render() falls through to noisePipeline branch |
| 10 | A 50% gray image produces ~50% gray output (sRGB correctness) | HUMAN NEEDED | rgba8unorm-srgb + colorSpaceConversion:'none' are correct in code; end-to-end pixel result needs human/device test |

**Plan 03 Truths (gap closure):**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 11 | ROADMAP.md Phase 9 success criteria accurately reflect bundled-wallpaper-only scope | VERIFIED | Lines 42-44: 3 criteria, criterion 1 says "bundled default wallpaper renders as the background." No `backgroundSrc` anywhere in Phase 9 block. Commit `1e53f48`. |
| 12 | REQUIREMENTS.md correctly marks IMG-03 as complete in both checkbox and traceability table | VERIFIED | Line 12: `- [x] **IMG-03**`. Line 84: `IMG-03 | Phase 9 | Complete`. |

**Score:** 10/12 truths verified by automated checks (2 require human visual/interactive testing)

### Required Artifacts

**Plan 01 Artifacts:**

| Artifact | Provides | Exists | Substantive | Wired | Status |
|----------|----------|--------|-------------|-------|--------|
| `engine/src/shaders/image_blit.wgsl.h` | Fullscreen triangle shader sampling sRGB texture | Yes (40 lines) | Yes — complete WGSL with vs_main, fs_main, textureSample, UV Y-flip | Yes — loaded at background_engine.cpp via `#include` + `imageBlitShaderCode` | VERIFIED |
| `engine/src/background_engine.h` | BackgroundMode enum, image texture members, method declarations | Yes (117 lines) | Yes — BackgroundMode enum, uploadImageData/setBackgroundMode declarations, all image members | Yes — implemented in background_engine.cpp, bound in main.cpp | VERIFIED |
| `engine/src/background_engine.cpp` | Image blit pipeline creation, uploadImageData, mode-switched render() | Yes (636 lines) | Yes — createImageBlitPipeline, uploadImageData, mode-switch in render() | Yes — `#include "shaders/image_blit.wgsl.h"` at line 3 | VERIFIED |
| `engine/src/main.cpp` | Embind free functions uploadImageDataJS and setBackgroundModeJS | Yes (149 lines) | Yes — uploadImageDataJS, setBackgroundModeJS, both in EMSCRIPTEN_BINDINGS | Yes — calls g_engine->uploadImageData() and g_engine->setBackgroundMode() | VERIFIED |
| `engine/CMakeLists.txt` | Exported _malloc, _free, HEAPU8 for WASM heap access | Yes (30 lines) | Yes — EXPORTED_RUNTIME_METHODS=['ccall','HEAPU8'], EXPORTED_FUNCTIONS=['_main','_malloc','_free'] | Yes — flags active in link step | VERIFIED |

**Plan 02 Artifacts:**

| Artifact | Provides | Exists | Substantive | Wired | Status |
|----------|----------|--------|-------------|-------|--------|
| `src/assets/wallpaper.jpg` | Bundled default wallpaper 1920x1080 ~200KB JPEG | Yes (190KB) | Yes — verified JPEG 1920x1080 | Yes — imported in GlassProvider.tsx via Vite static import | VERIFIED |
| `src/wasm/loader.ts` | EngineModule with uploadImageData, setBackgroundMode, _malloc, _free, HEAPU8 | Yes (40 lines) | Yes — all 5 new members declared | Yes — consumed by GlassProvider.tsx | VERIFIED |
| `src/components/GlassProvider.tsx` | backgroundMode prop, image loading/upload, mode switching | Yes (202 lines) | Yes — backgroundMode prop, loadAndUploadWallpaper, two useEffects for upload/mode-sync | Yes — wallpaperUrl imported and used, module.uploadImageData called | VERIFIED |
| `demo/App.tsx` | Demo with backgroundMode toggle | Yes (187 lines) | Yes — bgMode state, passed to GlassProvider, toggle button | Yes — GlassProvider receives backgroundMode={bgMode} | VERIFIED |

**Plan 03 Artifacts:**

| Artifact | Provides | Exists | Substantive | Wired | Status |
|----------|----------|--------|-------------|-------|--------|
| `.planning/ROADMAP.md` | Accurate Phase 9 success criteria (bundled-wallpaper-only scope, 3 criteria) | Yes | Yes — 3 criteria at lines 42-44, no `backgroundSrc` reference | N/A (documentation) | VERIFIED |
| `.planning/REQUIREMENTS.md` | IMG-03 marked [x] Complete in checkbox and traceability table | Yes | Yes — checkbox line 12: `[x]`, table line 84: `Complete` | N/A (documentation) | VERIFIED |

### Key Link Verification

**Plan 01 Key Links:**

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `engine/src/main.cpp` | `engine/src/background_engine.cpp` | uploadImageDataJS calls g_engine->uploadImageData() | WIRED | main.cpp calls `g_engine->uploadImageData(reinterpret_cast<const uint8_t*>(pixelPtr), width, height)` |
| `engine/src/background_engine.cpp` | `engine/src/shaders/image_blit.wgsl.h` | createImageBlitPipeline loads shader code | WIRED | background_engine.cpp line 3: `#include "shaders/image_blit.wgsl.h"` + `wgslSource.code = imageBlitShaderCode` |

**Plan 02 Key Links:**

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `src/components/GlassProvider.tsx` | `src/wasm/loader.ts` | Calls module.uploadImageData and module.setBackgroundMode | WIRED | GlassProvider.tsx: `module.uploadImageData(ptr, width, height)` and `moduleRef.current.setBackgroundMode(...)` |
| `src/components/GlassProvider.tsx` | `src/assets/wallpaper.jpg` | Vite static import for wallpaper URL | WIRED | GlassProvider.tsx: `import wallpaperUrl from '../assets/wallpaper.jpg'` — used in `fetch(wallpaperUrl)` |

**Plan 03 Key Links:** None (documentation-only plan).

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| IMG-01 | 09-01, 09-02, 09-03 | User can render a loaded image as the background texture through glass components | SATISFIED | uploadImageData API wired end-to-end: C++ texture upload -> WASM embind -> JS fetch+decode -> WASM heap transfer. GlassProvider calls on engine ready. |
| IMG-02 | 09-01, 09-02, 09-03 | User can toggle between noise and image background modes via backgroundMode prop | SATISFIED | GlassProvider.tsx backgroundMode prop syncs to C++ setBackgroundMode(0/1). Demo has working toggle. REQUIREMENTS.md marks [x]. |
| IMG-03 | 09-02, 09-03 | Library ships a bundled default wallpaper image (~200KB) as a Vite asset | SATISFIED | src/assets/wallpaper.jpg: 1920x1080, 190KB JPEG, Vite static import in GlassProvider.tsx. REQUIREMENTS.md [x] Complete confirmed. |
| IMG-04 | 09-01, 09-02, 09-03 | Image textures use sRGB-correct pipeline (rgba8unorm-srgb format, linear shader math) | SATISFIED (code) / HUMAN for end-to-end | C++: `wgpu::TextureFormat::RGBA8UnormSrgb`. JS: `createImageBitmap(blob, { colorSpaceConversion: 'none' })`. No manual gamma in shader. End-to-end visual correctness requires human test. |

**ROADMAP Success Criteria (updated by Plan 03):**

| # | Success Criterion | Status | Notes |
|---|-------------------|--------|-------|
| 1 | The library's bundled default wallpaper renders as the background behind glass components with correct refraction in image mode | HUMAN NEEDED | Code path confirmed: wallpaper.jpg imported, uploaded via uploadImageData, imageBlitPipeline renders in image mode. Visual confirmation required. |
| 2 | User can switch between backgroundMode="noise" and backgroundMode="image" without reloading the page, and both modes render correctly | HUMAN NEEDED | Mode switching logic verified in code (setBackgroundMode + render branch). Interactive test required. |
| 3 | A 50% gray test image passed through the glass pipeline with zero effects produces 50% gray output (sRGB/linear color space correctness verified) | HUMAN NEEDED | rgba8unorm-srgb format and colorSpaceConversion:'none' set correctly. Pixel readback test required. |

All three updated ROADMAP criteria are code-verified; all three require human/runtime confirmation for end-to-end assurance.

### Anti-Patterns Found

No new anti-patterns introduced by Plan 03 (documentation-only changes). Previously noted pre-existing TypeScript issue unchanged:

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/wasm/loader.ts` | 30 | `navigator.gpu` — TS2339 (Property 'gpu' does not exist on 'Navigator') | Info | Pre-existing from Phase 1; not a Phase 9 regression. Vite builds succeed (skipLibCheck). |

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
**Expected:** Output reads approximately 50% gray (not washed out to ~73% or darkened to ~21%, which would indicate gamma double-application or missing sRGB conversion).
**Why human:** End-to-end pixel measurement requires browser pixel readback or DevTools color picker over the canvas. The code path (rgba8unorm-srgb + colorSpaceConversion:'none') is correct in source; GPU/driver behavior is what needs confirming.

### Gaps Summary

No automated gaps remain. Both gaps from the initial verification are closed:

- Gap 1 (ROADMAP backgroundSrc criterion): Closed. Plan 03 commit `1e53f48` rewrote Phase 9 success criterion 1 to "bundled default wallpaper renders as the background behind glass components." `backgroundSrc` does not appear anywhere in ROADMAP.md Phase 9 block.

- Gap 2 (REQUIREMENTS.md IMG-03 Pending): Closed. Plan 03 task 2 confirmed REQUIREMENTS.md already had IMG-03 marked `[x] Complete` (it was fixed by commit `9f224d2` prior to Plan 03 running). Both checkbox and traceability table are accurate.

The remaining `human_needed` items are not gaps — they are runtime behaviors that cannot be verified programmatically from source inspection alone. The code is correctly wired for all three behaviors.

---

_Verified: 2026-02-25T18:30:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification of gaps_found from 2026-02-25T18:00:00Z_

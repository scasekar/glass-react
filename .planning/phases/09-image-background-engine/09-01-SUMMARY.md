---
phase: 09-image-background-engine
plan: 01
subsystem: engine
tags: [webgpu, wgsl, srgb, image-texture, emscripten, embind, wasm]

# Dependency graph
requires:
  - phase: 01-08 (v1.0)
    provides: "BackgroundEngine with noise pipeline, glass compositing, embind bindings"
provides:
  - "BackgroundMode enum with Image/Noise modes"
  - "uploadImageData API for RGBA pixel upload to sRGB texture"
  - "Image blit shader and pipeline for fullscreen texture rendering"
  - "Mode-switched render loop (image vs noise in Pass 1)"
  - "Embind uploadImageData and setBackgroundMode free functions"
  - "_malloc/_free exports for WASM heap pixel transfer"
affects: [09-02-react-integration, 10-image-pipeline, 13-visual-diff]

# Tech tracking
tech-stack:
  added: []
  patterns: ["sRGB image texture with RGBA8UnormSrgb format", "TexelCopyTextureInfo/TexelCopyBufferLayout for Dawn WriteTexture", "256-byte row alignment with padded buffer fallback", "Mode-switched Pass 1 render (image blit vs noise)"]

key-files:
  created:
    - engine/src/shaders/image_blit.wgsl.h
  modified:
    - engine/src/background_engine.h
    - engine/src/background_engine.cpp
    - engine/src/main.cpp
    - engine/CMakeLists.txt

key-decisions:
  - "Image is the default BackgroundMode (falls back to noise until texture uploaded)"
  - "Used TexelCopyTextureInfo/TexelCopyBufferLayout (Dawn C++ API names, not Web API ImageCopyTexture)"
  - "Embind free functions for uploadImageData/setBackgroundMode (not class methods) for uintptr_t WASM pointer support"

patterns-established:
  - "sRGB texture upload: RGBA8UnormSrgb format with automatic sRGB-to-linear on sample"
  - "Mode-switched render pass: check BackgroundMode + hasImageTexture_ to select pipeline"
  - "WASM heap transfer: export _malloc/_free, use uintptr_t in embind free functions"

requirements-completed: [IMG-01, IMG-02, IMG-04]

# Metrics
duration: 6min
completed: 2026-02-25
---

# Phase 9 Plan 01: Image Background Engine Summary

**Image texture upload with sRGB-correct blit pipeline, noise/image mode switching, and embind JS bindings with _malloc/_free exports**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-26T01:01:38Z
- **Completed:** 2026-02-26T01:07:48Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Image blit WGSL shader with fullscreen triangle sampling sRGB image texture
- uploadImageData API with RGBA8UnormSrgb texture, 256-byte row alignment, and padded buffer fallback
- Mode-switched render loop: image blit pipeline when Image mode + texture available, noise fallback otherwise
- Embind free functions (uploadImageData, setBackgroundMode) and _malloc/_free exports for WASM heap pixel transfer

## Task Commits

Each task was committed atomically:

1. **Task 1: Add image blit shader and image texture infrastructure** - `495771c` (feat)
2. **Task 2: Add Embind bindings and export _malloc/_free** - `f27b02a` (feat)

## Files Created/Modified
- `engine/src/shaders/image_blit.wgsl.h` - Fullscreen triangle WGSL shader sampling sRGB image texture
- `engine/src/background_engine.h` - BackgroundMode enum, uploadImageData/setBackgroundMode declarations, image texture members
- `engine/src/background_engine.cpp` - Image blit pipeline, uploadImageData with WriteTexture, mode-switched render()
- `engine/src/main.cpp` - uploadImageDataJS and setBackgroundModeJS embind free functions
- `engine/CMakeLists.txt` - EXPORTED_FUNCTIONS with _main, _malloc, _free

## Decisions Made
- Image is the default BackgroundMode -- engine falls back to noise until an image texture is uploaded, preventing crashes
- Used Dawn C++ API types (TexelCopyTextureInfo, TexelCopyBufferLayout) instead of Web API names (ImageCopyTexture, TextureDataLayout) discovered during build
- Embind free functions (not class methods) for uploadImageData because uintptr_t WASM pointer doesn't map cleanly through embind class bindings

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used Dawn C++ API types for WriteTexture**
- **Found during:** Task 1 (build verification)
- **Issue:** Plan specified `wgpu::ImageCopyTexture` and `wgpu::TextureDataLayout` which are Web/JS API names; Dawn C++ API uses `wgpu::TexelCopyTextureInfo` and `wgpu::TexelCopyBufferLayout`
- **Fix:** Changed to correct Dawn C++ types after inspecting the emdawnwebgpu header
- **Files modified:** engine/src/background_engine.cpp
- **Verification:** Engine compiles and links successfully
- **Committed in:** 495771c (Task 1 commit)

**2. [Rule 3 - Blocking] Added missing includes for vector and cstring**
- **Found during:** Task 1 (implementation of padded buffer in uploadImageData)
- **Issue:** uploadImageData uses std::vector and memcpy but headers were not included
- **Fix:** Added `#include <vector>` and `#include <cstring>`
- **Files modified:** engine/src/background_engine.cpp
- **Verification:** Compiles without errors
- **Committed in:** 495771c (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for compilation. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- C++ engine has complete image upload API, blit pipeline, and mode switching
- Ready for Plan 02: React/JS integration to decode images and call uploadImageData via WASM heap
- _malloc/_free exports enable JS to allocate heap memory, copy decoded pixels, and pass pointer

## Self-Check: PASSED

- All created files verified on disk
- All commit hashes verified in git log

---
*Phase: 09-image-background-engine*
*Completed: 2026-02-25*

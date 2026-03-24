# Pitfalls Research: v3.0 Architecture Redesign

**Domain:** WebGPU pipeline split — C++/WASM background engine + JS/WebGPU glass shader pipeline
**Researched:** 2026-03-24
**Confidence:** HIGH (core pitfalls verified against emdawnwebgpu source, WebGPU spec, and project history)

**Scope:** Pitfalls specific to the v3.0 redesign: flipping device ownership from C++ to JS, moving glass shaders from C++ WGSL to TypeScript WebGPU, sharing textures between WASM and JS, and maintaining visual parity after the rewrite.

Prior v2.0 pitfalls (sRGB texture formats, premultiplied alpha, copyExternalImageToTexture, simulator color space) remain valid and are NOT repeated here. This document covers only new risk surfaces introduced by the architectural split.

---

## Critical Pitfalls

---

### C1: emdawnwebgpu Object Handle Lifetime — JS Objects Deleted While C++ Holds the Handle

**What goes wrong:** JS calls `module.WebGPU.importJsDevice(device)` or `module.WebGPU.importJsTexture(texture)`, gets back an integer handle, and passes it to C++. Later, the JS GPUDevice or GPUTexture is garbage-collected or explicitly destroyed while C++ still holds the handle. C++ code then dereferences the stale handle, causing a crash, silent wrong-result, or device loss that is nearly impossible to trace.

**Why it happens:** `importJsDevice` / `importJsTexture` register the JS object in emdawnwebgpu's internal JS object table (`WebGPU.Internals.jsObjects`). The table holds only a weak conceptual reference — if the JS side drops the GPUDevice or GPUTexture reference, the entry becomes invalid. There is no automatic reference counting that keeps the JS object alive because the C++ handle holds it. The emdawnwebgpu `JsValStore` was designed for marshalling objects across call boundaries, not for long-lived ownership.

**How to avoid:**
1. Keep GPUDevice and GPUTexture alive in a JavaScript-owned variable (e.g., a `useRef` in GlassProvider) for the entire lifetime of the C++ engine that uses them.
2. Never call `device.destroy()` or `texture.destroy()` from JS while C++ is still running. Always destroy the C++ engine first (call `module.destroyEngine()`), then destroy JS WebGPU objects.
3. In the cleanup path of `GlassProvider`, enforce this order explicitly: `destroyEngine()` → `device.destroy()`. Add a comment explaining why the order matters.
4. Do not pass handles obtained from `importJsTexture` across React renders without ensuring the originating texture is still live. Particularly risky when `externalTexture` prop changes — the old handle becomes stale when the new texture arrives.

**Warning signs:**
- Device lost errors (`GPUDevice.lost` fires) with reason `"unknown"` or `"destroyed"` at unexpected times.
- C++ engine renders a frame correctly once, then produces black output or crashes on the second frame.
- Using `externalTexture` prop, switching to a new texture crashes rather than switching smoothly.

**Phase to address:** Phase 1 (JS device creation + C++ device injection). The handle lifetime contract must be established before any other cross-boundary code is written.

---

### C2: `preinitializedWebGPUDevice` / `emscripten_webgpu_get_device()` Are Deprecated — Do Not Use

**What goes wrong:** Developer follows old tutorials or blog posts that use `preinitializedWebGPUDevice` (a Module property set before WASM init) and `emscripten_webgpu_get_device()` on the C++ side to receive the pre-injected device. This pattern no longer works with emdawnwebgpu (the current WebGPU port in Emscripten 4.0.10+). The C++ function `emscripten_webgpu_get_device()` does not exist in emdawnwebgpu — it was part of the old `USE_WEBGPU` implementation that was deprecated and removed.

**Why it happens:** The project memory correctly documents this (`emscripten_webgpu_import_device()` does NOT exist in emdawnwebgpu). The correct pattern is `module.WebGPU.importJsDevice(device)` → `module.initWithExternalDevice(handle)`. The `loader.ts` already implements this correctly. The pitfall is accidentally reverting to the old pattern during the v3.0 rewrite when restructuring the loader.

**How to avoid:**
1. Use only `module.WebGPU.importJsDevice(jsDevice)` to register the JS device, then call `module.initWithExternalDevice(handle)` from JS.
2. The C++ side receives the device via the `handle` integer, not via any Emscripten-specific function.
3. When referencing external examples or docs, verify they target emdawnwebgpu specifically (not the old `-sUSE_WEBGPU`). Old examples predate Emscripten 4.0.10 and use the removed API.
4. Keep `loader.ts` as the single place where this bridging happens — do not spread device injection calls across multiple files.

**Warning signs:**
- Linker error: `undefined symbol: emscripten_webgpu_get_device` when building.
- C++ code compiles but `getEngine()` always returns null (device init never completes because the old hook is not triggered).
- Runtime error: `module.WebGPU` is undefined (happens if `--use-port=emdawnwebgpu` is missing from link flags).

**Phase to address:** Phase 1 (device ownership flip). Verified against project memory and emdawnwebgpu source.

---

### C3: AllowSpontaneous vs. WaitAny — Double WaitAny Corrupts emdawnwebgpu Instance Reference

**What goes wrong:** When C++ needs to await both RequestAdapter and RequestDevice in sequence, using `WaitAny()` twice corrupts emdawnwebgpu's internal `Instance` reference. The second `WaitAny` call on a different future causes emdawnwebgpu to release or reset the Instance it needs to operate, producing an invalid device, silent failures, or crashes on subsequent WebGPU calls.

**Why it happens:** This is a known emdawnwebgpu bug/limitation already discovered and documented in project memory. In the v3.0 redesign, the device init path in C++ is being restructured (JS creates the device and passes it in, so the C++ adapter/device request path changes). If the rewrite inadvertently reintroduces a double-WaitAny — for example, to wait for any async initialization after device injection — the corruption reappears.

**How to avoid:**
1. For device initialization in C++: use `AllowSpontaneous` chained callbacks, not `WaitAny` in sequence. The C++ `main()` already does this correctly in v2.0 — preserve this pattern in v3.0.
2. In the JS-creates-device path: device creation is entirely async in JS (using `navigator.gpu.requestAdapter()` → `adapter.requestDevice()`). Pass the already-resolved `GPUDevice` into C++ only after it is fully initialized. C++ does not need to `WaitAny` for the device at all in this pattern.
3. If any new async WebGPU initialization is needed on the C++ side after device injection, use `AllowSpontaneous` callbacks, not `WaitAny`.
4. Add a test: after engine init, verify `getEngine()` returns non-null and a test render completes without device loss.

**Warning signs:**
- `getEngine()` returns null indefinitely after `initWithExternalDevice()` is called.
- Device is acquired (JS `requestDevice()` succeeds) but the engine never starts rendering.
- Crash or silent hang inside `wgpu::Instance` methods after the second WaitAny.

**Phase to address:** Phase 1 (C++ engine restructuring for external device). Pre-existing known issue — must not regress.

---

### C4: Glass Shader Texture Coordinate Convention Drift During Port

**What goes wrong:** The C++ glass shader (`glass.wgsl.h`) uses a specific UV convention: Y is flipped in the vertex shader (`1.0 - (position.y * 0.5 + 0.5)`), and the SDF is computed in pixel space relative to canvas resolution. When the shader is re-implemented in TypeScript WebGPU, a subtle difference in UV convention (Y up vs. Y down), NDC coordinate mapping, or pixel-space SDF origin causes the glass effect to appear upside-down, mirrored, or displaced relative to the actual DOM element position.

**Why it happens:** The existing shader encodes three inter-related coordinate conventions that must all agree: (1) the vertex shader UV Y-flip, (2) the SDF pixel-space computation using `glass.resolution` and `glass.rect`, and (3) the `getBoundingClientRect()` values converted to normalized [0,1] space in `GlassProvider`. When transcribing from C++ WGSL (in a `.h` string) to TypeScript WGSL (in a `.ts` string), it is easy to accidentally change one convention without updating the others.

**How to avoid:**
1. Copy the existing `glass.wgsl.h` shader string verbatim as the starting point for the JS WGSL module. Do not rewrite from scratch — transcribe and refactor.
2. Add a visual regression test immediately after the port: render a single glass panel and verify its position, size, and corner radius match the expected pixel coordinates within 2px tolerance.
3. The pixel-space SDF test is the critical invariant: the glass mask must align with the element's `getBoundingClientRect()` at both 1x and 2x DPR. Test at both DPR values before declaring the port complete.
4. Document the UV convention explicitly in the new JS shader file: "Y is flipped in vertex shader; UV (0,0) is top-left; pixel space uses canvas.width × canvas.height."

**Warning signs:**
- Glass effect appears in the correct location visually but the mask is upside-down (effects show on the wrong side of the element).
- SDF distance field is correct in size but offset from the element by exactly `height - element.top` or similar systematic amount.
- Refraction direction is reversed (background appears to magnify inward instead of outward).

**Phase to address:** Phase 2 (JS glass pipeline, initial WGSL port). Pixel-position regression test should be a gate criterion for this phase.

---

### C5: Offscreen Texture Format Mismatch After Device Ownership Flip

**What goes wrong:** In v2.0, the C++ engine creates both the offscreen texture (background) and the glass pipeline textures — they share the same device and the C++ code controls all format decisions. In v3.0, JS creates the GPUDevice and may also create JS-side textures for the glass pipeline. If JS creates a texture with format `rgba8unorm` (sRGB-correct) and C++ creates its offscreen texture with `bgra8unorm` (preferred canvas format on macOS), sampling C++'s texture from the JS glass pipeline produces channel-swapped output (red and blue channels swapped).

**Why it happens:** `GPU.getPreferredCanvasFormat()` returns `bgra8unorm` on macOS/Chrome. C++ currently uses `surfaceFormat` for its offscreen texture. JS may default to `rgba8unorm`. These are incompatible formats and `textureSample()` does not swap channels — it reads whatever raw bytes are there, so BGRA stored in an RGBA texture view produces swapped R/B channels.

**How to avoid:**
1. Establish a single canonical offscreen texture format agreed upon by both JS and C++ before writing any code. Recommendation: `rgba8unorm` for all offscreen textures (it is universally supported for sampling). Use the canvas-preferred format only for the swap chain surface.
2. In C++, do not use `surfaceFormat` for the offscreen texture — use an explicit `wgpu::TextureFormat::RGBA8Unorm`. This is already done for the image texture; apply the same discipline to the noise offscreen texture.
3. The JS glass pipeline must sample the texture with the format the C++ engine actually creates. Have C++ expose `getOffscreenTextureFormat()` (or hard-code RGBA8Unorm) so JS can verify alignment at startup.
4. Add a one-frame validation render at engine startup: clear the offscreen texture to a known RGBA value (e.g., `(255, 0, 0, 255)` = pure red), sample it from JS, verify the JS-side reads `(1.0, 0.0, 0.0)`. This catches channel swap immediately.

**Warning signs:**
- Glass effect shows the background with cyan where red objects should be (R/B swap: `rgba8` reading `bgra8` bytes).
- Correct colors on Windows/Linux (where preferred format is `rgba8unorm`) but wrong on macOS (where it is `bgra8unorm`).
- sRGB-vs-linear artifacts (one side applies gamma, the other does not).

**Phase to address:** Phase 1 (C++ engine restructuring) and Phase 2 (JS glass pipeline creation). Must be verified at the first texture handoff test.

---

### C6: JS Glass Pipeline Skips DPR Scaling — Effects Look Different on Retina Displays

**What goes wrong:** The existing C++ glass shader has DPR-aware scaling baked in at multiple points: `cornerRadius * dpr`, `blurRadius * dpr`, `cssDist = dist / dpr` for rim/specular falloff. When the glass shader is ported to JS, the DPR uniform must be populated identically. If the JS pipeline omits the DPR field, or populates it but from the wrong source (e.g., a stale value captured at mount time instead of the current display DPR), the glass effect looks correct on 1x displays but has over-large blur, over-thick rims, and wrong corner radii on Retina displays.

**Why it happens:** DPR awareness in this codebase was a late addition (added in the v2.0 session that produced the HANDOFF.md). The uniform struct layout was retrofitted (repurposing `_pad7` at offset 108). When porting the shader to JS, a developer reading the struct definition may miss the DPR field because it is at the end of the struct and named to look like "just another scalar." DPR also changes at runtime when moving a window between displays — the engine must respond to ResizeObserver callbacks and update DPR dynamically.

**How to avoid:**
1. Copy the full `GlassUniforms` struct layout to the JS uniform buffer spec with explicit byte offsets. Include a comment at each field documenting its role, including `dpr` at offset 108.
2. The JS pipeline's `ResizeObserver` callback must call `setDpr(window.devicePixelRatio)` (or equivalent) in addition to updating canvas dimensions — the same pattern as `GlassProvider.tsx`.
3. Add a DPR regression test: render at `devicePixelRatio = 2`, verify corner radius in pixels is exactly `2 × cssCornerRadius`, and blur width is `2 × cssBlurRadius`.
4. When `externalTexture` mode is active (C++ renders scene, JS renders glass), the DPR is the same for both pipelines since they share the same canvas and device. No conversion is needed.

**Warning signs:**
- Glass effects look correct in Chrome DevTools at 1x zoom but have overly large blur at 2x zoom.
- Corner radius appears half the expected size on Retina Mac.
- Rim highlight is 1px wide on Retina instead of the intended CSS-pixel width.

**Phase to address:** Phase 2 (JS glass pipeline). Must be part of the initial DPR test suite gate.

---

### C7: Uniform Buffer Alignment Divergence Between C++ Struct and JS TypedArray

**What goes wrong:** The C++ `GlassUniforms` struct at 112 bytes (7 × 16-byte vec4f blocks) is carefully padded to meet WGSL's alignment rules. When the JS side constructs the same uniform data in a `Float32Array` and writes it to a GPUBuffer, even a single off-by-4-byte error in field ordering produces entirely wrong shader results — the wrong float lands in the wrong uniform slot. The shader does not validate types; it just reads whatever bytes arrive.

**Why it happens:** WGSL struct layout rules require vec3f to be padded to 16 bytes, and vec4f blocks must align to 16-byte boundaries. The C++ struct mirrors this with explicit `_pad` fields. In JS, `Float32Array` is filled positionally — if the developer misreads the struct (e.g., writes `tint.r, tint.g, tint.b` as 3 floats without the implicit 4th padding float that makes it a vec4), all subsequent fields shift by 4 bytes and produce nonsensical values.

**How to avoid:**
1. Create a `buildGlassUniformData(params: GlassUniforms): Float32Array` helper function in TypeScript with explicit index assignments keyed to documented byte offsets: `data[0] = rect.x // offset 0`, `data[4] = cornerRadius // offset 16`, etc. Never use positional filling (`data[i++] = ...`).
2. Add a compile-time assertion: `Float32Array.BYTES_PER_ELEMENT * data.length === 112` — the expected struct size.
3. Write a unit test that creates a known uniform buffer, reads it back in a trivial shader that outputs a single uniform value to a storage texture, and verifies the output matches the input. This catches byte-offset errors before any visual debugging.
4. Reference `background_engine.h` as the source of truth for field offsets. If the C++ struct changes, update the JS helper function in the same commit.

**Warning signs:**
- Shader renders but every visual parameter is wrong — blur is 0 or extreme, tint color is wrong, rect is at 0,0.
- Changing one parameter in JS changes the visual output of a different parameter (offset slide).
- In Chrome WebGPU DevTools, the uniform buffer contents look correct but the shader output is wrong (mismatch between write and read layout).

**Phase to address:** Phase 2 (JS glass pipeline). The uniform helper should be written and unit-tested before the first end-to-end glass render.

---

### C8: Scene Texture Used as Both Render Target and Sample Source in Same Frame

**What goes wrong:** C++ writes the background scene to the offscreen texture in Pass 1. JS then reads that texture in the glass pass. If both passes are submitted in the same `GPUCommandEncoder.finish()` / `queue.submit()`, WebGPU's implicit synchronization handles the hazard. But if JS reads the texture from a _previous_ `queue.submit()` while C++ is writing it in a _concurrent_ submit, or vice versa, the result is undefined — either the glass samples a partially-written frame (tearing) or the driver inserts unexpected stalls.

**Why it happens:** In v2.0, both passes are encoded by the same C++ code in the same `render()` call, submitted together — no hazard possible. In v3.0, C++ submits a command buffer for background rendering, and JS submits a separate command buffer for glass rendering. If these are submitted in the same JS event loop tick (which requestAnimationFrame guarantees), the browser/GPU driver serializes them. But the order of submission matters: C++ background must finish before JS glass reads the texture.

**How to avoid:**
1. Structure the render loop so C++ `engine.render()` (background pass submit) is called first, then JS glass pipeline submits its command buffer in the same rAF callback. The single-threaded JS event loop ensures sequential ordering within one rAF tick.
2. Never submit the JS glass command buffer from a different async context (setTimeout, Promise microtask) than the C++ render call — this can reorder submissions across frames.
3. Verify the C++ engine uses `device.queue.submit([commandBuffer])` (not deferred submits) so the background is GPU-committed before JS reads it.
4. Add a test frame: render a solid-color background, read one pixel from the glass output, verify it matches the background color (before glass effects are applied) — this proves the texture is fully written before the glass pass runs.

**Warning signs:**
- Occasional flickering where the glass shows the previous frame's background (one-frame-old texture contents).
- Frame-rate-dependent artifacts (looks correct at 30 FPS but flickers at 60 FPS).
- Chrome GPU timeline shows the glass pass starting before the background pass completes.

**Phase to address:** Phase 2 (render loop integration). The rAF ordering contract must be documented and enforced.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep glass WGSL shader as a raw string in a `.ts` file | No build step for shader compilation | No syntax checking, refactoring, or IDE support for WGSL | MVP only — add a `.wgsl` file + Vite raw import once the port is proven |
| Skip uniform buffer unit tests during initial port | Faster first render | Byte-offset bugs silently corrupt visual output; root cause is hard to find | Never — write the offset tests first |
| Pass GPUTexture handle from C++ `getBackgroundTextureHandle()` as an integer and re-import it in JS via `WebGPU.getJsObject()` each frame | No C++ API changes needed | `jsObjects` table lookup on every frame; stale handle if C++ recreates texture on resize | Only if texture is stable (not recreated on resize) — prefer a persistent JS reference |
| Reuse the existing single GPU canvas for both C++ background and JS glass | No architectural changes | Canvas context is owned by C++ surface; JS glass pipeline cannot also configure the same canvas as a WebGPU context | Never — JS glass must render to the same surface as C++, which requires coordinated surface ownership |
| Delay DPR fix to "after the port works" | Simpler initial implementation | Visual regression test failures on Retina will block CI; hard to retrofit DPR awareness after shader is stabilized | Never — include DPR from the first working glass render |

---

## Integration Gotchas

Common mistakes when connecting C++ WASM and JS WebGPU code.

| Integration Point | Common Mistake | Correct Approach |
|---|---|---|
| `module.WebGPU.importJsDevice(device)` | Calling before `createEngineModule()` resolves (Module not yet initialized) | Call only inside the `.then()` callback of `createEngineModule()`, after checking `module.WebGPU?.importJsDevice` is defined |
| `module.initWithExternalDevice(handle)` | Calling it, then immediately calling `module.getEngine()` and getting null | `initWithExternalDevice` triggers async C++ device init; poll `getEngine()` with `setTimeout(50ms)` loop as in current `loader.ts` |
| C++ `getBackgroundTexture()` handle | Returning handle as-is and assuming it is stable across frames | Handle is stable as long as C++ does not recreate the offscreen texture (e.g., on resize). On resize, C++ destroys and recreates the texture — JS must re-fetch the handle |
| JS `GPUDevice` creation before WASM init | Creating the device and immediately passing to WASM — adapter features may not be requested | Request all needed adapter features/limits (`timestamp-query`, etc.) during `requestDevice()` before passing to WASM. C++ cannot request additional features after the fact |
| emdawnwebgpu `--use-port=emdawnwebgpu` flag | Adding to compile flags only, missing from link flags | Must appear in BOTH `-DCMAKE_CXX_FLAGS` AND `-DCMAKE_EXE_LINKER_FLAGS` — confirmed in project memory |

---

## Performance Traps

Patterns that work at small scale but cause problems under load.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| JS glass pipeline creates a new `GPUBindGroup` per region per frame to bind the scene texture | Frame time spikes at >4 glass regions | Pre-create one bind group per region at setup time; only recreate when the underlying texture changes (resize or external texture swap) | Breaks at ~4 regions on mid-range hardware |
| JS re-creates glass pipeline objects (shader modules, pipelines, bind group layouts) on every React re-render | 100ms+ stalls on each re-render | Store pipeline objects in a `useRef` or a singleton outside React's render cycle; never recreate in the render function | Breaks on first non-trivial re-render |
| Per-region `queue.writeBuffer()` called individually from React event handlers (e.g., slider drag) | Jank during parameter updates | Collect all pending uniform updates in a JS object, flush them all in the rAF callback as a single `writeBuffer` covering the full uniform buffer | Breaks when any tuning slider is active |
| 81-tap Gaussian blur evaluated per-region in the glass shader | GPU fragment shader cost grows linearly with regions | Region count is capped at 16 in C++ (`MAX_GLASS_REGIONS`); enforce same cap in JS — do not lift it without measuring cost | Breaks at >8 regions on mobile/integrated GPU |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Device injection:** `module.initWithExternalDevice(handle)` is called and returns — verify `getEngine()` eventually returns non-null (async init may still be in progress)
- [ ] **Scene texture bridge:** C++ `getBackgroundTextureHandle()` returns a handle — verify the JS-side `importJsTexture` or `getJsObject` lookup produces a valid GPUTexture, not `undefined`
- [ ] **Glass pass ordering:** JS glass command buffer is submitted after C++ background submit in the same rAF tick — verify by logging submit order in a debug build for 10 frames
- [ ] **Resize handling:** Canvas is resized → C++ recreates offscreen texture → JS re-fetches texture handle → JS recreates bind group — all four steps must be wired, not just the first
- [ ] **Shader port completeness:** WGSL port compiles and produces visible output — verify all 15 GlassUniforms fields (including `dpr` at offset 108) are populated correctly by running the uniform offset unit test
- [ ] **Visual parity baseline:** A 3-second video of the glass effect post-port looks identical to pre-port — run the existing `npm run diff` and verify the score does not regress more than 2% from the v2.0 baseline before proceeding to re-tuning

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| C1: Stale JS object handle | MEDIUM | Add explicit `handle = null` assignments at cleanup boundaries; check `module.WebGPU.Internals.jsObjects[handle]` in browser console to confirm object is still live |
| C3: WaitAny corruption | HIGH | Revert C++ init path to the `AllowSpontaneous` pattern from v2.0 baseline; do not attempt to fix with additional WaitAny calls |
| C4: UV convention mismatch | LOW | Apply the known Y-flip: change `uv.y = 1.0 - uv.y` in the vertex shader; run position regression test to confirm |
| C5: Channel swap (BGRA/RGBA) | LOW | Add `if (format === 'bgra8unorm') swapChannels = true` guard in JS and add explicit `rgba8unorm` to C++ offscreen texture creation |
| C7: Uniform offset error | MEDIUM | Add explicit `console.log` of every field in the JS uniform buffer builder, compare against C++ struct offsets in `background_engine.h` field by field |
| C8: Texture read/write ordering | MEDIUM | Ensure both C++ submit and JS submit happen in the same rAF callback in fixed order (C++ first); add 1-frame pipeline barrier test |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| C1: Handle lifetime | Phase 1 — JS device creation | Cleanup test: destroy engine while device is live; verify no crash |
| C2: Deprecated device pattern | Phase 1 — C++ restructuring | Build succeeds with no `emscripten_webgpu_*` calls in C++ |
| C3: Double WaitAny | Phase 1 — C++ restructuring | Engine starts rendering within 2s; `getEngine()` returns non-null |
| C4: UV convention drift | Phase 2 — WGSL shader port | Position regression: glass aligns with DOM element ±2px at 1x and 2x DPR |
| C5: Texture format mismatch | Phase 1 + Phase 2 | Color correctness test: solid red background renders as red through glass (not cyan) |
| C6: DPR scaling omission | Phase 2 — JS pipeline | DPR regression: 2× DPR produces same CSS-pixel sizes as 1× DPR |
| C7: Uniform buffer alignment | Phase 2 — JS pipeline | Uniform offset unit test passes for all 28 float fields in GlassUniforms |
| C8: Frame ordering hazard | Phase 2 — render loop integration | No flickering over 1000 rAF frames; chrome GPU timeline shows background before glass |

---

## Sources

- [Emscripten mixed JS/WASM WebGPU issue #13888](https://github.com/emscripten-core/emscripten/issues/13888) — JsValStore design and importJsDevice origin — MEDIUM confidence (GitHub issue, author is Austin Eng / Chrome WebGPU team)
- [emdawnwebgpu README](https://dawn.googlesource.com/dawn/+/refs/heads/main/src/emdawnwebgpu/pkg/README.md) — emdawnwebgpu port distribution and versioning — HIGH confidence (official Dawn source)
- [WebGPU Bind Group Best Practices — toji.dev](https://toji.dev/webgpu-best-practices/bind-groups.html) — bind group recreation cost — HIGH confidence
- [WebGPU Device Loss Best Practices — toji.dev](https://toji.dev/webgpu-best-practices/device-loss.html) — device lost recovery, resource recreation — HIGH confidence
- [WebGPU Data Memory Layout — webgpufundamentals.org](https://webgpufundamentals.org/webgpu/lessons/webgpu-memory-layout.html) — uniform buffer alignment and offset computation — HIGH confidence
- [WebGPU Uniforms — webgpufundamentals.org](https://webgpufundamentals.org/webgpu/lessons/webgpu-uniforms.html) — Float32Array uniform buffer population pitfalls — HIGH confidence
- [WebGPU Multiple Render Passes — matthewmacfarquhar.medium.com](https://matthewmacfarquhar.medium.com/webgpu-rendering-part-6-multiple-render-passes-b42157dfbcb5) — multi-pass texture ordering — MEDIUM confidence
- [gpuweb/gpuweb issue #1388: getCurrentTexture binding identity](https://github.com/gpuweb/gpuweb/issues/1388) — texture handle uniqueness per frame — HIGH confidence (gpuweb spec issue)
- [Emscripten emdawnwebgpu deprecation of USE_WEBGPU — issue #24265](https://github.com/emscripten-core/emscripten/issues/24265) — `preinitializedWebGPUDevice` removal — HIGH confidence
- Project memory: `AllowSpontaneous` vs. double `WaitAny` — known emdawnwebgpu issue, already validated in production
- Project memory: `--use-port=emdawnwebgpu` required in both compile and link — already validated in production
- Project source: `engine/src/background_engine.h` — `GlassUniforms` struct with byte-offset comments — HIGH confidence (source of truth)
- Project source: `engine/src/shaders/glass.wgsl.h` — UV convention, DPR scaling, SDF pixel-space computation — HIGH confidence (source of truth)
- Project source: `src/wasm/loader.ts` — `importJsDevice` / `initWithExternalDevice` pattern — HIGH confidence (working implementation)

---
*Pitfalls research for: v3.0 JS/WASM WebGPU pipeline split*
*Researched: 2026-03-24*

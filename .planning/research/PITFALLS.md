# Domain Pitfalls: v2.0 Visual Parity Milestone

**Domain:** WebGPU/WASM glass rendering -- image backgrounds, shader tuning, visual comparison
**Researched:** 2026-02-25
**Scope:** Pitfalls specific to adding image backgrounds, shader parameter exposure, live tuning, SwiftUI reference app, and automated visual diffing to an existing WebGPU/WASM glass component library.

---

## Critical Pitfalls

Mistakes that cause rewrites, broken rendering, or invalidated visual comparison workflows.

---

### C1: Image Texture Color Space Mismatch (sRGB vs Linear)

**What goes wrong:** Loading a JPEG/PNG image into a `rgba8unorm` texture and sampling it in the glass shader produces washed-out or over-saturated colors compared to the same image displayed natively on iOS. The glass effect looks "wrong" but you cannot figure out why because the shader math appears correct.

**Why it happens:** JPEG and PNG images are encoded with sRGB gamma. When loaded into `rgba8unorm`, the raw non-linear sRGB values are stored as-is. The glass shader then operates on these non-linear values -- blur averaging, tint mixing, and specular addition all produce mathematically incorrect results because linear math on gamma-encoded values skews luminance. Conversely, loading into `rgba8unorm-srgb` automatically converts to linear on sample, but if your pipeline expects non-linear values (e.g., your surface format is `bgra8unorm` without sRGB), compositing introduces a double-gamma or missing-gamma error.

**Consequences:**
- Blurred regions appear darker than expected (averaging gamma-encoded values pulls toward dark)
- Tint colors do not match their hex equivalents
- Visual comparison against iOS reference will never converge because the color math is fundamentally wrong
- Debugging is extremely difficult because the error is subtle and pervasive

**Prevention:**
1. Decide on a pipeline color space up front: **use linear-light internally, sRGB on output**
2. Load images into `rgba8unorm-srgb` format so `textureSample()` returns linear values automatically
3. The current offscreen texture uses `surfaceFormat` (likely `bgra8unorm` from `getPreferredCanvasFormat()`). Create the image texture separately with `rgba8unorm-srgb` format -- do not reuse the surface format
4. Perform all glass shader math (blur, tint, aberration, specular) in linear space
5. Apply sRGB encoding only at final output to the surface, or use an sRGB surface view

**Detection:**
- Gray card test: render a 50% gray image through the glass shader with zero tint/blur -- if the output is not 50% gray, you have a gamma error
- Compare a flat-color background (pure red #FF0000) with zero glass effects -- output must match input exactly

**Confidence:** HIGH -- verified via [WebGPU Fundamentals](https://webgpufundamentals.org/webgpu/lessons/webgpu-importing-textures.html), [MDN copyExternalImageToTexture](https://developer.mozilla.org/en-US/docs/Web/API/GPUQueue/copyExternalImageToTexture), and [gpuweb issue #1715](https://github.com/gpuweb/gpuweb/issues/1715)

**Phase:** Image Background (must be resolved before any visual comparison work begins)

---

### C2: Premultiplied Alpha Mismatch Between Image Texture and Canvas

**What goes wrong:** The loaded image texture has straight (non-premultiplied) alpha, but the canvas is configured with `alphaMode: 'premultiplied'` (the default and only universally supported mode). Glass regions composite correctly over the background but areas with partial alpha produce bright fringing or dark halos at edges.

**Why it happens:** The current glass shader outputs `vec4f(outColor, outAlpha)` where `outColor` is NOT premultiplied by `outAlpha`. With a premultiplied canvas, this creates "illegal colors" where `r > a` -- the spec says this produces undefined compositing results. This works today because the background blit writes alpha=1.0 everywhere, but once image backgrounds with actual transparency are introduced (PNG with alpha), or if the blend state interacts with semi-transparent glass edges, the mismatch surfaces.

Additionally, `copyExternalImageToTexture` has a `premultipliedAlpha` parameter that defaults to `false`. If you set it to `true` but the image is already premultiplied (e.g., from canvas source), you get double-premultiplication. If you set it to `false` but your blend state expects premultiplied, you get bright fringes.

**Consequences:**
- Bright white or colored fringing at glass region edges over transparent image areas
- Incorrect blending when glass regions overlap
- Subtle color shifts that break visual parity comparison

**Prevention:**
1. Use `premultipliedAlpha: true` when calling `copyExternalImageToTexture` for loaded images
2. Ensure the glass shader output is premultiplied: change final output to `vec4f(outColor * outAlpha, outAlpha)` or use blend factors `srcFactor: 'one', dstFactor: 'one-minus-src-alpha'` (premultiplied blend)
3. For the initial image background mode, restrict to opaque images (alpha=1.0 everywhere) to sidestep the issue, then address premultiplied alpha properly when needed
4. Audit the existing blend state in `createGlassPipeline()` -- it currently uses `srcFactor: SrcAlpha` which is the un-premultiplied blend mode

**Detection:**
- Render a glass region over a checkerboard PNG with alpha -- check for fringing at region edges
- Overlap two glass regions and check for brightness discontinuity at the overlap

**Confidence:** HIGH -- verified via [WebGPU Transparency and Blending](https://webgpufundamentals.org/webgpu/lessons/webgpu-transparency.html) and [gpuweb issue #1762](https://github.com/gpuweb/gpuweb/issues/1762)

**Phase:** Image Background

---

### C3: copyExternalImageToTexture Requires RENDER_ATTACHMENT Usage Flag

**What goes wrong:** You create the image texture with `COPY_DST | TEXTURE_BINDING` usage (which seems logical for "copy data in, then sample it"), but `copyExternalImageToTexture` throws a validation error at runtime demanding `RENDER_ATTACHMENT` usage too.

**Why it happens:** Despite the name "copy," `copyExternalImageToTexture` may internally use a render pass for color space conversion, Y-axis flipping, or format conversion. The browser's implementation needs the texture to be usable as a render target even though you never explicitly render to it. This requirement is documented but deeply counterintuitive.

**Consequences:**
- Hard validation error at texture upload time, no rendering at all
- If you add RENDER_ATTACHMENT after the fact, you may need to recreate bind groups and pipelines that reference the texture

**Prevention:**
1. Always create image textures with `COPY_DST | TEXTURE_BINDING | RENDER_ATTACHMENT`
2. This is the same usage pattern as the existing offscreen texture, so follow that precedent
3. Document this requirement in the texture creation code with a comment

**Detection:** Immediate -- WebGPU validation will reject the call with a clear error message.

**Confidence:** HIGH -- verified via [gpuweb issue #3357](https://github.com/gpuweb/gpuweb/issues/3357) and [MDN copyExternalImageToTexture](https://developer.mozilla.org/en-US/docs/Web/API/GPUQueue/copyExternalImageToTexture)

**Phase:** Image Background

---

### C4: Image Loading Boundary -- JS Must Load, C++ Cannot

**What goes wrong:** You try to implement image loading entirely in C++/WASM using Emscripten's file system or fetch APIs, leading to complex async coordination, large binary size from bundled image decoders, and inability to use the browser's optimized image decoding pipeline.

**Why it happens:** `copyExternalImageToTexture` accepts browser-native types (ImageBitmap, HTMLImageElement, etc.) that exist only in JavaScript. Emscripten's WebGPU bindings (emdawnwebgpu) expose the C++ `wgpu::` API but do NOT expose `copyExternalImageToTexture` because ImageBitmap is not a C++ type. The image must be decoded and uploaded to the GPU from JavaScript, then the C++ code can sample the resulting texture.

**Consequences:**
- If you try to do it in C++: massive complexity, bundled decoders inflate WASM binary, bypass browser's parallel image decoding
- If the JS-to-C++ texture handoff is designed wrong: you end up with two textures (one JS-created, one C++-created) on different bind groups, requiring a pipeline redesign

**Prevention:**
1. Image loading lives in JavaScript: `fetch() -> blob -> createImageBitmap() -> copyExternalImageToTexture()`
2. Use `EM_ASM` or Embind to bridge: JS loads image into the same texture the C++ engine already samples from, OR JS creates a new texture and passes the handle to C++ via `Module.WebGPU.getJSTexture(handle)` / `Module.WebGPU.mGetDevice()`
3. Design the C++ engine to accept "texture was updated" signals rather than owning the texture lifecycle
4. The cleanest pattern: JS creates the image texture, then C++ replaces its offscreen texture view in the bind group with the image texture view. This requires C++ to expose a `setBackgroundTexture(wgpu::TextureView)` API

**Detection:**
- Architecture review: if image loading code is in a `.cpp` file, stop and redesign
- If WASM binary grows by > 100KB for image support, image decoding is probably compiled in

**Confidence:** MEDIUM -- based on [Emscripten mixed JS/WASM WebGPU](https://github.com/emscripten-core/emscripten/issues/13888), [toji.dev best practices](https://toji.dev/webgpu-best-practices/img-textures.html), and project experience with emdawnwebgpu limitations

**Phase:** Image Background (architecture decision must be made before implementation)

---

### C5: Surface Format Mismatch Between Image Texture and Offscreen Texture

**What goes wrong:** The image texture is created with `rgba8unorm-srgb` (correct for sRGB images) but the offscreen texture uses `surfaceFormat` (likely `bgra8unorm` from `getPreferredCanvasFormat()`). You cannot simply swap one for the other in the bind group because the formats are incompatible. Or worse, you create the image texture with `bgra8unorm` to match, but `copyExternalImageToTexture` only supports `rgba8unorm` family formats for external images.

**Why it happens:** macOS Chrome returns `bgra8unorm` as the preferred canvas format (because Metal/IOSurface requires BGRA). But external image data is inherently RGBA. The glass shader's `textureSample` call and sampler work the same regardless of format, but the bind group layout's texture format must match the actual texture format. If you have two background modes (noise=bgra8unorm, image=rgba8unorm-srgb), you need the bind group to handle both.

**Consequences:**
- Validation errors when switching between noise and image background modes
- Red and blue channels swapped if format mismatch is not caught by validation
- Pipeline recreation needed to switch formats, causing frame drops

**Prevention:**
1. Standardize on a single format for the offscreen texture. Use `rgba8unorm` as the offscreen texture format regardless of surface format -- the glass shader renders to the surface (bgra8unorm) as the final output, and WebGPU handles the format conversion
2. Alternatively, render the image to the existing offscreen texture via a dedicated "image blit" pass rather than replacing the texture -- this avoids format conflicts entirely
3. The simplest approach: keep Pass 1 but swap noise rendering for image rendering. Load image into `rgba8unorm` texture, then blit/copy to the existing offscreen texture in the same format as before. Pass 2 (glass) remains unchanged

**Detection:**
- Validation error mentioning format mismatch at bind group creation
- Color channels appear swapped (red skin tones appear blue)

**Confidence:** HIGH -- based on [gpuweb issue #2535](https://github.com/gpuweb/gpuweb/issues/2535) and [MDN getPreferredCanvasFormat](https://developer.mozilla.org/en-US/docs/Web/API/GPU/getPreferredCanvasFormat) confirming macOS returns bgra8unorm

**Phase:** Image Background

---

### C6: SwiftUI .glassEffect() Renders Dark on Physical Device

**What goes wrong:** Your SwiftUI reference app looks perfect in the iOS Simulator -- beautiful frosted glass -- but on a physical iPhone the glass effect renders as a dark, muddy gray. Your entire visual comparison pipeline is calibrated against the simulator's (correct-looking) output. When you finally test on device, everything needs recalibration.

**Why it happens:** This is a **confirmed iOS 26 beta bug** reported by multiple developers on Apple Developer Forums. The `.glassEffect()` modifier produces different rendering on physical devices versus the simulator. No known workaround exists as of iOS 26.0-26.0.1. Apple has acknowledged the issue but has not confirmed a fix timeline.

**Consequences:**
- Visual comparison pipeline calibrated against simulator output is useless for real-device parity
- Shader parameters tuned to match simulator glass will not match device glass
- If the bug is fixed in a later iOS 26 beta, parameters need re-tuning
- The reference itself (what you are matching against) is unstable

**Prevention:**
1. **Use the simulator as the reference target**, not the physical device. Document that the comparison is "our web rendering vs. iOS Simulator rendering of .glassEffect()"
2. Pin the Xcode version and iOS Simulator runtime version used for reference screenshots. Record these versions in the comparison metadata
3. Design the tuning pipeline to be re-runnable -- when Apple fixes the bug, you re-capture reference screenshots and re-tune
4. Consider capturing reference from BOTH simulator and device, and track parity between them as a separate metric
5. Monitor Apple Developer Forums thread [#814005](https://developer.apple.com/forums/thread/814005) for resolution

**Detection:**
- First time running the reference app on a physical device, the glass looks noticeably darker
- A/B comparison between simulator and device screenshots shows SSIM < 0.85

**Confidence:** HIGH -- verified via [Apple Developer Forums](https://developer.apple.com/forums/thread/814005), [JuniperPhoton's Liquid Glass pitfalls post](https://juniperphoton.substack.com/p/adopting-liquid-glass-experiences)

**Phase:** SwiftUI Reference App

---

### C7: iOS Simulator Screenshots Are Not Color-Managed for P3

**What goes wrong:** You capture screenshots from the iOS Simulator using `xcrun simctl io booted screenshot`, compare them pixel-by-pixel against browser screenshots, and the colors never match even for flat solid backgrounds. You waste days tuning shader parameters to compensate for what turns out to be a color space metadata problem, not a rendering problem.

**Why it happens:** The iOS Simulator is not properly color-managed. It renders in sRGB-like color space but screenshots are assigned a Generic RGB profile regardless of the simulated device's actual color gamut (Display P3 for iPhone 16 Pro). Meanwhile, browser canvas screenshots may carry an sRGB or untagged profile. Pixel-for-pixel comparison of unmanaged profiles produces false diffs that have nothing to do with actual visual differences.

Additionally, if the "Optimize Rendering for Window Scale" debug option is on in the simulator, screenshots may be saved at a reduced resolution, introducing scaling artifacts that contaminate the diff.

**Consequences:**
- Pixel diff shows 5-15% difference on a solid color that looks identical to the eye
- Auto-tuning algorithm chases color space conversion artifacts instead of actual shader parameter differences
- Parameters converge to values that compensate for the color space mismatch rather than matching the visual effect

**Prevention:**
1. **Normalize both screenshots to the same color space before comparison.** Convert all screenshots to sRGB before diffing: `sips --matchTo "/System/Library/ColorSync/Profiles/sRGB Profile.icc" screenshot.png`
2. Disable "Debug > Optimize Rendering for Window Scale" in the simulator before capturing screenshots
3. Run the simulator at physical pixel scale (point size * scale factor) for the reference device
4. Use perceptual comparison metrics (SSIM, CIEDE2000) instead of raw pixel diff -- they are more robust to color space metadata differences
5. Include a color calibration patch (known sRGB colors) in both the SwiftUI reference and the web demo, and verify these patches match before comparing glass effects

**Detection:**
- Compare a solid `#FF0000` red in both apps -- if pixel values differ by > 2/255, you have a color space normalization problem
- Check the ICC profile of both screenshots with `sips --getProperty profile screenshot.png`

**Confidence:** MEDIUM -- based on [Apple Developer Forums color management discussions](https://developer.apple.com/forums/thread/111818), [P3 vs sRGB exploration](https://medium.com/@heypete/adventures-in-wide-color-an-ios-exploration-2934669e0cc2)

**Phase:** Automated Visual Diffing (must be resolved before auto-tuning can begin)

---

## Moderate Pitfalls

---

### M1: Shader Parameter Explosion -- Too Many Uniforms Updated Per Frame

**What goes wrong:** Exposing all glass shader parameters as React props leads to every prop change triggering a uniform buffer update. With live tuning UI sliders sending continuous updates across 10+ parameters and 16 potential glass regions, you hit the bottleneck of `WriteBuffer()` calls per frame, causing frame drops below 60 FPS.

**Why it happens:** Each `setRegion*` call from React triggers a `WriteBuffer` call on the GPU queue. The current architecture writes the entire `GlassUniforms` struct (80 bytes) per region per frame. With 16 regions, that is 16 * 80 = 1,280 bytes per frame. Adding more uniforms (say, doubling to 160 bytes per region for new exposure parameters) increases this to 2,560 bytes -- still small. But the **overhead is in the API call count**, not the byte count. Each `WriteBuffer` is a CPU-side command that synchronizes with the GPU timeline.

**Prevention:**
1. Batch all uniform updates into a single `WriteBuffer` call per frame. The current code already writes per-region in the render loop -- consolidate by writing the entire uniform buffer (all 16 regions) in one call
2. Use the existing `update()` method to apply parameter changes (via lerp targets), and write the uniform buffer once in `render()`. This is already the architecture -- ensure new parameters follow the same pattern
3. Split static and dynamic uniforms into separate bind groups: parameters that change per-frame (rect, morphing) in one group, parameters that change on user interaction (tint, blur, etc.) in another
4. For the live tuning UI, throttle slider updates to 60 Hz (requestAnimationFrame) rather than React's re-render rate

**Detection:**
- Profile with Chrome DevTools GPU timeline: look for excessive `WriteBuffer` gaps
- Frame time > 16.6ms with the tuning panel open but stable with it closed

**Confidence:** HIGH -- based on [WebGPU optimization best practices](https://webgpufundamentals.org/webgpu/lessons/webgpu-optimization.html) and [bind group best practices](https://toji.dev/webgpu-best-practices/bind-groups.html)

**Phase:** Shader Parameter Exposure / Live Tuning UI

---

### M2: Auto-Tuning Converges to Local Minimum Instead of Visual Match

**What goes wrong:** The automated parameter search reduces the diff metric to a low value but the result does not look like Apple's Liquid Glass to the human eye. The algorithm finds a "good enough" local minimum where, for example, it compensates for missing refraction by increasing blur, or compensates for wrong tint by shifting specular color.

**Why it happens:** The shader parameter space is high-dimensional (10+ parameters) and the loss landscape has many local minima. Simple hill-climbing or grid search gets stuck. Additionally, pixel-based or SSIM-based metrics do not perfectly correlate with human perception of "glass-like quality" -- the algorithm may optimize for structural similarity while ignoring the characteristic refraction distortion that makes glass look like glass.

**Consequences:**
- Auto-tuning reports "converged" but the result looks wrong
- Parameters are in physically unreasonable ranges (e.g., refraction = 0, aberration = 8.0)
- False confidence in visual parity that breaks when the background image changes

**Prevention:**
1. **Constrain parameter ranges** based on physical plausibility before auto-tuning. For example, refractionStrength should be in [0.05, 0.3], not [0, 1]
2. Use a **multi-metric loss function**: combine SSIM (structural), CIEDE2000 (perceptual color), and edge-aware metrics. Weight them to penalize obvious visual artifacts
3. Start from **hand-tuned initial parameters** that look roughly correct, then let auto-tuning refine. Do not start from random or zero values
4. Use a gradient-free optimizer designed for multimodal landscapes -- [Nevergrad](https://facebookresearch.github.io/nevergrad/) (CMA-ES or differential evolution) handles this well
5. **Validate convergence visually**: require human approval of auto-tuned results before accepting them. Automated convergence is a starting point, not the final answer
6. Test convergence stability: run auto-tuning 3 times from different starting points and check if results agree

**Detection:**
- Parameters at the bounds of their allowed ranges (hitting constraints)
- Good metric score but poor subjective quality
- Different starting points produce wildly different "converged" results

**Confidence:** MEDIUM -- based on [Nevergrad documentation](https://facebookresearch.github.io/nevergrad/) and general optimization theory. The specific behavior with glass shader parameters is unverified.

**Phase:** Auto-Tuning Loop

---

### M3: DPI Scaling Differences Between Browser and iOS Simulator Screenshots

**What goes wrong:** Browser screenshots are captured at the display's device pixel ratio (e.g., 2x on Retina Mac) while iOS Simulator screenshots are at the simulated device's scale factor (3x for iPhone 16 Pro). Pixel-by-pixel comparison fails immediately because the images are different sizes. You resize one to match, but the resampling introduces interpolation artifacts that contaminate the diff.

**Why it happens:** Browser `canvas.toBlob()` or Puppeteer `page.screenshot()` captures at the canvas's actual pixel dimensions (controlled by `devicePixelRatio`). The iOS Simulator's `xcrun simctl io screenshot` captures at the simulator's rendered resolution. These are almost never the same.

**Prevention:**
1. **Standardize capture resolution**: define a fixed pixel dimension (e.g., 1170x2532 for iPhone 16 Pro) and ensure both captures are at exactly this size
2. For the browser: set `canvas.width` and `canvas.height` explicitly to match the reference resolution, independent of the display's DPR
3. For the simulator: verify the screenshot dimensions match expectations, and disable "Optimize Rendering for Window Scale"
4. If resizing is unavoidable, use **Lanczos resampling** (not bilinear) to minimize interpolation artifacts, and apply the same resize to both images
5. Capture a **specific sub-region** (the glass panel + surrounding background) rather than full screen to avoid toolbar/notch differences

**Detection:**
- Screenshot dimensions don't match: one is 1170x2532, the other is 800x600
- Diff shows grid-like artifacts from resampling

**Confidence:** HIGH -- this is a well-known visual regression testing problem

**Phase:** Automated Visual Diffing

---

### M4: SwiftUI .glassEffect() Performance with Multiple Offscreen Textures

**What goes wrong:** The SwiftUI reference app uses multiple `.glassEffect()` calls on separate views, causing excessive GPU memory usage and dropped frames in the simulator. This makes screenshot capture unreliable because the simulator may be mid-frame-drop when the screenshot is taken, producing a blurry or incomplete reference image.

**Why it happens:** Each `.glassEffect()` call requires 3 offscreen textures for its rendering pipeline. Multiple separate glass effects multiply this overhead. The iOS Simulator runs the GPU pipeline in software emulation on macOS, which is significantly slower than physical device Metal rendering.

**Prevention:**
1. Use `GlassEffectContainer` to group multiple glass elements into a single rendering layer, reducing offscreen texture count
2. Keep the reference app simple: one glass panel + one rounded element, not a complex multi-element layout
3. Add a short delay (1-2 seconds) after app launch before capturing screenshots to ensure rendering has stabilized
4. Capture multiple frames and verify they are identical (no frame-to-frame variance from dropped frames)

**Detection:**
- Simulator shows frame rate < 30 FPS with the reference app
- Consecutive screenshots of the same scene differ by more than 0.1% pixel difference

**Confidence:** HIGH -- verified via [JuniperPhoton's analysis](https://juniperphoton.substack.com/p/adopting-liquid-glass-experiences) of `.glassEffect()` offscreen texture behavior

**Phase:** SwiftUI Reference App

---

### M5: Blur Kernel Quality Difference -- 5x5 Gaussian vs Apple's Multi-Pass

**What goes wrong:** The current glass shader uses a 25-tap (5x5) Gaussian blur. Apple's Liquid Glass uses a much more sophisticated multi-pass blur (likely Kawase or dual blur with large kernel support). No amount of parameter tuning can make a 5x5 Gaussian match a 64-tap or multi-pass blur because the blur quality (falloff shape, frequency content) is fundamentally different, not just the radius.

**Why it happens:** The current blur is a single-pass 5x5 kernel for performance. This produces visible banding at larger blur radii because the kernel is too small to smoothly cover the area. Apple's implementation likely uses multiple passes with progressively larger kernels, which produces a smoother, more physically accurate blur.

**Consequences:**
- Auto-tuning will maximize `blurIntensity` to try to match Apple's blur radius, but the result looks blocky rather than smooth
- The visual parity gap cannot be closed through parameter tuning alone -- it requires shader architecture changes
- Visual diff shows structural differences in the blur region even at optimal parameters

**Prevention:**
1. **Acknowledge this as a known limitation** of the current architecture and plan a shader upgrade phase
2. Consider replacing the single 5x5 pass with a separable two-pass Gaussian (horizontal then vertical), which allows much larger kernels (e.g., 15-tap) at similar cost
3. Alternatively, implement Kawase blur (iterative downscale/upscale) for O(log n) quality scaling
4. Set the auto-tuning baseline expectations: document that blur quality is a known divergence and exclude the blur-heavy interior of glass regions from the diff metric initially
5. Compare blur profiles: render a sharp edge through the glass and compare the falloff curves

**Detection:**
- Diff heat map shows highest error in the blurred interior of glass regions
- Increasing blurIntensity past 0.7 produces visible banding/stepping

**Confidence:** HIGH -- based on direct inspection of the existing 5x5 kernel in `glass.wgsl.h` and knowledge of production blur techniques

**Phase:** Shader Parameter Tuning (may require separate shader upgrade phase)

---

## Minor Pitfalls

---

### N1: createImageBitmap Color Space Conversion Clobbers Raw Values

**What goes wrong:** When loading an image via `createImageBitmap(blob)` without options, the browser may apply color space conversion (sRGB to display color space and back) that subtly alters pixel values. Normal maps, height maps, or calibration patches lose precision.

**Prevention:**
- Always use `createImageBitmap(blob, { colorSpaceConversion: 'none' })` to prevent unwanted conversion
- For wallpaper images (which should be color-managed), use `colorSpaceConversion: 'default'` to let the browser handle sRGB correctly
- Test by loading a 1x1 pixel image with known RGB values and verifying the texture contents match

**Confidence:** HIGH -- verified via [WebGPU Fundamentals](https://webgpufundamentals.org/webgpu/lessons/webgpu-importing-textures.html)

**Phase:** Image Background

---

### N2: flipY Inconsistency Between Image and Noise Background

**What goes wrong:** Images loaded via `copyExternalImageToTexture` may have a different Y-axis convention than the procedurally generated noise. When switching between image and noise modes, the glass effect appears upside-down or the refraction direction reverses.

**Prevention:**
- Explicitly set `flipY: true` in `copyExternalImageToTexture` if the image appears flipped
- Verify UV convention: the current noise shader uses `output.uv = output.position.xy * 0.5 + 0.5` (origin at bottom-left in clip space, top-left in UV), while the glass shader uses `1.0 - (output.position.y * 0.5 + 0.5)` (flipped Y). The image must match whichever convention the glass shader expects
- Test with an asymmetric image (text or arrows) to verify orientation

**Confidence:** MEDIUM -- based on WebGPU documentation mentioning flipY option

**Phase:** Image Background

---

### N3: Live Tuning UI Causes Layout Thrash Affecting Glass Region Positions

**What goes wrong:** Adding a controls panel to the demo app shifts the canvas layout, causing all glass region rects to be recalculated. If the controls panel animates open/closed, every frame triggers `getBoundingClientRect()` reflows for all regions plus canvas resize, dropping below 60 FPS during the animation.

**Prevention:**
- Position the controls panel as a fixed overlay that does not affect canvas flow layout
- Use `position: fixed` or `position: absolute` for the tuning panel
- Avoid CSS transitions on the controls panel that trigger layout (use opacity/transform instead)
- The rAF position sync loop already runs every frame -- ensure it handles layout changes gracefully without additional reflow

**Confidence:** HIGH -- based on standard web performance knowledge and existing rAF sync architecture in `GlassProvider.tsx`

**Phase:** Live Tuning UI

---

### N4: WASM Binary Size Increase from Bundled Wallpaper Image

**What goes wrong:** Bundling the default wallpaper image inside the WASM SINGLE_FILE binary (currently ~674KB) adds the full image size to the download. A high-resolution wallpaper (2532x1170 at 24-bit = ~8.5MB uncompressed, ~500KB-1MB as JPEG) could nearly double the bundle size.

**Prevention:**
- Bundle the wallpaper as a separate static asset, not embedded in the WASM binary
- Use the existing Vite asset pipeline to handle the image file
- Load the wallpaper lazily on first use, not at WASM initialization time
- Compress the wallpaper aggressively (WebP, quality 80) -- target < 200KB
- Provide a preload hint in the HTML for the wallpaper to parallelize download with WASM loading

**Confidence:** HIGH -- based on existing SINGLE_FILE architecture in PROJECT.md

**Phase:** Image Background / Bundling

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Image Background | C1, C3, C4, C5 will ALL surface simultaneously on first attempt | Implement in order: C4 (JS/C++ boundary) -> C3 (usage flags) -> C5 (format) -> C1 (color space). Test each step independently before combining |
| Image Background | C2 (premultiplied alpha) is latent -- may not appear until visual comparison phase | Test with a PNG that has alpha regions early, even if the initial wallpaper is opaque |
| Shader Parameter Exposure | M1 becomes visible only under load (many regions + live tuning) | Profile with 8+ glass regions and all sliders active before declaring complete |
| Live Tuning UI | N3 is easy to introduce and hard to diagnose (looks like "general slowness") | Measure frame time with and without tuning panel visible as a gate criterion |
| SwiftUI Reference App | C6 is a showstopper with no code-level fix | Accept simulator-only reference and document the limitation prominently |
| SwiftUI Reference App | M4 can produce flaky reference screenshots | Capture 3 frames, assert all are identical before accepting as reference |
| Automated Visual Diffing | C7 must be resolved BEFORE auto-tuning or all tuned parameters will be wrong | Start with manual color calibration patch comparison before running any automated diff |
| Auto-Tuning Loop | M2 is the most likely cause of "it says converged but looks wrong" | Require human sign-off on auto-tuned results; treat convergence as a suggestion |
| Auto-Tuning Loop | M5 (blur quality gap) means perfect convergence is impossible with current shader | Document expected residual diff and exclude blur interior from loss function |

---

## Sources

- [WebGPU Fundamentals: Importing Textures](https://webgpufundamentals.org/webgpu/lessons/webgpu-importing-textures.html) -- HIGH confidence
- [WebGPU Fundamentals: Transparency and Blending](https://webgpufundamentals.org/webgpu/lessons/webgpu-transparency.html) -- HIGH confidence
- [MDN: copyExternalImageToTexture](https://developer.mozilla.org/en-US/docs/Web/API/GPUQueue/copyExternalImageToTexture) -- HIGH confidence
- [MDN: getPreferredCanvasFormat](https://developer.mozilla.org/en-US/docs/Web/API/GPU/getPreferredCanvasFormat) -- HIGH confidence
- [toji.dev: WebGPU Image Texture Best Practices](https://toji.dev/webgpu-best-practices/img-textures.html) -- HIGH confidence
- [toji.dev: Bind Group Best Practices](https://toji.dev/webgpu-best-practices/bind-groups.html) -- HIGH confidence
- [WebGPU Fundamentals: Optimization](https://webgpufundamentals.org/webgpu/lessons/webgpu-optimization.html) -- HIGH confidence
- [gpuweb issue #3357: RENDER_ATTACHMENT requirement](https://github.com/gpuweb/gpuweb/issues/3357) -- HIGH confidence
- [gpuweb issue #1715: linear color space for external images](https://github.com/gpuweb/gpuweb/issues/1715) -- HIGH confidence
- [gpuweb issue #1762: alpha premultiplication for external images](https://github.com/gpuweb/gpuweb/issues/1762) -- HIGH confidence
- [gpuweb issue #2535: rgba8unorm canvas and IOSurface](https://github.com/gpuweb/gpuweb/issues/2535) -- HIGH confidence
- [Emscripten mixed JS/WASM WebGPU issue #13888](https://github.com/emscripten-core/emscripten/issues/13888) -- MEDIUM confidence
- [Apple Developer Forums: glassEffect dark on device](https://developer.apple.com/forums/thread/814005) -- HIGH confidence
- [JuniperPhoton: Adopting Liquid Glass Pitfalls](https://juniperphoton.substack.com/p/adopting-liquid-glass-experiences) -- HIGH confidence
- [Apple: Applying Liquid Glass to Custom Views](https://developer.apple.com/documentation/SwiftUI/Applying-Liquid-Glass-to-custom-views) -- HIGH confidence
- [Nevergrad: Gradient-Free Optimization](https://facebookresearch.github.io/nevergrad/) -- MEDIUM confidence
- [SSIM Wikipedia](https://en.wikipedia.org/wiki/Structural_similarity) -- HIGH confidence
- [jest-image-snapshot (Pixelmatch/SSIM)](https://github.com/americanexpress/jest-image-snapshot) -- MEDIUM confidence

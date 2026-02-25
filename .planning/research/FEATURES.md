# Feature Landscape: v2.0 Visual Parity Milestone

**Domain:** WebGPU glass effect component library -- image backgrounds, shader tuning, visual comparison
**Researched:** 2026-02-25
**Confidence:** MEDIUM (Apple's native glass internals are not fully documented; parameter values derived from community reverse-engineering)

---

## Table Stakes

Features that are expected for this milestone. Without these, the v2.0 milestone is incomplete.

### A. Image Background Rendering

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Load image as background texture | Core milestone goal -- image backgrounds required for visual parity comparison against real wallpapers | Medium | Use `fetch` -> `createImageBitmap` -> `copyExternalImageToTexture` on JS side, pass to C++ engine's offscreen texture. Replaces noise pass when active. |
| Aspect-ratio-preserving fit modes (cover/contain/fill) | Images have arbitrary aspect ratios; without this, backgrounds look stretched or cropped wrong | Medium | Implement in the image upload/copy step. Cover = crop to fill, Contain = letterbox, Fill = stretch. Cover is default for wallpaper parity. |
| Bundled default wallpaper | Users need a working image out of the box for demos and visual comparison | Low | Ship a compressed JPEG/WebP (~100-200KB). Apple's default iOS wallpaper style: colorful gradient or nature scene. |
| Toggle between noise and image mode | Noise mode is already shipped in v1.0; must not regress | Low | Expose `backgroundMode: 'noise' | 'image'` prop on GlassProvider. Engine switches which pass runs in Pass 1. |
| sRGB-correct texture handling | Color mismatch between iOS reference and web output if gamma is wrong | Low | Ensure texture format uses sRGB view or manual gamma correction in shader. WebGPU defaults to linear; must handle. |

### B. Shader Parameter Exposure

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| All glass uniforms as React props | Milestone explicitly requires exposing every shader parameter for tuning | Low | Most already wired (blur, opacity, cornerRadius, refraction, tint, aberration, specular, rim, mode). Verify no hidden constants. |
| Expose currently-hardcoded shader constants | Glass shader has hardcoded values: blur kernel size (5x5 = 25 tap), contrast (0.85), saturation (1.4), Fresnel exponents, rim spread, aberration norm (0.008). These must be tunable for parity. | Medium | Add new uniform fields or secondary uniform buffer for "material constants." Key ones: `contrast`, `saturation`, `blurTapRadius`, `fresnelExponent`, `aberrationScale`. |
| Per-region parameter overrides | Different glass panels may need different parameters (e.g., navigation bar vs card) | Low | Already supported via per-region uniforms. Ensure all new constants are per-region too. |
| Typed prop interface with sensible defaults | Developers need to know valid ranges without reading shader code | Low | TypeScript interface with JSDoc comments, min/max/default for each parameter. |

### C. Live Tuning UI

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Real-time slider controls for all shader parameters | Primary workflow: adjust parameter, see result instantly | Low | Existing ControlPanel covers basic params. Extend with new constants (contrast, saturation, Fresnel, etc). |
| Grouped parameter sections | Users need organized controls, not a flat list of 20+ sliders | Low | Already implemented with Section component. Add sections for: Material Constants, Image Background, Comparison. |
| Parameter value display (numeric readout) | Users need to see exact values to record and replicate settings | Low | Already shown in SliderControl. Verify precision is sufficient (3 decimal places for 0-1 ranges). |
| Reset to defaults | Easy to get lost tuning 15+ parameters; need escape hatch | Low | Store default values, add Reset button per section and global Reset All. |

### D. Visual Diffing Workflow

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Screenshot capture from WebGPU canvas | Foundation of the entire comparison workflow | Medium | `canvas.toDataURL()` or `canvas.toBlob()` from the WebGPU canvas. Must handle WebGPU's preferred canvas format. Note: may need `preserveDrawingBuffer` or read-back on same frame. |
| iOS Simulator screenshot capture script | Need the reference image to diff against | Low | `xcrun simctl io booted screenshot reference.png`. Script in package.json or shell script. |
| Pixel-diff comparison | Objective measurement of visual distance from Apple's reference | Medium | Use **odiff** (6x faster than pixelmatch, SIMD-optimized, Node.js bindings). Outputs diff image + mismatch percentage. |
| Diff result display (mismatch percentage + visual overlay) | Must see what differs, not just a number | Medium | Generate diff image highlighting changed pixels. Display side-by-side: reference / current / diff overlay. |

---

## Differentiators

Features that go beyond expectations and create real value. Not required for milestone completion but significantly improve the workflow.

### E. Advanced Image Background

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Mipmap generation for background texture | Pre-filtered mipmaps eliminate shimmer/aliasing when glass samples at offset UVs, producing smoother blur that better matches Apple's quality | Medium | WebGPU requires manual mipmap generation (no auto-generate). Use render-pass downsample chain: render mip N-1 into mip N with linear filter. Set `mipLevelCount` on texture descriptor. Increases VRAM by ~33%. |
| Dual Kawase blur (downsample/upsample) instead of 5x5 Gaussian | Current 25-tap Gaussian has limited blur radius. Kawase achieves larger radii at lower cost, closer to Apple's wide frosted look | High | Requires multipass: downsample texture N times with Kawase kernel, then upsample. Needs intermediate textures. Significant shader architecture change. 1.5-3x more efficient than equivalent Gaussian for large radii (Intel research). |
| Image drag-and-drop / file picker | Quick wallpaper swapping during comparison sessions without recompiling | Low | HTML5 drag-and-drop + `<input type="file">` in demo app. Convert to ImageBitmap, upload to GPU texture. |
| Dynamic image URL loading | Load wallpapers from URL for testing against specific iOS wallpapers | Low | Fetch + createImageBitmap pipeline. CORS considerations. |

### F. Advanced Shader Tuning

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Named presets (Apple Standard, Apple Prominent, Custom) | One-click switch between known-good parameter sets. Essential for A/B comparison. | Low | JSON objects mapping preset name to full parameter set. Store in constants file. Include "Apple Standard" and "Apple Prominent" targeting the two native Glass variants. |
| Export/import parameter config as JSON | Save tuning sessions, share configs, reproduce exact settings | Low | Serialize current params to JSON. Copy to clipboard or download as file. Import parses JSON and applies. |
| Undo/redo for parameter changes | Tuning is exploratory; users need to backtrack | Medium | Ring buffer of parameter snapshots. Cmd+Z / Cmd+Shift+Z. Max 50 states. |
| A/B split-screen comparison | See two parameter sets side by side on same background | Medium | Render two glass regions with different params. Vertical divider that can be dragged. Left = config A, Right = config B. |
| Parameter interpolation / animation | Smoothly transition between presets to find intermediate sweet spots | Low | Already have morph system. Wire preset changes through morph pipeline instead of instant-set. |

### G. Advanced Visual Diffing

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Perceptual diff (SSIM scoring) | Pixel diff is noisy for anti-aliasing differences; SSIM matches human perception | Medium | SSIM scoring via odiff or separate SSIM library. Score 0.0-1.0 where 1.0 = identical. Target: SSIM > 0.95 for "visual parity." |
| Region-of-interest masking | Compare only the glass panel area, ignore background differences from different rendering pipelines | Medium | User draws rectangle on reference image. Diff only within masked region. Essential because noise/image rendering will never pixel-match iOS background exactly. |
| Tolerance threshold configuration | Different teams may accept different precision levels | Low | Configurable threshold for pixel diff (e.g., 0.1 = 10% channel difference tolerance). Per-channel or aggregate. |
| Automated convergence loop | The milestone's ultimate goal: auto-iterate parameters toward parity | High | Script that: captures web screenshot, captures iOS screenshot, runs diff, adjusts parameters based on diff regions, repeats. Requires parameter gradient estimation or grid search. |
| CI integration for visual regression | Prevent regressions once parity is achieved | Medium | GitHub Actions workflow: build WASM, render screenshot, diff against committed baseline, fail if regression exceeds threshold. |

### H. SwiftUI Reference App

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Both `.regular` and `.clear` Glass variants | Apple exposes two material variants with different transparency levels; need reference screenshots of both | Low | Two views in the app, one with each variant. |
| Configurable shapes (RoundedRectangle, Capsule, Circle) | Match the shapes used in the React components for fair comparison | Low | Shape picker in reference app UI. |
| `.tint(Color)` with multiple test colors | Verify tint behavior matches between implementations | Low | Color picker or preset tint colors in reference app. |
| Dark mode and light mode screenshots | Apple's glass adapts appearance per mode; must compare both | Low | Override `colorScheme` in SwiftUI, capture both variants. |
| Same wallpaper image as web demo | Apples-to-apples comparison requires identical background | Low | Bundle same image in both Xcode project and web demo. Critical for valid diffing. |
| `.interactive()` mode demonstration | Shows the enhanced specular/gesture response that Apple applies | Low | Toggle interactive mode on reference panels. |

---

## Anti-Features

Features to explicitly NOT build for this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| AI-powered parameter auto-tuning | Massively complex (gradient estimation in shader parameter space, reward function design). Manual tuning with good presets reaches parity faster. | Build good presets + export/import. Grid search script for automated convergence if needed. |
| Real-time video backgrounds | Scope explosion: video decode pipeline, frame-rate synchronization, memory management. Not needed for Apple parity comparison. | Stick with static image backgrounds. Video is a v3 feature. |
| Content-blur mode (glass over DOM content) | Requires capturing DOM to texture (html2canvas or similar), huge performance hit, different architecture. Not what Apple's glass does -- Apple's glass refracts the wallpaper, not app content. | Focus on wallpaper/image refraction which matches Apple's actual behavior. |
| Multi-platform reference apps (Android, macOS) | Spreads effort thin. iOS is the reference platform for Liquid Glass. | iPhone 16 Pro Simulator only for v2.0. |
| Nested glass-over-glass compositing | Apple's glass panels do not typically stack. Existing single-layer architecture is correct for parity. | Support multiple independent glass regions (already built). Defer nested compositing. |
| WebGL fallback for the diffing pipeline | The glass rendering must be WebGPU. Diffing tools (odiff) work on screenshots, not GPU APIs. No fallback needed. | Use Node.js image comparison tools operating on PNG screenshots. |
| GlassEffectContainer morphing between panels | Apple's container morphing is a transition/animation feature, not a material/visual feature. Out of scope for visual parity of static glass appearance. | Existing morph transitions cover parameter interpolation. Defer container morphing to v3. |
| Gyroscope/device tilt interaction | Still deferred from v1.0. Get static parity first. | Focus on static visual quality. Tilt is v3. |

---

## Feature Dependencies

```
Image Background Rendering
  |
  +-> Same Wallpaper in SwiftUI App (requires bundled image)
  |
  +-> Screenshot Capture (requires rendered image to capture)
        |
        +-> Pixel Diff Comparison (requires two screenshots)
        |     |
        |     +-> Diff Display UI (requires diff result)
        |     |
        |     +-> Region Masking (requires diff pipeline)
        |     |
        |     +-> CI Visual Regression (requires diffing working)
        |
        +-> Automated Convergence Loop (requires diff + parameter export)

Shader Parameter Exposure
  |
  +-> All Constants as Props (requires uniform buffer changes)
  |     |
  |     +-> Live Tuning UI (requires props to bind to)
  |           |
  |           +-> Named Presets (requires all params exposed)
  |           |
  |           +-> Export/Import JSON (requires param serialization)
  |           |
  |           +-> A/B Comparison (requires two param sets + rendering)
  |           |
  |           +-> Undo/Redo (requires param state history)
  |
  +-> SwiftUI Reference App (independent, can build in parallel)

Mipmap Generation --> Improved Blur Quality
Dual Kawase Blur --> Improved Blur Quality (optional, high complexity)
```

---

## MVP Recommendation for v2.0

### Phase 1: Foundation (build first)

1. **Image background rendering** with cover mode and bundled wallpaper -- this unlocks everything else
2. **Expose hardcoded shader constants** as uniforms -- enables meaningful tuning
3. **SwiftUI reference app** with `.regular` + `.clear` + same wallpaper -- build in parallel, no dependencies

### Phase 2: Tuning (build second)

4. **Extended live tuning UI** with all new parameters, grouped sections, reset
5. **Named presets** (Apple Standard, Apple Prominent) -- quick starting points
6. **Export/import JSON** -- save and share tuning progress

### Phase 3: Comparison (build third)

7. **Screenshot capture** from WebGPU canvas and iOS Simulator
8. **Pixel-diff comparison** with odiff, diff display UI
9. **Dark/light mode** reference screenshots from both platforms

### Phase 4: Polish (build last)

10. **Mipmap generation** for smoother blur sampling
11. **Region masking** for focused comparison
12. **SSIM perceptual scoring** for better quality metrics
13. **A/B split-screen** in tuning UI

### Defer to v2.1 or v3

- Dual Kawase blur (high complexity, current 25-tap may suffice with mipmaps)
- Automated convergence loop (needs well-tuned manual parameters first as training data)
- CI visual regression (build once manual parity is achieved)
- Undo/redo (nice-to-have, not blocking)

---

## Key Parameter Reference: What Apple's Glass Looks Like

Based on community reverse-engineering of Apple's Liquid Glass (MEDIUM confidence -- not official Apple documentation):

### Apple `.regular` Glass Material (estimated)
| Parameter | Estimated Value | Our Current Default | Gap |
|-----------|----------------|--------------------|----|
| Blur radius | ~20-30px effective (wide frosted look) | `blurIntensity * 30 = 15px` at 0.5 | Need larger blur range or multipass |
| Refraction strength | ~0.05-0.10 (subtle edge magnification) | 0.15 | Current is too strong |
| Tint opacity | ~0.15-0.25 (barely tinted) | 0.05 | Close, may need increase |
| Chromatic aberration | ~1-2px (subtle, edge-only) | 3.0 (pixels) | Current is too strong |
| Specular: cool (top-left) | ~0.15-0.25 (blue-white, broad) | 0.2 | Close |
| Specular: warm (bottom-right) | ~0.08-0.12 (warm gold, subtle) | 0.1 (half of specular) | Close |
| Rim intensity | ~0.05-0.10 (thin edge glow) | 0.15 | Current is too strong |
| Contrast | ~0.85 (reduced) | 0.85 (hardcoded) | Match -- expose as tunable |
| Saturation | ~1.3-1.5 (boosted) | 1.4 (hardcoded) | Close -- expose as tunable |
| Corner radius | 12-48px depending on element | 24px | Range is correct |

### Apple `.prominent` Glass Material (estimated)
| Parameter | Estimated Value | Notes |
|-----------|----------------|-------|
| Blur radius | ~35-50px (heavier frosting) | Wider than regular |
| Refraction strength | ~0.10-0.18 (more lens effect) | mode=1 applies 1.8x multiplier |
| Specular | ~0.30-0.40 (brighter highlights) | mode=1 applies 1.5x multiplier |
| Aberration | ~2-4px (more prismatic) | mode=1 applies 1.5x multiplier |
| Rim spread | ~6px (wider glow) | mode=1 doubles rim spread |

### Parameters Our Shader Is Missing

| Missing Parameter | What It Does | Priority |
|-------------------|-------------|----------|
| Environment reflection strength | Apple's glass reflects a faint environment map (not just refraction) | HIGH -- key to realism |
| Fresnel IOR / exponent | Controls how edge reflections fall off. Apple uses viewing-angle-dependent brightness. | HIGH -- makes edges look physical |
| Glare direction angle | Apple's specular streak direction responds to device orientation. Static version needs configurable angle. | MEDIUM |
| Surface noise/texture | Subtle surface imperfection that breaks up reflections. Apple's glass has micro-texture. | LOW -- polish item |
| Tint color adaptation | Apple's tint shifts hue/saturation based on background content brightness | MEDIUM -- requires background luminance sampling |

---

## Sources

### Apple Official
- [Applying Liquid Glass to custom views (Apple Developer Docs)](https://developer.apple.com/documentation/SwiftUI/Applying-Liquid-Glass-to-custom-views) -- MEDIUM confidence (JS-blocked, details from cached references)
- [glassEffect(_:in:) modifier (Apple Developer Docs)](https://developer.apple.com/documentation/swiftui/view/glasseffect(_:in:)) -- MEDIUM confidence
- [Build a SwiftUI app with the new design (WWDC25)](https://developer.apple.com/videos/play/wwdc2025/323/) -- HIGH confidence (official video)

### Community Implementations (parameter reference)
- [liquid-glass-js (dashersw)](https://github.com/dashersw/liquid-glass-js) -- edgeIntensity 0.02, rimIntensity 0.08, blurRadius 7.0, tintOpacity 0.3
- [liquid-glass-react (rdev)](https://github.com/rdev/liquid-glass-react) -- displacementScale 70, blurAmount 0.0625, saturation 140, aberration 2
- [LiquidGlassKit (DnV1eX)](https://github.com/DnV1eX/LiquidGlassKit) -- refractive index, chromatic dispersion, Fresnel reflection, glare highlights
- [liquid-glass-studio (iyinchao)](https://github.com/iyinchao/liquid-glass-studio) -- WebGL2 multipass, SDF shapes, refraction, dispersion, Fresnel, glare
- [LiquidGlassReference (conorluddy)](https://github.com/conorluddy/LiquidGlassReference) -- comprehensive iOS 26 API reference

### Technical References
- [Building Apple's Liquid Glass Effect for Web](https://mycatwrotethis.blog/blog/liquid-glass-effect) -- Fresnel, chromatic aberration, displacement map values
- [WebGPU Loading Images into Textures](https://webgpufundamentals.org/webgpu/lessons/webgpu-importing-textures.html) -- fetch/createImageBitmap/copyExternalImageToTexture
- [WebGPU img/canvas/video Textures Best Practices (toji.dev)](https://toji.dev/webgpu-best-practices/img-textures.html)
- [Mipmap Generation (Learn WebGPU)](https://eliemichel.github.io/LearnWebGPU/basic-compute/image-processing/mipmap-generation.html) -- render-pass downsample approach
- [Fast Real-Time GPU Blur Algorithms (Intel)](https://www.intel.com/content/www/us/en/developer/articles/technical/an-investigation-of-fast-real-time-gpu-based-image-blur-algorithms.html) -- Kawase vs Gaussian performance
- [Dual Kawase Blur Deep Dive](https://blog.frost.kiwi/dual-kawase/) -- downsample/upsample technique

### Diffing Tools
- [odiff (dmtrKovalenko)](https://github.com/dmtrKovalenko/odiff) -- SIMD-optimized image diff, 6x faster than pixelmatch, Node.js API
- [pixelmatch (mapbox)](https://github.com/mapbox/pixelmatch) -- anti-aliased pixel comparison, used by Playwright
- [xcrun simctl screenshot docs](https://gist.github.com/jfversluis/2026f2683974bf0efb898a3cc50b28d1) -- iOS Simulator CLI

### Tuning UI
- [Tweakpane](https://tweakpane.github.io/docs/) -- compact parameter GUI, TypeScript, presets

# Technology Stack: v2.0 Visual Parity Milestone

**Project:** LiquidGlass-React-WASM
**Researched:** 2026-02-25
**Scope:** Stack ADDITIONS for v2.0 only. Existing validated stack (Emscripten, emdawnwebgpu, React 19, Vite 6, C++20) is unchanged.

---

## 1. Image Texture Loading (C++ / WASM)

### Recommended: stb_image (header-only) decoded in C++, uploaded via `queue.WriteTexture()`

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| stb_image.h | v2.30 | Decode PNG/JPG/BMP to raw RGBA pixels | Single-header, public domain, zero dependencies, proven in WebGPU C++ projects. Forces 4-channel output for consistent RGBA8Unorm textures. |

**Confidence:** HIGH -- stb_image is the de facto standard for C++ image loading in WebGPU projects. The LearnWebGPU documentation uses it as the canonical example, and it compiles cleanly under Emscripten.

### Integration Architecture

The image loading flow has two viable approaches. Use **Approach A** (JS decode, pass to C++).

**Approach A -- JS-side decode, C++ upload (RECOMMENDED):**
1. JavaScript `fetch()` loads the image file (or bundled asset)
2. JS decodes to `ImageBitmap` via `createImageBitmap(blob)`
3. JS calls `device.queue.copyExternalImageToTexture()` to write directly to the offscreen texture
4. No stb_image needed at all -- browser handles decode natively

**Why Approach A over stb_image in C++:** The browser's native image decoder is hardware-accelerated, handles all formats, and `copyExternalImageToTexture()` avoids a copy through WASM linear memory. stb_image in C++ would require: fetching via Emscripten's Fetch API or `--preload-file`, decoding in WASM (slower than browser), then `queue.WriteTexture()` through the WASM heap. More code, worse performance.

**Approach B -- stb_image in C++ (FALLBACK ONLY):**
Use only if `copyExternalImageToTexture()` is unavailable or if image preprocessing (resize, crop) needs to happen in C++ before GPU upload. Steps:
1. Bundle image via Emscripten `--preload-file` or fetch via Emscripten Fetch API
2. `stbi_load(path, &w, &h, &channels, 4)` -- force RGBA
3. `device.GetQueue().WriteTexture(...)` with `wgpu::TextureDataLayout` specifying `bytesPerRow = width * 4`
4. `stbi_image_free(data)`

**Decision:** Use Approach A. The existing architecture already has JS-to-C++ communication via embind. Add a new JS function that loads an image and writes it to the engine's offscreen texture. The C++ engine needs a new `setBackgroundMode(mode)` method and the offscreen texture needs `wgpu::TextureUsage::CopyDst` added to its usage flags.

### What Changes in Existing Code

| File | Change |
|------|--------|
| `engine/src/background_engine.h` | Add `BackgroundMode` enum (Noise/Image), add `CopyDst` to offscreen texture usage |
| `engine/src/background_engine.cpp` | Skip noise render pass when mode == Image; expose texture handle for JS upload |
| `engine/src/main.cpp` | Add embind binding for `setBackgroundMode()` |
| `src/wasm/loader.ts` | Add `loadBackgroundImage(url: string)` that fetches, decodes, and uploads via `copyExternalImageToTexture` |
| `src/components/GlassProvider.tsx` | Accept `backgroundImage?: string` prop, call loader |

### Bundled Default Wallpaper

Ship a default wallpaper image in the npm package. Use a high-quality JPEG (not PNG -- JPEG is 5-10x smaller for photographic content) at 2560x1440 resolution, targeting ~200-400KB. Place in `src/assets/default-wallpaper.jpg` and import via Vite's `?url` suffix for tree-shaking.

---

## 2. Live Shader Parameter Controls UI

### Recommended: Leva v0.10.x

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| leva | ^0.10.1 | React GUI for real-time shader parameter tuning | React-first (useControls hook), auto-generates UI from schema, supports numbers/colors/booleans/vectors, built by pmndrs ecosystem (same community as react-three-fiber). |

**Confidence:** HIGH -- leva is the standard React parameter control library, actively maintained, and designed for exactly this use case (shader/3D parameter tuning).

### Why Leva Over Alternatives

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Parameter UI | **leva** | Tweakpane 4.x | Tweakpane is framework-agnostic (vanilla JS). Requires `react-tweakpane` wrapper (MelonCode/react-tweakpane) which is a community binding with less maintenance. Leva is React-native. |
| Parameter UI | **leva** | dat.gui | dat.gui is unmaintained. Its successor lil-gui is also vanilla JS. Neither has React integration. |
| Parameter UI | **leva** | Theatre.js | Theatre.js is an animation/keyframing tool -- overkill for parameter tuning. Heavier, more complex API. |

### React 19 Compatibility

Leva 0.10.x works with React 19 but its `@radix-ui/*` dependencies still list React 18 as a peer dependency, causing npm install warnings. This is cosmetic -- the library functions correctly. Use `--legacy-peer-deps` during install or add an `overrides` field in package.json. The pmndrs team has acknowledged this (GitHub issue #539) and @radix-ui upgrades are included in 0.10.1.

**Confidence:** MEDIUM -- functional but with peer dependency noise. Verify at install time.

### Usage Pattern

```tsx
import { useControls } from 'leva';

function GlassTuner() {
  const params = useControls('Glass Shader', {
    blur: { value: 0.5, min: 0, max: 1, step: 0.01 },
    refraction: { value: 0.15, min: 0, max: 0.5, step: 0.01 },
    aberration: { value: 3.0, min: 0, max: 10, step: 0.1 },
    tint: { value: '#ffffff' },  // leva auto-detects color
    specular: { value: 0.2, min: 0, max: 1, step: 0.01 },
    rim: { value: 0.15, min: 0, max: 1, step: 0.01 },
    opacity: { value: 0.05, min: 0, max: 1, step: 0.01 },
    cornerRadius: { value: 24, min: 0, max: 100, step: 1 },
    mode: { options: ['standard', 'prominent'] },
  });
  // params updates on every slider change, feed to GlassPanel props
}
```

### Scope

Leva is a **dev-dependency only** -- it powers the demo app's tuning panel, NOT the shipped library. The `liquidglass-react` npm package should never depend on leva.

---

## 3. SwiftUI Reference App

### Recommended: Xcode 26.2 + SwiftUI, targeting iOS 26 / iPhone 16 Pro Simulator

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Xcode | 26.2 | Build/run SwiftUI reference app | Required for iOS 26 SDK and Liquid Glass APIs. Requires macOS Sequoia 15.6+. |
| SwiftUI | iOS 26 | Native Liquid Glass rendering | `.glassEffect()` modifier is the ONLY way to get Apple's native Liquid Glass look. |
| Swift | 6.x | Language for reference app | Ships with Xcode 26. |

**Confidence:** HIGH -- Apple's developer documentation and WWDC25 sessions confirm the APIs.

### Key SwiftUI APIs

| API | Purpose | Notes |
|-----|---------|-------|
| `.glassEffect(_ glass: Glass = .regular, in shape: S, isEnabled: Bool)` | Apply Liquid Glass to any view | Primary modifier. Shape defaults to capsule. |
| `Glass.regular` | Standard glass material | Balanced transparency, good for most UI |
| `Glass.clear` | More transparent variant | Higher transparency, used over vivid content |
| `Glass.identity` | Disable effect | For conditional toggling |
| `.tint(Color)` | Colorize the glass | Chain on Glass instance |
| `.interactive()` | Enable press animations | Bouncing, shimmering, touch illumination |
| `GlassEffectContainer` | Group glass elements | Shared sampling, morphing between elements |
| `.glassEffectID()` | Morphing transitions | Requires Namespace for matched geometry |

### Reference App Structure

The reference app should be a **separate directory** (not inside glass-react repo, per PROJECT.md constraints). Minimal structure:

```
liquid-glass-reference-ios/
  LiquidGlassRef/
    LiquidGlassRefApp.swift
    ContentView.swift        // Same wallpaper + glass panel + rounded element
    Assets.xcassets/         // Same default wallpaper image
  LiquidGlassRef.xcodeproj
```

**ContentView.swift requirements:**
- Full-screen `Image` background using the SAME wallpaper JPEG as the web app
- `RoundedRectangle` with `.glassEffect(.regular, in: RoundedRectangle(cornerRadius: 24))`
- Same dimensions and positioning as the web demo app's GlassPanel
- Target: iPhone 16 Pro Simulator (1206x2622 logical, 3x scale)

### Simulator Screenshot Capture

```bash
# Boot specific simulator
xcrun simctl boot "iPhone 16 Pro"

# Take screenshot
xcrun simctl io booted screenshot --type=png reference.png

# Or with specific device UDID (more reliable in CI)
xcrun simctl io <UDID> screenshot --type=png reference.png
```

**Confidence:** HIGH -- `xcrun simctl io screenshot` is a stable, well-documented Apple CLI since Xcode 8.2.

---

## 4. Automated Visual Diffing

### Recommended: Playwright (already in project) + pixelmatch + pngjs

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| playwright | ^1.58.2 | Browser automation, screenshot capture of web app | Already a devDependency. Chromium's WebGPU support is best-in-class. |
| pixelmatch | ^7.1.0 | Pixel-level image comparison | 150 lines, zero dependencies, works on raw typed arrays. Fast: <50ms for 1280x720. Deterministic. |
| pngjs | ^7.0.0 | PNG encode/decode in Node.js | Needed to read PNG files into raw RGBA buffers for pixelmatch. Provides `PNG.sync.read()` and `PNG.sync.write()`. |

**Confidence:** HIGH for Playwright (already validated in project). MEDIUM for pixelmatch+pngjs (standard pattern, widely documented, but not yet tested in this project).

### Why NOT Playwright's Built-in `toHaveScreenshot()`

Playwright's `toHaveScreenshot()` compares against baselines stored per-platform/browser. Our use case is different: we compare **web app screenshots against iOS Simulator screenshots** (cross-platform comparison). This requires:
1. Manual screenshot capture from both sources
2. Resizing to match dimensions
3. Custom pixelmatch invocation with tunable threshold

Playwright's built-in visual comparison assumes same-source screenshots. Use it for regression testing (same browser, different code versions), but use pixelmatch directly for cross-platform visual diffing.

### Comparison Pipeline

```
Playwright screenshot (web app)     xcrun simctl screenshot (iOS Sim)
        |                                      |
        v                                      v
    web-capture.png                    ios-reference.png
        |                                      |
        +------ resize to match ---------------+
        |                                      |
        v                                      v
   pixelmatch(webData, iosData, diffData, w, h, { threshold: 0.1 })
        |
        v
    diff.png + mismatch percentage
```

### Key Playwright Configuration for WebGPU Screenshots

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    browserName: 'chromium',
    launchOptions: {
      args: ['--enable-unsafe-webgpu'],  // Enable WebGPU in headless mode
    },
  },
});
```

**Critical:** WebGPU canvas content is NOT captured by default in Playwright screenshots. The canvas must have `preserveDrawingBuffer: true` equivalent, or you must use `page.locator('canvas').screenshot()` immediately after a render frame. Test this early -- it is a known pain point.

**Confidence:** MEDIUM -- WebGPU screenshot capture in headless Playwright has known edge cases. Flag for validation during implementation.

---

## 5. Supporting Libraries

### New Dependencies

| Library | Version | Purpose | Dependency Type | When to Use |
|---------|---------|---------|-----------------|-------------|
| leva | ^0.10.1 | Shader parameter tuning UI | devDependency | Demo app only, not shipped in npm package |
| pixelmatch | ^7.1.0 | Image pixel comparison | devDependency | Visual diff scripts |
| pngjs | ^7.0.0 | PNG read/write for Node.js | devDependency | Visual diff scripts (pairs with pixelmatch) |

### Libraries NOT to Add

| Library | Why Not |
|---------|---------|
| stb_image.h (in C++) | Browser's native `createImageBitmap` + `copyExternalImageToTexture` is faster and simpler. Only add if C++-side image preprocessing becomes necessary. |
| sharp | Server-side image processing library. Overkill for resizing screenshots; use canvas API or simple resize in the diff script. |
| resemble.js | Older image comparison library. pixelmatch is smaller, faster, zero-dependency. resemble.js adds Canvas dependency. |
| dat.gui / lil-gui | Unmaintained (dat.gui) or vanilla JS requiring wrappers (lil-gui). Leva is purpose-built for React. |
| Tweakpane | Good library but requires react-tweakpane wrapper (community-maintained). Leva is React-native. |
| Puppeteer | Playwright already in project, supports same capabilities. Adding Puppeteer duplicates browser automation. |
| Percy / Chromatic | Visual testing SaaS platforms. Overkill -- we need raw pixel diffs, not a hosted service. |

---

## 6. Alternatives Considered (Decision Log)

| Decision | Chosen | Alternative | Rationale |
|----------|--------|-------------|-----------|
| Image decode location | JS (browser) | C++ (stb_image) | Browser decode is hardware-accelerated, avoids WASM memory copy, `copyExternalImageToTexture` is purpose-built for this. |
| Texture upload API | `copyExternalImageToTexture` | `queue.writeTexture` from WASM | copyExternal works directly from ImageBitmap, no RGBA buffer round-trip through WASM heap. |
| Parameter UI | leva | Tweakpane 4 | React-native hooks vs. vanilla JS + wrapper. Same team as react-three-fiber ecosystem. |
| Visual diff tool | pixelmatch (direct) | Playwright toHaveScreenshot | Cross-platform comparison (web vs iOS) requires manual control over image sources and thresholds. |
| iOS reference | SwiftUI native | React Native / Capacitor | Native SwiftUI is the ONLY way to get real `.glassEffect()` output. Any cross-platform layer would approximate, not replicate. |
| Screenshot capture (web) | Playwright | Puppeteer | Playwright already a project dependency. Better cross-browser support. |
| Screenshot capture (iOS) | xcrun simctl | Xcode UI test | simctl is simpler, scriptable, no Xcode UI test boilerplate needed. |

---

## 7. Installation

```bash
# New dev dependencies for demo app and visual diffing
npm install -D leva pixelmatch pngjs

# If React 19 peer dep warnings from leva's radix-ui:
npm install -D leva --legacy-peer-deps

# Type definitions (if needed)
npm install -D @types/pngjs
```

No changes to production dependencies. No changes to C++ build (stb_image not needed for Approach A).

If Approach B (stb_image fallback) is ever needed:
```bash
# Download stb_image.h to engine/vendor/
curl -o engine/vendor/stb_image.h https://raw.githubusercontent.com/nothings/stb/master/stb_image.h
```

---

## 8. Version Compatibility Matrix

| Component | Current (v1.0) | v2.0 Addition | Compatibility Notes |
|-----------|----------------|---------------|---------------------|
| React | ^19.0.0 | leva ^0.10.1 | Works but shows peer dep warnings (radix-ui). Functional. |
| Playwright | ^1.58.2 | (already present) | WebGPU capture needs `--enable-unsafe-webgpu` flag. |
| Emscripten | 4.0.16 | No change | `copyExternalImageToTexture` available via emdawnwebgpu. |
| Node | 24.10.0 | pixelmatch ^7.1.0 | ESM-only (pixelmatch 7.x). Node 24 supports ESM natively. |
| Xcode | N/A (new) | 26.2 | Requires macOS Sequoia 15.6+. Ships iOS 26 Simulator. |

---

## Sources

### Image Loading
- [LearnWebGPU: Loading from file (stb_image + WebGPU)](https://eliemichel.github.io/LearnWebGPU/basic-3d-rendering/texturing/loading-from-file.html) -- HIGH confidence
- [MDN: GPUQueue.writeTexture()](https://developer.mozilla.org/en-US/docs/Web/API/GPUQueue/writeTexture) -- HIGH confidence
- [MDN: GPUQueue.copyExternalImageToTexture()](https://developer.mozilla.org/en-US/docs/Web/API/GPUQueue/copyExternalImageToTexture) -- HIGH confidence
- [WebGPU Fundamentals: Loading Images into Textures](https://webgpufundamentals.org/webgpu/lessons/webgpu-importing-textures.html) -- HIGH confidence
- [stb_image.h (GitHub)](https://github.com/nothings/stb/blob/master/stb_image.h) -- v2.30, HIGH confidence
- [Emscripten Embind docs: passing binary data](https://emscripten.org/docs/porting/connecting_cpp_and_javascript/embind.html) -- HIGH confidence

### Parameter Controls
- [leva GitHub (pmndrs)](https://github.com/pmndrs/leva) -- v0.10.1, HIGH confidence
- [leva React 19 peer dep issue #539](https://github.com/pmndrs/leva/issues/539) -- MEDIUM confidence (issue may be resolved in newer patch)
- [Tweakpane docs](https://tweakpane.github.io/docs/) -- v4.0.5, HIGH confidence (evaluated but not recommended)

### SwiftUI Liquid Glass
- [Apple: glassEffect(_:in:) documentation](https://developer.apple.com/documentation/swiftui/view/glasseffect(_:in:)) -- HIGH confidence
- [Apple: Applying Liquid Glass to custom views](https://developer.apple.com/documentation/SwiftUI/Applying-Liquid-Glass-to-custom-views) -- HIGH confidence
- [Apple: GlassEffectContainer](https://developer.apple.com/documentation/swiftui/glasseffectcontainer) -- HIGH confidence
- [LiquidGlassReference (community)](https://github.com/conorluddy/LiquidGlassReference) -- MEDIUM confidence (community aggregation of Apple docs)
- [Xcode 26.2 Release Notes](https://developer.apple.com/documentation/xcode-release-notes/xcode-26_2-release-notes) -- HIGH confidence
- [WWDC25 Session 323: Build a SwiftUI app with the new design](https://developer.apple.com/videos/play/wwdc2025/323/) -- HIGH confidence

### Visual Diffing
- [Playwright: Visual comparisons](https://playwright.dev/docs/test-snapshots) -- HIGH confidence
- [Playwright: SnapshotAssertions API](https://playwright.dev/docs/api/class-snapshotassertions) -- HIGH confidence
- [pixelmatch GitHub (mapbox)](https://github.com/mapbox/pixelmatch) -- v7.1.0, HIGH confidence
- [pngjs GitHub](https://github.com/pngjs/pngjs) -- v7.0.0, HIGH confidence
- [xcrun simctl screenshot usage](https://medium.com/xcblog/simctl-control-ios-simulators-from-command-line-78b9006a20dc) -- HIGH confidence

### iOS Simulator
- [Apple: simctl documentation](https://developer.apple.com/library/archive/documentation/IDEs/Conceptual/iOS_Simulator_Guide/InteractingwiththeiOSSimulator/InteractingwiththeiOSSimulator.html) -- HIGH confidence

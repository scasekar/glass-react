# Requirements: LiquidGlass-React-WASM v2.0

**Defined:** 2026-02-25
**Core Value:** Glass components that look and feel like Apple's Liquid Glass -- visually convincing refraction at 60FPS, now with pixel-level parity against native iOS rendering.

## v2.0 Requirements

### Image Background

- [x] **IMG-01**: User can render a loaded image as the background texture through glass components
- [x] **IMG-02**: User can toggle between noise and image background modes via `backgroundMode` prop
- [x] **IMG-03**: Library ships a bundled default wallpaper image (~200KB) as a Vite asset
- [x] **IMG-04**: Image textures use sRGB-correct pipeline (rgba8unorm-srgb format, linear shader math)

### Shader Parameters

- [x] **SHDR-01**: User can control contrast, saturation, and blurRadius via React props on glass components
- [x] **SHDR-02**: All existing glass shader uniforms are exposed as documented, typed React props with sensible defaults
- [x] **SHDR-03**: Glass shader supports Fresnel IOR and exponent parameters for edge reflection
- [x] **SHDR-04**: Glass shader supports environment reflection strength parameter
- [x] **SHDR-05**: Glass shader supports glare direction angle parameter

### Live Tuning UI

- [ ] **TUNE-01**: Demo app shows real-time slider controls for all shader parameters, grouped by section
- [ ] **TUNE-02**: User can reset parameters to defaults per section and globally
- [ ] **TUNE-03**: Demo app offers named presets (Apple Standard, Apple Prominent) for one-click parameter loading
- [ ] **TUNE-04**: User can export current parameters as JSON and import a JSON config

### SwiftUI Reference

- [ ] **REF-01**: Separate Xcode project renders `.regular` and `.clear` glass variants over the same wallpaper image
- [ ] **REF-02**: Reference app includes a glass panel and a rounded element (search bar / pill button)
- [ ] **REF-03**: Reference app supports light and dark mode variants
- [ ] **REF-04**: Screenshots can be captured via `xcrun simctl io` script targeting iPhone 16 Pro Simulator

### Visual Diffing

- [ ] **DIFF-01**: Playwright script captures WebGPU canvas screenshot at standardized pixel dimensions
- [ ] **DIFF-02**: Diff script normalizes both web and iOS screenshots to sRGB color space before comparison
- [ ] **DIFF-03**: pixelmatch comparison produces diff image output with mismatch percentage
- [ ] **DIFF-04**: Diff pipeline supports region-of-interest masking to compare only the glass area

### Automated Tuning

- [ ] **AUTO-01**: Tuning script drives Playwright with URL-based parameter injection (no rebuild needed)
- [ ] **AUTO-02**: Script performs coordinate descent, adjusting one parameter at a time to minimize diff score
- [ ] **AUTO-03**: Script logs convergence per iteration and outputs best-found parameter set as JSON

## Future Requirements

### Visual Quality

- **VQ-01**: Dual Kawase blur for wider, higher-quality blur radius
- **VQ-02**: Mipmap generation on background texture for blur shimmer reduction
- **VQ-03**: SSIM perceptual scoring alongside pixel diff

### Tuning UI Enhancements

- **TUI-01**: A/B split-screen parameter comparison
- **TUI-02**: Undo/redo for parameter changes
- **TUI-03**: Image drag-and-drop / file picker for wallpaper swapping

### CI Integration

- **CI-01**: Visual regression tests in CI pipeline using committed preset values

## Out of Scope

| Feature | Reason |
|---------|--------|
| Gyroscope/device tilt interaction | Deferred -- get visual parity on static glass first |
| Content-blur mode (frosted glass over page content) | Requires additional compositor; procedural/image backgrounds only |
| Physical device reference screenshots | iOS 26 `.glassEffect()` renders dark on device (confirmed bug) -- simulator only |
| WebGL fallback | WebGPU-only is the value proposition |
| Server-side rendering | WebGPU is client-only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| IMG-01 | Phase 9 | Complete |
| IMG-02 | Phase 9 | Complete |
| IMG-03 | Phase 9 | Complete |
| IMG-04 | Phase 9 | Complete |
| SHDR-01 | Phase 10 | Complete |
| SHDR-02 | Phase 10 | Complete |
| SHDR-03 | Phase 10 | Complete |
| SHDR-04 | Phase 10 | Complete |
| SHDR-05 | Phase 10 | Complete |
| TUNE-01 | Phase 12 | Pending |
| TUNE-02 | Phase 12 | Pending |
| TUNE-03 | Phase 12 | Pending |
| TUNE-04 | Phase 12 | Pending |
| REF-01 | Phase 11 | Pending |
| REF-02 | Phase 11 | Pending |
| REF-03 | Phase 11 | Pending |
| REF-04 | Phase 11 | Pending |
| DIFF-01 | Phase 13 | Pending |
| DIFF-02 | Phase 13 | Pending |
| DIFF-03 | Phase 13 | Pending |
| DIFF-04 | Phase 13 | Pending |
| AUTO-01 | Phase 14 | Pending |
| AUTO-02 | Phase 14 | Pending |
| AUTO-03 | Phase 14 | Pending |

**Coverage:**
- v2.0 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-25 after roadmap creation*

# Phase 11: SwiftUI Reference App - Research

**Researched:** 2026-02-25
**Domain:** SwiftUI / iOS Simulator / Automated Screenshot Capture
**Confidence:** HIGH

## Summary

Phase 11 builds a standalone SwiftUI app targeting iOS 26+ that renders Apple's native Liquid Glass effect (`.regular` and `.clear` variants) over the same wallpaper used in the web demo. The app serves as the visual ground truth for pixel-level comparison in later phases. The SwiftUI `.glassEffect()` modifier is a stable, well-documented API introduced at WWDC 2025, with straightforward usage patterns. The app must display canonical Apple UI elements (nav bar, search bar, large panel, pill button), support toggling between light/dark mode and `.regular`/`.clear` variants, and produce repeatable PNG screenshots via an `xcrun simctl io` bash script.

The primary technical challenges are: (1) matching the iOS Simulator viewport to the web demo's pixel dimensions for clean comparison, (2) ensuring screenshot byte-level reproducibility (PNG metadata like timestamps can cause false negatives), and (3) handling the known `.glassEffect()` dark-on-device bug by using the Simulator exclusively.

**Primary recommendation:** Build a single-view SwiftUI app with `ZStack` (wallpaper background + glass-overlaid UI), two in-app toggles (variant + color scheme), and a bash capture script that strips PNG metadata before comparison using macOS built-in `sips` or `exiftool`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use canonical Apple layout with all four element types: navigation bar, search bar, large glass panel (card/sheet), and floating pill button
- This establishes the visual standard -- the web demo will be adjusted to match this layout, not the other way around
- Constrain the iOS layout to match the exact pixel dimensions of the web demo canvas (matched viewport) to eliminate scaling during comparison
- Arrange elements for cleanest automated comparison -- Claude determines optimal layout (single screen vs tabbed) based on what produces the best diff results
- Use the exact same wallpaper image already bundled in the web demo
- In-app toggle button for switching between light and dark mode
- Design the app so adding 1-2 more wallpapers later is easy, but start with just the web demo wallpaper
- Shell script (bash) using `xcrun simctl io` -- simple, no extra dependencies
- Built-in verification: script captures 3 consecutive times and compares them, reporting pass/fail for pixel-identical repeatability
- Toggle between `.regular` and `.clear` variants (second in-app toggle) -- allows isolating each variant for separate screenshots
- Pure Apple defaults: use `.glassEffect(.regular)` and `.glassEffect(.clear)` with zero customization -- this is the authentic reference baseline
- Static glass over wallpaper only (matching web demo's static approach) -- dynamic scroll effects are out of scope for the baseline

### Claude's Discretion
- Optimal element arrangement for comparison (single screen vs tabs)
- Toggle button visibility during capture mode
- Screenshot output directory and file naming convention
- Variant labeling approach (overlay vs filename)
- Whether to include a "capture mode" that hides all UI chrome

### Deferred Ideas (OUT OF SCOPE)
- Additional wallpapers beyond the web demo one -- easy to add later but out of scope for initial implementation
- Dynamic glass over scrolling content -- future tuning target, not part of static baseline
- Adjusting the web demo layout to match the iOS reference -- that's a separate task after the reference app is built
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REF-01 | Separate Xcode project renders `.regular` and `.clear` glass variants over the same wallpaper image | SwiftUI `.glassEffect(.regular)` and `.glassEffect(.clear)` API documented; wallpaper is `src/assets/wallpaper.jpg` (1920x1080 sRGB JPEG); iOS 26+ deployment target required |
| REF-02 | Reference app includes a glass panel and a rounded element (search bar / pill button) | Four canonical elements specified: nav bar, search bar, large panel, pill button; `.glassEffect()` with `RoundedRectangle(cornerRadius:)` and `.capsule` shapes confirmed |
| REF-03 | Reference app supports light and dark mode variants | `preferredColorScheme(.light/.dark)` modifier toggles at view level; `xcrun simctl ui booted appearance light/dark` toggles at simulator level |
| REF-04 | Screenshots can be captured via `xcrun simctl io` script targeting iPhone 16 Pro Simulator | `xcrun simctl io booted screenshot --type=png` confirmed; iPhone 16 Pro is 402x874 points @3x = 1206x2622 pixels; `--mask ignored` for clean rectangles |
</phase_requirements>

## Standard Stack

### Core
| Library/Tool | Version | Purpose | Why Standard |
|-------------|---------|---------|--------------|
| SwiftUI | iOS 26+ | UI framework with `.glassEffect()` modifier | Only framework with native Liquid Glass API |
| Xcode | 26+ | IDE and build system | Required for iOS 26 SDK and Simulator |
| xcrun simctl | ships with Xcode | Simulator CLI for screenshots, appearance, status bar | Apple's official automation tool, no extra dependencies |
| Bash | 3.2+ (macOS default) | Capture and verification script | Decision locked: shell script with no extra dependencies |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| sips | macOS built-in | Image format info and basic processing | Checking wallpaper dimensions; no install needed |
| cmp | macOS built-in | Byte-level file comparison | Comparing stripped screenshots for pixel identity |
| exiftool | latest via brew | PNG metadata stripping for clean comparison | If sips cannot strip PNG text chunks; `brew install exiftool` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| exiftool for metadata strip | pngcrush (macOS dev tools) | pngcrush recompresses which could alter bytes; exiftool only strips metadata |
| cmp for comparison | sha256sum on stripped PNGs | Hash comparison is equivalent; cmp gives byte offset on failure which aids debugging |
| In-app toggle for variant | Separate build targets | Toggles are simpler and allow one binary for all screenshot permutations |

**Installation:**
```bash
# exiftool (only if sips metadata stripping is insufficient)
brew install exiftool
```

## Architecture Patterns

### Recommended Project Structure
```
ios-reference/
├── GlassReference.xcodeproj
├── GlassReference/
│   ├── GlassReferenceApp.swift          # @main entry, preferredColorScheme binding
│   ├── ContentView.swift                # Main view with ZStack wallpaper + glass elements
│   ├── Views/
│   │   ├── GlassNavBar.swift            # Navigation bar element
│   │   ├── GlassSearchBar.swift         # Search bar element (rounded)
│   │   ├── GlassPanel.swift             # Large card/sheet element
│   │   └── GlassPillButton.swift        # Floating pill button element
│   ├── Controls/
│   │   └── CaptureControls.swift        # Variant + color scheme toggles
│   └── Assets.xcassets/
│       └── wallpaper.imageset/          # Same wallpaper as web demo
├── capture.sh                           # Screenshot capture + verification script
└── screenshots/                         # Output directory for captured PNGs
```

### Pattern 1: Full-Screen Wallpaper Behind Glass Elements
**What:** Use `ZStack` with wallpaper image behind all glass-effected views, ignoring safe areas
**When to use:** Always -- this is the core layout pattern for reference screenshots
**Example:**
```swift
// Source: Apple Developer Documentation + LiquidGlassReference
struct ContentView: View {
    @State private var glassVariant: Glass = .regular
    @State private var colorScheme: ColorScheme = .light

    var body: some View {
        ZStack {
            // Full-bleed wallpaper background
            Image("wallpaper")
                .resizable()
                .aspectRatio(contentMode: .fill)
                .ignoresSafeArea()

            // Glass elements overlaid
            VStack(spacing: 20) {
                // Nav bar
                HStack { /* nav content */ }
                    .padding()
                    .glassEffect(glassVariant, in: RoundedRectangle(cornerRadius: 16))

                // Search bar (rounded/capsule)
                HStack { /* search content */ }
                    .padding()
                    .glassEffect(glassVariant, in: .capsule)

                // Large glass panel
                VStack { /* panel content */ }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .glassEffect(glassVariant, in: RoundedRectangle(cornerRadius: 28))

                Spacer()

                // Floating pill button
                Text("Action")
                    .padding(.horizontal, 24)
                    .padding(.vertical, 12)
                    .glassEffect(glassVariant, in: .capsule)
            }
            .padding()
        }
        .preferredColorScheme(colorScheme)
    }
}
```

### Pattern 2: Variant and Color Scheme Toggles
**What:** Two in-app toggles that switch the glass variant and color scheme at runtime
**When to use:** For interactive switching during development and scripted capture
**Example:**
```swift
// Toggle controls (can be hidden during capture mode)
struct CaptureControls: View {
    @Binding var glassVariant: Glass
    @Binding var colorScheme: ColorScheme
    @Binding var captureMode: Bool

    var body: some View {
        if !captureMode {
            VStack {
                Toggle("Clear Glass", isOn: Binding(
                    get: { glassVariant == .clear },
                    set: { glassVariant = $0 ? .clear : .regular }
                ))
                Toggle("Dark Mode", isOn: Binding(
                    get: { colorScheme == .dark },
                    set: { colorScheme = $0 ? .dark : .light }
                ))
            }
            .padding()
            .background(.ultraThinMaterial)
            .cornerRadius(12)
        }
    }
}
```

### Pattern 3: Capture Script with Verification
**What:** Bash script that captures 3 screenshots, strips metadata, and compares for pixel identity
**When to use:** Automated capture pipeline for repeatable reference screenshots
**Example:**
```bash
#!/bin/bash
set -euo pipefail

DEVICE="booted"
OUTPUT_DIR="./screenshots"
VARIANT="$1"    # "regular" or "clear"
MODE="$2"       # "light" or "dark"
BASENAME="${VARIANT}_${MODE}"

mkdir -p "$OUTPUT_DIR"

# Clean status bar for consistent captures
xcrun simctl status_bar "$DEVICE" override \
    --time "9:41" \
    --batteryState charged \
    --batteryLevel 100 \
    --wifiBars 3 \
    --operatorName ""

# Capture 3 consecutive screenshots
for i in 1 2 3; do
    xcrun simctl io "$DEVICE" screenshot \
        --type=png \
        --mask=ignored \
        "$OUTPUT_DIR/${BASENAME}_${i}.png"
    sleep 0.5  # Brief pause between captures
done

# Strip PNG metadata for clean comparison
for i in 1 2 3; do
    exiftool -all= -overwrite_original "$OUTPUT_DIR/${BASENAME}_${i}.png"
done

# Compare: all three must be byte-identical
if cmp -s "$OUTPUT_DIR/${BASENAME}_1.png" "$OUTPUT_DIR/${BASENAME}_2.png" && \
   cmp -s "$OUTPUT_DIR/${BASENAME}_2.png" "$OUTPUT_DIR/${BASENAME}_3.png"; then
    echo "PASS: ${BASENAME} - 3 captures are pixel-identical"
    # Keep only the first as the reference
    cp "$OUTPUT_DIR/${BASENAME}_1.png" "$OUTPUT_DIR/${BASENAME}.png"
    rm "$OUTPUT_DIR/${BASENAME}_{1,2,3}.png"
else
    echo "FAIL: ${BASENAME} - captures differ!"
    exit 1
fi
```

### Anti-Patterns to Avoid
- **Applying `.glassEffect()` to content views:** Glass is for the navigation layer only (nav bars, controls, floating elements) -- never apply to content like lists or images
- **Customizing glass material properties:** The locked decision is pure Apple defaults with zero customization -- do not add `.tint()` or `.interactive()` modifiers
- **Using physical device for reference:** The `.glassEffect()` renders dark on physical devices (confirmed bug) -- use Simulator exclusively
- **Hardcoding @3x pixel dimensions in the app:** Use SwiftUI points for layout; the capture script handles pixel-level output

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Glass material rendering | Custom blur/tint overlays | `.glassEffect(.regular/.clear)` | Must be authentic Apple rendering for ground truth |
| Screenshot capture | UIGraphicsImageRenderer in-app | `xcrun simctl io booted screenshot` | External capture avoids any in-app rendering artifacts |
| Color scheme switching | Manual `UIUserInterfaceStyle` overrides | `.preferredColorScheme()` or `xcrun simctl ui` | SwiftUI native approach respects glass material adaptation |
| Status bar cleanup | Manual view overlays | `xcrun simctl status_bar override` | Official tool, no app code changes needed |
| Pixel comparison | ImageMagick / custom diffing | `cmp -s` on metadata-stripped PNGs | Byte-level comparison is exact; no threshold ambiguity |

**Key insight:** The entire point of this phase is authentic Apple rendering. Every glass-related visual must come from Apple's native API with zero customization -- the reference app is the standard, not a recreation.

## Common Pitfalls

### Pitfall 1: PNG Metadata Breaks Byte Comparison
**What goes wrong:** `xcrun simctl io screenshot` embeds creation timestamps and other metadata in PNG files. Two visually identical screenshots produce different bytes.
**Why it happens:** PNG format supports text chunks (tEXt, iTXt, zTXt) for metadata like creation date. These change on every capture.
**How to avoid:** Strip all metadata before comparison. Use `exiftool -all= -overwrite_original file.png` or `sips` to re-export. Compare stripped files with `cmp -s`.
**Warning signs:** Screenshots look identical but `cmp` reports differences at low byte offsets (header/metadata area).

### Pitfall 2: Simulator Animations Cause Non-Deterministic Captures
**What goes wrong:** Glass effects may include subtle animation frames (e.g., shimmer, reflection gradient). Capturing during an animation yields different pixels each time.
**Why it happens:** `.glassEffect()` can include dynamic lighting/refraction that varies frame-to-frame, even in "static" mode.
**How to avoid:** Add a delay after app launch and after any state change (variant/mode toggle) before capturing. A 2-3 second sleep allows animations to settle. Consider setting `UIView.setAnimationsEnabled(false)` in a debug build or using `AccessibilityReduceMotion`.
**Warning signs:** The 3-capture verification fails intermittently.

### Pitfall 3: Wallpaper Aspect Ratio Mismatch
**What goes wrong:** The bundled wallpaper is 1920x1080 (16:9). iPhone 16 Pro is 1206x2622 (~0.46:1, portrait). Using `.scaledToFill()` crops significantly; `.scaledToFit()` leaves letterbox bars.
**Why it happens:** Desktop wallpaper aspect ratio differs dramatically from phone screen.
**How to avoid:** Use `.scaledToFill()` + `.ignoresSafeArea()` so the wallpaper fills the screen (matching the web demo behavior where the wallpaper also fills via CSS `object-fit: cover`). Both platforms will show the center portion. Document which crop region is visible for alignment in Phase 13 (diffing).
**Warning signs:** Diff scores are high due to different wallpaper crops between platforms.

### Pitfall 4: Safe Area Insets Affect Layout
**What goes wrong:** iPhone 16 Pro has a Dynamic Island notch and bottom home indicator. Glass elements positioned without accounting for safe areas get clipped or pushed.
**Why it happens:** SwiftUI respects safe areas by default. The wallpaper needs `.ignoresSafeArea()` but glass elements should respect it for authentic layout.
**How to avoid:** Apply `.ignoresSafeArea()` only to the wallpaper background. Let glass elements respect safe areas naturally (this is how Apple's own apps behave). The capture script uses `--mask=ignored` to get a clean rectangle without the notch cutout mask.
**Warning signs:** Glass elements appear shifted or clipped in screenshots.

### Pitfall 5: Using `.glassEffect()` on Physical Device
**What goes wrong:** Glass renders as dark/muddy gray on physical iPhones instead of the frosted glass appearance seen in Simulator.
**Why it happens:** Confirmed Apple bug (developer.apple.com/forums/thread/814005). The same code works in Simulator but fails on device.
**How to avoid:** Always use iOS Simulator for reference screenshots. This is already documented in the project's Out of Scope section.
**Warning signs:** Screenshots from device look completely different from Simulator.

## Code Examples

### App Entry Point with Color Scheme Binding
```swift
// Source: Apple SwiftUI documentation
import SwiftUI

@main
struct GlassReferenceApp: App {
    @State private var colorScheme: ColorScheme = .light

    var body: some Scene {
        WindowGroup {
            ContentView(colorScheme: $colorScheme)
                .preferredColorScheme(colorScheme)
        }
    }
}
```

### Full Glass Element Composition
```swift
// Source: Verified against Apple developer documentation and LiquidGlassReference
import SwiftUI

struct ContentView: View {
    @Binding var colorScheme: ColorScheme
    @State private var glassVariant: Glass = .regular
    @State private var captureMode = false

    var body: some View {
        ZStack {
            // Layer 1: Full-bleed wallpaper
            Image("wallpaper")
                .resizable()
                .aspectRatio(contentMode: .fill)
                .ignoresSafeArea()

            // Layer 2: Glass UI elements
            VStack(spacing: 16) {
                // Navigation bar
                HStack {
                    Image(systemName: "chevron.left")
                    Spacer()
                    Text("Reference")
                        .font(.headline)
                    Spacer()
                    Image(systemName: "ellipsis")
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .glassEffect(glassVariant, in: RoundedRectangle(cornerRadius: 16))

                // Search bar (rounded/capsule)
                HStack {
                    Image(systemName: "magnifyingglass")
                    Text("Search")
                        .foregroundStyle(.secondary)
                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .glassEffect(glassVariant, in: .capsule)

                // Large glass panel (card/sheet)
                VStack(alignment: .leading, spacing: 8) {
                    Text("Glass Panel")
                        .font(.title2)
                        .fontWeight(.semibold)
                    Text("This panel demonstrates the native Liquid Glass material rendering. It serves as the ground truth for web demo comparison.")
                        .font(.body)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(20)
                .glassEffect(glassVariant, in: RoundedRectangle(cornerRadius: 28))

                Spacer()

                // Floating pill button
                Text("Action Button")
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 12)
                    .glassEffect(glassVariant, in: .capsule)
            }
            .padding()

            // Layer 3: Controls overlay (hidden in capture mode)
            if !captureMode {
                VStack {
                    Spacer()
                    controlsOverlay
                }
            }
        }
    }

    private var controlsOverlay: some View {
        HStack(spacing: 16) {
            Button(glassVariant == .regular ? "Regular" : "Clear") {
                glassVariant = (glassVariant == .regular) ? .clear : .regular
            }
            Button(colorScheme == .light ? "Light" : "Dark") {
                colorScheme = (colorScheme == .light) ? .dark : .light
            }
            Button(captureMode ? "Show UI" : "Capture") {
                captureMode.toggle()
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
        .padding(.bottom, 60)
    }
}
```

### Simulator CLI Commands for Capture Pipeline
```bash
# Source: Apple developer documentation, verified via WebSearch

# List available simulators and find iPhone 16 Pro
xcrun simctl list devices available | grep "iPhone 16 Pro"

# Boot the simulator
xcrun simctl boot "iPhone 16 Pro"

# Set appearance to light mode
xcrun simctl ui booted appearance light

# Override status bar for clean screenshots
xcrun simctl status_bar booted override \
    --time "9:41" \
    --batteryState charged \
    --batteryLevel 100 \
    --wifiBars 3 \
    --operatorName ""

# Capture screenshot (PNG, no device mask)
xcrun simctl io booted screenshot --type=png --mask=ignored output.png

# Set appearance to dark mode
xcrun simctl ui booted appearance dark

# Clear status bar overrides when done
xcrun simctl status_bar booted clear
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.blur()` + `.background(.ultraThinMaterial)` | `.glassEffect(.regular/.clear)` | WWDC 2025 (iOS 26) | Native Liquid Glass with refraction, not just blur overlay |
| Fastlane snapshot for screenshots | `xcrun simctl io` + bash | Xcode 11+ (matured) | No Ruby dependency; simctl is built-in |
| SimulatorStatusMagic library | `xcrun simctl status_bar override` | Xcode 11+ | Built-in, no third-party code in simulator |
| `.environment(\.colorScheme)` for previews only | `.preferredColorScheme()` for runtime | iOS 14+ | Applies to entire window, not just preview |

**Deprecated/outdated:**
- `UIBlurEffect` / `UIVisualEffectView`: Still works but does NOT produce Liquid Glass -- only produces legacy Material Design blur
- SimulatorStatusMagic: No longer needed since `xcrun simctl status_bar override` covers all use cases

## Open Questions

1. **Matched viewport dimensions**
   - What we know: The web demo fills the browser viewport (100vw x 100vh). iPhone 16 Pro Simulator is 402x874 points (1206x2622 @3x pixels). The wallpaper is 1920x1080.
   - What's unclear: The user wants "matched viewport" but the web canvas is responsive. Do we constrain the web demo to a fixed size matching the phone, or vice versa? The iPhone screen is portrait; the wallpaper is landscape.
   - Recommendation: Design the iOS layout at the iPhone's native resolution. In Phase 13 (diffing), the comparison script can handle cropping/alignment. Document the exact visible wallpaper region in iOS screenshots so the web capture can match it.

2. **Glass animation settle time**
   - What we know: `.glassEffect()` may have subtle dynamic rendering even on static content (refraction, lighting).
   - What's unclear: Exact time needed for glass rendering to reach a deterministic steady state.
   - Recommendation: Use 2-second delay after state changes. If 3-capture verification still fails, increase to 5 seconds. Consider `AccessibilityReduceMotion` as a fallback to disable all animation.

3. **Capture mode toggle mechanism**
   - What we know: Controls need to be hidden for clean screenshots. Could use in-app toggle or launch argument.
   - What's unclear: Whether `xcrun simctl` can pass launch arguments to an already-running app.
   - Recommendation: Use `UserDefaults` with `xcrun simctl spawn booted defaults write` to set a `captureMode` flag, or simply toggle via the app's own UI before capture. In-app toggle is simplest.

## Sources

### Primary (HIGH confidence)
- [Apple Developer Documentation: glassEffect(_:in:)](https://developer.apple.com/documentation/swiftui/view/glasseffect(_:in:)) - API signature, Glass enum, shape parameter
- [Apple Developer Documentation: Applying Liquid Glass to custom views](https://developer.apple.com/documentation/SwiftUI/Applying-Liquid-Glass-to-custom-views) - Official guide
- [Apple WWDC25 Session 323: Build a SwiftUI app with the new design](https://developer.apple.com/videos/play/wwdc2025/323/) - Design patterns
- [iOS Dev Recipes: simctl reference](https://www.iosdev.recipes/simctl/) - Screenshot CLI flags

### Secondary (MEDIUM confidence)
- [LiquidGlassReference (GitHub)](https://github.com/conorluddy/LiquidGlassReference) - Comprehensive code examples verified against Apple docs
- [LiquidGlassSwiftUI (GitHub)](https://github.com/mertozseven/LiquidGlassSwiftUI) - Project structure pattern
- [Livsy Code: Glass Options in iOS 26](https://livsycode.com/swiftui/glass-options-in-ios-26-clear-vs-regular-frosted-glass/) - .regular vs .clear comparison with code
- [Apple Developer Forums: glassEffect() dark on device](https://developer.apple.com/forums/thread/814005) - Confirms device bug
- [Blisk: iPhone 16 Pro specs](https://blisk.io/devices/details/iphone-16-pro) - Viewport 402x874 @3x

### Tertiary (LOW confidence)
- [Sarunw: screenshot and video in Simulator](https://sarunw.com/posts/take-screenshot-and-record-video-in-ios-simulator/) - Screenshot command reference (verified with Apple docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - SwiftUI `.glassEffect()` is Apple's first-party API, well documented, single correct choice
- Architecture: HIGH - ZStack wallpaper + glass overlay is the canonical SwiftUI pattern; multiple reference projects confirm
- Pitfalls: HIGH - PNG metadata, animation non-determinism, and device bug are well-documented issues with clear mitigations
- Capture pipeline: MEDIUM - `xcrun simctl io screenshot` is well-known but pixel-identical reproducibility with Liquid Glass specifically has not been independently verified; the 3-capture verification will surface issues

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable APIs, iOS 26 is released)

# Phase 11: SwiftUI Reference App - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a native iOS app that renders authentic Apple Liquid Glass (`.regular` and `.clear` variants) over the same wallpaper used in the web demo. This app serves as the visual comparison ground truth — the iOS app defines the target, and the web demo will be adjusted to match it. Includes a capture script for repeatable PNG screenshots from the iOS Simulator.

</domain>

<decisions>
## Implementation Decisions

### Glass scene composition
- Use canonical Apple layout with all four element types: navigation bar, search bar, large glass panel (card/sheet), and floating pill button
- This establishes the visual standard — the web demo will be adjusted to match this layout, not the other way around
- Constrain the iOS layout to match the exact pixel dimensions of the web demo canvas (matched viewport) to eliminate scaling during comparison
- Arrange elements for cleanest automated comparison — Claude determines optimal layout (single screen vs tabbed) based on what produces the best diff results

### Wallpaper & color modes
- Use the exact same wallpaper image already bundled in the web demo
- In-app toggle button for switching between light and dark mode
- Design the app so adding 1-2 more wallpapers later is easy, but start with just the web demo wallpaper
- Toggle button visibility during captures: Claude's discretion (hidden for cleaner comparison vs visible for context)

### Capture pipeline
- Shell script (bash) using `xcrun simctl io` — simple, no extra dependencies
- Built-in verification: script captures 3 consecutive times and compares them, reporting pass/fail for pixel-identical repeatability
- Output directory and file naming: Claude's discretion based on what integrates best with the project structure

### Glass variant styling
- Toggle between `.regular` and `.clear` variants (second in-app toggle) — allows isolating each variant for separate screenshots
- Pure Apple defaults: use `.glassEffect(.regular)` and `.glassEffect(.clear)` with zero customization — this is the authentic reference baseline
- Variant labeling in screenshots: Claude's discretion (text overlay vs filename-only identification)
- Static glass over wallpaper only (matching web demo's static approach) — dynamic scroll effects are out of scope for the baseline

### Claude's Discretion
- Optimal element arrangement for comparison (single screen vs tabs)
- Toggle button visibility during capture mode
- Screenshot output directory and file naming convention
- Variant labeling approach (overlay vs filename)
- Whether to include a "capture mode" that hides all UI chrome

</decisions>

<specifics>
## Specific Ideas

- The iOS app is the ground truth — "canonical Apple layout and then adjust web demo to match"
- The capture pipeline must support automated iteration: design for repeated scripted runs, not manual testing
- Matched viewport dimensions between iOS and web eliminate scaling artifacts during comparison

</specifics>

<deferred>
## Deferred Ideas

- Additional wallpapers beyond the web demo one — easy to add later but out of scope for initial implementation
- Dynamic glass over scrolling content — future tuning target, not part of static baseline
- Adjusting the web demo layout to match the iOS reference — that's a separate task after the reference app is built

</deferred>

---

*Phase: 11-swiftui-reference-app*
*Context gathered: 2026-02-25*

# Phase 9: Image Background Engine - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Load and render real images as background textures behind glass components, with noise/image mode switching and sRGB-correct color pipeline. Replaces procedural noise as the default background. Custom user-supplied image URLs are NOT in scope for this phase — only the bundled wallpaper is supported in image mode.

</domain>

<decisions>
## Implementation Decisions

### Default wallpaper
- Nature photograph in macOS-style landscape aesthetic (sweeping scenery like Sequoia/Sonoma wallpapers)
- Resolution: 1920x1080, JPEG compressed to fit ~200KB budget
- Must be the exact same image used in the SwiftUI reference app (Phase 11) — critical for apples-to-apples pixel comparison
- Bundled-only: no custom image URL support in this phase (backgroundSrc deferred)

### Mode transition
- Instant swap between noise and image modes — no crossfade or animation
- Glass effect state is preserved across mode switches (only the background changes)
- Image mode is the new default when library initializes
- Noise mode remains available via `backgroundMode="noise"` prop on GlassProvider
- Both modes always available as a straightforward toggle

### Image sizing
- Optimize for 1:1 pixel-accurate comparison with iOS Simulator, not demo aesthetics
- Prefer native pixel rendering without resizing or cropping for comparison fidelity
- Demo polish is secondary to comparison accuracy — good-looking resize behavior can come later

### Claude's Discretion
- Canvas/viewport sizing strategy for 1:1 pixel matching with iOS Simulator
- Resize behavior when browser window changes
- Image loading/error states (not discussed — Claude handles fallback behavior)
- sRGB pipeline implementation details

</decisions>

<specifics>
## Specific Ideas

- "I do not care about a good looking demo for now, I am more interested in getting good comparisons that you can iterate on"
- The bundled wallpaper serves double duty: default background for Phase 9 AND the shared reference image for the Phase 13 screenshot diff pipeline
- Image sizing decisions are driven by the downstream comparison workflow, not visual polish

</specifics>

<deferred>
## Deferred Ideas

- Custom image URLs via `backgroundSrc` prop — future enhancement beyond Phase 9
- Multiple resolution variants for different device pixel ratios — not needed for comparison workflow

</deferred>

---

*Phase: 09-image-background-engine*
*Context gathered: 2026-02-25*

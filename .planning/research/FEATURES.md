# Feature Research

**Domain:** Apple Liquid Glass UI Control Library (iOS 26 / macOS Tahoe 26 parity)
**Researched:** 2026-03-25
**Confidence:** MEDIUM — Apple's HIG portal is JavaScript-gated (could not render). Specifications sourced from WWDC25 official session transcripts (HIGH confidence), Apple Newsroom (HIGH confidence), and developer implementation articles (MEDIUM confidence). Core control catalog is HIGH confidence; exact pixel measurements are LOW confidence.

---

## Apple Liquid Glass: Core Design Principles

Before listing controls, the HIG enforces a strict layering model that governs which controls receive glass treatment:

**The Navigation Layer Rule (HIGH confidence — multiple official WWDC25 sources):**
Glass belongs exclusively to the navigation layer that floats above app content. Never apply glass to content itself — lists, tables, media, body text. This is the most-violated rule in third-party implementations and the first anti-feature.

**Two material variants:**
- `.regular` — Default. Adapts light/dark based on background luminance. All adaptive effects. Most versatile.
- `.clear` — Permanently more transparent. Requires bold foreground content to maintain legibility. Media-rich contexts only (music players, wallpaper pickers).

**Two button styles:**
- `.glass` — Translucent, secondary actions
- `.glassProminent` — Opaque, primary actions (tinted with app tint color)

**Interactive behavior (`.interactive()`):**
Scale on press, bounce animation, shimmer effect, touch-point illumination that radiates from under the finger to nearby glass elements.

**GlassEffectContainer rule (HIGH confidence):**
Multiple glass elements that can overlap or morph must share a `GlassEffectContainer`. Glass cannot sample other glass — the container provides a shared sampling region. Morphing between glass shapes requires matching IDs within the same container namespace. Web equivalent: a shared render region where all glass elements composite together.

**Shape geometry:**
- Fixed shapes: constant corner radius regardless of size
- Capsules: radius = height/2 — dominant form for iOS/iPadOS interactive controls
- Concentric shapes: child radius = parent radius minus padding — used for nested glass

---

## Feature Landscape

### Table Stakes (Users Expect These)

Controls that every developer evaluating this library will look for. Missing these makes the library feel like a demo, not a product. These are the P1 showcase controls.

| Control | Why Expected | Complexity | Apple HIG Glass Treatment |
|---------|--------------|------------|--------------------------|
| **GlassButton** (update existing) | Core action primitive; every other control is built from buttons | LOW | `.glass` (translucent, secondary) / `.glassProminent` (opaque tinted, primary). Capsule shape. Scales + bounces on press. Shimmer emanates from touch point and radiates to adjacent glass elements. Tint only on primary actions. Automatic light/dark flip based on background luminance. |
| **GlassToggle** | Most recognizable Apple control; every settings screen | MEDIUM | Capsule track; glass-material lens thumb. Thumb "lifts into glass" on touch — transparent lens lets you see the value underneath through it. ON state fills track with tint color. Snap animation with spring overshoot. Sizing updated vs iOS 17 — accommodate in layout. |
| **GlassSlider** | Volume, brightness, scrubbing — every media and settings UI | MEDIUM | Glass-material thumb capsule with momentum preservation (thumb continues past finger release, decelerates). Track stretches at min/max boundary. Optional neutral value anchor (fill shows deviation left/right from default). Tick mark variant snaps to discrete positions. Thumbless style (no thumb) for non-interactive playback display. |
| **GlassSegmentedControl** | Mode switching, filter tabs — ubiquitous in Apple apps | MEDIUM | Container is opaque/tinted rounded rectangle (NOT glass). Selected segment gets glass-material capsule thumb inset within container. Thumb slides between segments with liquid spring inertia. Labels use vibrancy — adapt between above-thumb (glass) and above-container (tinted) regions. |
| **GlassTabBar** | Navigation — every multi-section app; most-recognized iOS 26 surface | HIGH | Full Liquid Glass bar floating above content. Items grouped into glass capsule clusters. Scroll-down: bar shrinks (minimizes), selected item shows icon only. Scroll-up: expands back. Selected item tinted. Scroll edge blur where content passes underneath. Extends beneath sidebar on iPad. |
| **GlassNavigationBar** | App header with back button and actions — essential for any app-like showcase | HIGH | Glass bar floating above content. Bar button items auto-grouped into visual glass clusters by function. Text buttons separate from icon buttons. Done/Close/Cancel get own glass background. Prominent buttons get own glass background. Bold left-aligned titles (iOS 26 typography). Morphing push/pop transitions. |
| **GlassSearchBar** | Search — expected in any serious showcase; instantly recognizable | MEDIUM | Glass capsule container for input field. Material: `.regular`. States: inactive (placeholder + search icon), active (keyboard + cursor + cancel button appears). Inline variant lives within navigation bar; standalone in toolbars. |
| **GlassToolbar** | Action bar — music players, photo editors, browsers — completes the nav layer | MEDIUM | Same glass cluster grouping as navigation bar. Items group by function and proximity into shared glass backgrounds. Primary action gets `.glassProminent` tint. Floats above content. |
| **GlassSheet** (update existing GlassPanel) | Every form, detail view, action flow — foundational overlay | MEDIUM | Full glass material with backdrop blur. Remove all custom background colors to expose glass. System-enforced corner radius (concentric with source). Adapts glass treatment between compact and expanded heights. With dimming layer for modal interruptions; without dimmer for parallel tasks. Scroll edge blur near sheet edges. |
| **GlassAlert** | Confirmations, errors, permissions — completes the modal family | LOW | System glass material with dimming layer (always modal). Actions: `.glass` for secondary, `.glassProminent` for primary, red-tinted for destructive. System-enforced corner radius. |
| **GlassCard** (update existing) | Content grouping, list items | LOW | Already exists. Audit: concentric corner radius (parent radius minus padding). Glass at rest, interactive variant on tap. Ensure consistent with v4.0 spec. |

### Differentiators (Competitive Advantage)

Controls that elevate the library from "CSS glassmorphism clone" to "authentic Apple fidelity showcase." These are where the WebGPU pipeline earns its complexity and where the showcase becomes memorable.

| Control | Value Proposition | Complexity | Apple HIG Glass Treatment |
|---------|------------------|------------|--------------------------|
| **GlassActionSheet** | The morph FROM button TO sheet is the most visually distinctive iOS 26 behavior — explicitly demonstrated in WWDC25 | HIGH | Anchored to source view (NOT screen bottom). Source button morphs / expands into action sheet — glass shape grows from button bounds. Each action is a `.glass` capsule row. Destructive action red-tinted. Optional dimmer. Dismiss reverses the morph back to source button. Requires shared GlassEffectContainer namespace with matched IDs. |
| **GlassContextMenu** | Long-press menus are everywhere in iOS 26; demonstrates preview + menu morph | HIGH | Preview layer appears above tapped content with blur layer underneath. Menu items are glass capsules in vertical stack. Source item gets glass border highlight. Dismiss reverses. Similar morph mechanism to ActionSheet but includes content preview blur layer. |
| **GlassFloatingActionButton** | Expand-to-radial-menu FAB is explicitly demonstrated in WWDC25 "Build a SwiftUI app" session | HIGH | Single glass capsule expands to reveal radial or vertical sub-actions (each own glass capsule). Sub-actions appear with staggered spring animations. Primary action is `.glassProminent`. All sub-actions share GlassEffectContainer for blending. Collapse reverses with spring. |
| **GlassMediaControls** | Play/pause/skip row — music apps, Control Center, video players; demonstrates glass button group | MEDIUM | Horizontal row of glass capsule buttons in shared GlassEffectContainer. Play/pause is `.glassProminent` (larger). Rewind/forward are `.glass`. Icon morphs between play↔pause states. Group blending creates seamless connected glass cluster. |
| **GlassNotificationBanner** | Lock screen / banners are a signature Liquid Glass surface; demonstrates dynamic shape morphing | MEDIUM | Glass pill floating above content. Expands from compact pill to full notification card on tap. `.regular` material. Dismiss via swipe. Compact↔expanded morph is the showcase — demonstrates dynamic shape scaling with preserved glass sampling. |
| **GlassProgressBar** | Completes media control story alongside slider; demonstrates thumbless variant | LOW | Thumbless slider: capsule track with animated fill. No interactive thumb. Glass tint on fill color. Useful as standalone or inside GlassMediaControls. Minimal additional work after GlassSlider. |
| **GlassPopover** | Tooltip/dropdown anchored to source — key for desktop-style and iPad layouts | MEDIUM | Animates from source button (new iOS 26 behavior: spawns FROM the barButtonItem rather than appearing at fixed position). Glass material with optional directional arrow. Auto-positions to stay on screen. Stemless variant in newer designs. |
| **GlassTextField** | Forms are inevitable; glass text input is natural companion for GlassSheet | MEDIUM | Glass capsule container. Placeholder uses vibrancy. Focus state adds specular highlight on border ring. Keyboard avoidance animates the glass field upward. Clear button (x) on non-empty content. Note: text fields are NOT Apple navigation layer — use only inside sheets/modals, documented clearly. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Glass applied to content cells / list rows** | Makes long lists look "glassy and modern" | Explicitly violates Apple's navigation-layer-only rule. Performance: glass compositing on 50+ list cells = 50+ shader passes per frame, well below 60FPS. Visually: translucent cells over translucent cells creates mud. NN/g documented this as a legibility failure in iOS 26. | Use glass only for the header/toolbar above the list. Content cells use standard opaque or vibrancy materials. |
| **Glass backgrounds on full-screen views** | Immersive "everything is glass" aesthetic | Glass is a foreground material that samples content behind it. With no distinct content layer behind it, the effect is empty blur over void. Apple's HIG explicitly forbids full-screen glass backgrounds. The `.clear` variant still requires bold foreground content and a content layer. | Use the existing procedural noise / image background engine as the content layer; glass floats above it at navigation layer height. This is the designed purpose of the project architecture. |
| **Stacked glass (glass on glass)** | Layered panels look deep and rich | The WebGPU architecture supports one sampling source per GlassEffectContainer. Glass rendering glass creates double-sampling — the second glass element has no valid content to sample, producing artifacts or black fill. Apple's SwiftUI `GlassEffectContainer` exists precisely to prevent this. | Use `GlassEffectContainer` grouping: overlapping glass elements share a single sampling region and appear to blend at their boundaries rather than stack independently. |
| **Fully opaque tinted glass throughout** | High contrast, readable everywhere | `.glassProminent` / tinting is reserved for primary actions only per HIG. Tinting every control destroys hierarchy — nothing reads as "primary" when everything is tinted blue. The HIG states: "tint selectively — only primary actions." | Maximum one `.glassProminent` tinted action per screen. Use `.glass` (translucent) for all secondary controls. Use color only to indicate state (on/off, active/inactive). |
| **iOS 15-era blur-only glassmorphism** | Familiar `backdrop-filter: blur()` CSS pattern | Blur-only misses refraction, rim lighting, specular highlights, chromatic aberration. Looks like the 2021 frosted glass trend, not iOS 26 Liquid Glass. Defeats the entire purpose of the WebGPU pipeline. | Use the full glass pipeline — refraction + blur + specular + Fresnel + rim lighting. The project ships 16 shader parameters precisely to support this full fidelity. |
| **Custom modal corner radius overrides** | Brand consistency, designer preference | iOS 26 system-enforces corner radii on modals with concentric geometry. The HIG explicitly states corners "can no longer be overridden freely." Overrides produce visually jarring inconsistency with system chrome. | Adopt concentric radius math: `child_radius = parent_radius - padding`. Define this in design tokens. Expose padding as the only customization axis. |
| **Static specular highlights (no interaction feedback)** | Simpler to implement; works without touch tracking | The `.interactive()` illumination from touch point is the signature behavior that makes Liquid Glass feel alive vs dead CSS blur. Apple's "Reduce Bright Effects" toggle in iOS 26.4 proves this matters enough to be user-controlled — it exists because the effect is visible and impactful. | Implement touch-position tracking and pass it to the glass shader as a uniform. At minimum: scale + bounce on press. Ideally: radial shimmer from touch point that propagates to nearby glass (one extra uniform per frame). |
| **CSS-only fallback mode** | Broader browser support | Explicitly out of scope per PROJECT.md. CSS blur cannot match refraction quality. Maintaining two visual quality tiers doubles QA surface. Reduces the project's value proposition to "just another glassmorphism lib." | WebGPU only. Chrome 113+, Edge 113+, Safari 18+ cover the target audience (developers and designers evaluating the library, not general consumers). Document browser requirements clearly. |
| **Full gyroscope / device tilt interactivity** | Specular highlights that respond to device tilt — Apple demos this prominently | Out of scope per PROJECT.md for v4.0 — "get static visuals right first." Adds device sensor API complexity and cross-origin permission requirements that block the showcase scope. | Defer to v5.0. Mouse-position-as-light-source is a reasonable desktop analog that can be added as a low-cost differentiator in v4.x. |

---

## Feature Dependencies

```
GlassButton (exists — update)
    |
    +--basis for──> GlassToggle (thumb is a glass capsule variant)
    +--basis for──> GlassSegmentedControl (selected thumb is glass capsule)
    +--basis for──> GlassMediaControls (row of glass capsule buttons)
    +--morphs into──> GlassActionSheet (button expands to action sheet)
    +--morphs into──> GlassContextMenu (button expands to menu)
    +--morphs into──> GlassFloatingActionButton (button expands to sub-actions)

GlassPanel / GlassCard (exist — update)
    |
    +--basis for──> GlassSheet (full-width panel, system corner radius)
    +--basis for──> GlassAlert (constrained panel + dimming)
    +--basis for──> GlassPopover (anchored panel with arrow)
    +--basis for──> GlassNotificationBanner (compact pill variant)

GlassSlider (new)
    |
    +--variant of──> GlassProgressBar (thumbless style, trivial after slider)

GlassNavigationBar
    |
    +--shares pattern with──> GlassToolbar (same button-group clustering)
    +--inline variant of──> GlassSearchBar (search inside nav bar)

GlassEffectContainer (coordination primitive — new)
    |
    +--required by──> GlassActionSheet (morph needs shared namespace)
    +--required by──> GlassContextMenu (morph needs shared namespace)
    +--required by──> GlassFloatingActionButton (sub-action blending)
    +--required by──> GlassTabBar (item cluster grouping within bar)
    +--required by──> GlassMediaControls (button group blending)

Touch-position tracking (new shader uniform)
    |
    +--enables──> interactive shimmer on ALL interactive controls
    +--required by──> GlassToggle thumb illumination
    +--required by──> GlassSlider thumb illumination
    +--enhances──> GlassButton press feedback
```

### Dependency Notes

- **GlassActionSheet / ContextMenu / FAB require GlassEffectContainer:** The morphing transition requires matched glass IDs in a shared namespace. Without the container, shapes teleport rather than morph. GlassEffectContainer is the highest-leverage new primitive — builds once, enables three high-impact controls.
- **Touch-position tracking is a cross-cutting concern:** All interactive controls benefit from touch-point illumination. Implement once in the GlassRenderer as a `vec2f touchPosition` uniform, apply to every interactive control's shimmer calculation.
- **GlassTabBar requires scroll integration:** The shrink-on-scroll behavior needs an intersection observer or scroll event listener. This is a React/DOM concern, not a shader concern. Separate from glass rendering complexity.
- **GlassSheet corner radius is system-enforced:** Apple uses concentric geometry (`parent_radius - padding`). The existing GlassPanel's arbitrary `borderRadius` prop must be updated to compute concentric radius from a `padding` or `inset` value. Update design tokens accordingly.
- **GlassSegmentedControl container is NOT glass:** The outer container uses tinted/opaque material. Only the selected thumb is glass. This is a common implementation mistake — applying glass to the whole control rather than just the thumb.

---

## MVP Definition (v4.0 Launch)

### Launch With (Showcase Phase)

Minimum set for a credible, impressive showcase that demonstrates the full capability range and earns "pixel-perfect Apple fidelity" claim.

- [ ] **GlassButton** (update) — `.glass` / `.glassProminent` styles; shimmer on touch; foundation for everything
- [ ] **GlassToggle** — glass-lens thumb; spring snap; most recognizable Apple control
- [ ] **GlassSlider** — momentum + stretch + thumbless variant; high visual distinction from CSS alternatives
- [ ] **GlassSegmentedControl** — glass thumb sliding between segments; essential for mode switching demos
- [ ] **GlassTabBar** — scroll-minimize behavior; grouped items; navigation showcase hero
- [ ] **GlassNavigationBar** — button clusters; bold titles; morphing transitions
- [ ] **GlassActionSheet** — hero morph animation from button; most distinctively iOS 26 behavior
- [ ] **GlassSheet** (update existing) — remove custom backgrounds; system corner radius; compact/expanded adaptation
- [ ] **GlassAlert** — simple; completes the modal family; high perceived completeness for low cost
- [ ] **GlassSearchBar** — expected in any app showcase
- [ ] **GlassToolbar** — action bar; button cluster pattern reuse from nav bar

### Add After Core Controls Work (v4.x)

- [ ] **GlassFloatingActionButton** — expand-to-menu morph; high wow factor; needs GlassEffectContainer solid first
- [ ] **GlassContextMenu** — long-press morph with preview; similar to ActionSheet
- [ ] **GlassMediaControls** — play/pause row; dependent on GlassProgressBar and group blending working
- [ ] **GlassProgressBar** — trivial after GlassSlider; thumbless variant
- [ ] **GlassPopover** — anchored tooltip; useful for dev tool pointers and inline menus
- [ ] **GlassNotificationBanner** — compact pill morph; good for demonstrating dynamic shape changes

### Future Consideration (v5+)

- [ ] **GlassTextField** — glass form input; keyboard avoidance, validation states; not pure showcase material
- [ ] **GlassDatePicker** — scrolling drum picker; high complexity gesture handling; niche for web
- [ ] **GlassStepper** — increment/decrement; low visual impact relative to implementation cost
- [ ] **Mouse-position-as-light-source** — desktop analog for gyroscope tilt; specular responds to pointer

---

## Feature Prioritization Matrix

| Control | Showcase Value | Implementation Cost | Priority |
|---------|---------------|---------------------|----------|
| GlassButton (update) | HIGH | LOW | P1 |
| GlassToggle | HIGH | MEDIUM | P1 |
| GlassSlider | HIGH | MEDIUM | P1 |
| GlassSegmentedControl | HIGH | MEDIUM | P1 |
| GlassTabBar | HIGH | HIGH | P1 |
| GlassNavigationBar | HIGH | HIGH | P1 |
| GlassActionSheet | HIGH | HIGH | P1 |
| GlassSheet (update) | MEDIUM | LOW | P1 |
| GlassAlert | MEDIUM | LOW | P1 |
| GlassSearchBar | MEDIUM | MEDIUM | P1 |
| GlassToolbar | MEDIUM | MEDIUM | P1 |
| GlassFloatingActionButton | HIGH | HIGH | P2 |
| GlassContextMenu | HIGH | HIGH | P2 |
| GlassMediaControls | MEDIUM | MEDIUM | P2 |
| GlassProgressBar | LOW | LOW | P2 |
| GlassPopover | MEDIUM | MEDIUM | P2 |
| GlassNotificationBanner | MEDIUM | MEDIUM | P2 |
| GlassTextField | LOW | HIGH | P3 |
| GlassDatePicker | LOW | HIGH | P3 |
| GlassStepper | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for v4.0 showcase launch
- P2: Add when showcase core is stable (v4.x)
- P3: Future milestone (v5+)

---

## Apple HIG Specifications per P1 Control

Consolidated from WWDC25 session transcripts and developer documentation. Confidence noted per item.

### GlassButton
- Shape: Capsule (radius = height/2) standalone; concentric radius when nested
- Primary (`.glassProminent`): Opaque glass tinted with app tint color; white foreground; use for ONE primary action per screen
- Secondary (`.glass`): Translucent; refraction visible; no tint; use for all other actions
- Press: Scale down + spring bounce on release; shimmer from touch point radiates outward to adjacent glass
- Adaptation: Automatic light/dark flip based on background luminance
- Source: WWDC25 sessions 219 ("Meet Liquid Glass") and 284 ("Build a UIKit app") — HIGH confidence

### GlassToggle
- Track: Fixed capsule, consistent aspect ratio; colored fill when ON
- Thumb: Glass-material capsule lens; inset within track; transparent to reveal value underneath on interaction
- Animation: Spring physics with slight overshoot and settle; snap to on/off positions
- Sizing: Updated vs iOS 17; allow extra layout accommodation
- Source: WWDC25 session 284 (UISwitch section) — HIGH confidence

### GlassSlider
- Track: Thin capsule; fill from minimum to thumb (or from neutral value)
- Thumb: Glass-material capsule; larger than track height; illuminates from touch point
- Momentum: Thumb continues past finger release with deceleration (like a physics simulation)
- Stretch: Track and/or thumb stretches when hitting min/max boundary
- Neutral value: Optional anchor; fill grows left or right from anchor point to show deviation
- Ticks: `numberOfTicks` config; thumb snaps to nearest discrete position
- Thumbless: No thumb; track-only; visual progress bar without interactivity
- Source: WWDC25 session 284 (UISlider section) — HIGH confidence

### GlassSegmentedControl
- Container: Opaque or tinted rounded rectangle — NOT glass itself
- Thumb: Glass-material capsule inset inside container; slides between segment positions
- Animation: Spring physics liquid inertia when switching segments
- Labels: Vibrancy-adapted — different treatment over glass thumb vs over container background
- Source: WWDC25 session 284 (UISegmentedControl section) — HIGH confidence

### GlassTabBar
- Bar: Full-width glass; items grouped into glass capsule clusters
- Minimize: Shrinks height on scroll-down; expands on scroll-up
- Minimized state: Icon only; no label
- Expanded state: Icon + label
- Selected item: Tinted; prominent in both states
- Accessory: Views placed above bar animate down with minimize
- Scroll edge: Blur effect where content scrolls underneath bar
- iPad: Extends beneath sidebar; bar + sidebar form unified navigation element
- Source: WWDC25 session 356 ("Get to know the new design system"), developer articles — HIGH confidence core; MEDIUM confidence for exact minimization spec

### GlassNavigationBar
- Bar: Glass floating above content
- Button grouping: Text buttons grouped separately; Done/Close/Cancel get own glass capsule background; prominent buttons get own glass capsule background; icon buttons grouped together
- Typography: Bold, left-aligned titles (new iOS 26 pattern)
- Push transition: Old bar items dissolve, new items materialize; glass continuity maintained
- Source: WWDC25 session 284 (navigation bar section) — HIGH confidence

### GlassActionSheet
- Position: Anchored to source view or button — appears directly above source, NOT at screen bottom
- Morph: Source glass button expands into action sheet; glass shape morphs from button bounds to sheet bounds
- Actions: Each action is a `.glass` capsule row; primary action `.glassProminent`; destructive action red-tinted
- Dimming: Optional — modal contexts get dimmer; parallel-task contexts do not
- Dismiss: Reverse morph back to source; or drag-down to dismiss
- Container: Requires GlassEffectContainer shared namespace with source button for morph
- Source: WWDC25 sessions 284 and 356 — HIGH confidence

### GlassSheet
- Corner radius: System-enforced concentric geometry — cannot be arbitrary
- Background: Remove all custom backgrounds; let glass material render through
- Height variants: Different glass treatment at compact vs expanded height
- Scroll edge: Blur at top and bottom where content scrolls near edges
- Modal: With dimming layer for interrupting; without dimmer for parallel tasks
- Source: WWDC25 session 356 — HIGH confidence

### GlassAlert
- Shape: Rounded rectangle; system corner radius
- Material: Glass with dimming (always modal)
- Actions: Bottom row; secondary `.glass`; primary `.glassProminent`; destructive red-tinted
- Source: WWDC25 session 284, developer best practices — HIGH confidence

### GlassSearchBar
- Shape: Capsule
- Material: `.regular` glass
- States: Inactive (placeholder + magnifier icon), active (cursor + keyboard + cancel button), results (dismiss suggestions)
- Context: Inline within navigation bar; standalone in toolbar
- Source: Referenced as automatic glass control across developer documentation — MEDIUM confidence

### GlassToolbar
- Pattern: Same button-cluster grouping as navigation bar
- Items: Group by function and proximity; each cluster shares glass background
- Primary: `.glassProminent` for one primary action
- Source: WWDC25 sessions 284 and 356 — HIGH confidence

---

## Competitor Feature Analysis

| Feature | CSS/SVG libs (rdev/liquid-glass-react, Liquid-Web) | Apple SwiftUI native | This Library (WebGPU) |
|---------|----------------------------------------------|---------------------|----------------------|
| Refraction (light bending) | SVG displacement (Chrome only) or CSS backdrop | Native GPU shader | True WGSL refraction shader |
| Specular highlights | CSS gradient overlay | GPU specular | GPU specular, configurable |
| Touch-point illumination | Not implemented | Native | Will implement via touch uniform |
| Chromatic aberration | Some implementations | Native | Existing shader parameter |
| Morphing transitions | CSS transition | Native spring | Exponential decay lerp |
| Full Apple control catalog | Single wrap component | Full system | Full catalog (this milestone) |
| Safari/Firefox support | Partial/broken | Native only | Chrome + Safari 18+ (WebGPU) |
| Apple HIG fidelity | LOW — visual approximation | HIGH — IS Apple | HIGH — screenshot diff validated |
| Control-level fidelity | Panel only | All controls | All P1 controls (v4.0) |

---

## Sources

- [WWDC25 "Meet Liquid Glass" (219)](https://developer.apple.com/videos/play/wwdc2025/219/) — HIGH confidence, official transcript
- [WWDC25 "Build a UIKit app with the new design" (284)](https://developer.apple.com/videos/play/wwdc2025/284/) — HIGH confidence, official transcript; UISwitch, UISlider, UISegmentedControl specifics
- [WWDC25 "Get to know the new design system" (356)](https://developer.apple.com/videos/play/wwdc2025/356/) — HIGH confidence, official; shape types, action sheets, scroll edge effects
- [WWDC25 "Build a SwiftUI app with the new design" (323)](https://developer.apple.com/videos/play/wwdc2025/323/) — HIGH confidence, official; FAB pattern, GlassEffectContainer
- [Apple Newsroom: "Apple introduces a delightful and elegant new software design"](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/) — HIGH confidence, official
- [Apple Developer: Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass) — HIGH confidence, official (JS-gated portal; content inferred from WWDC references)
- [Donny Wals: Exploring tab bars on iOS 26 with Liquid Glass](https://www.donnywals.com/exploring-tab-bars-on-ios-26-with-liquid-glass/) — MEDIUM confidence, developer article with code
- [Donny Wals: Designing custom UI with Liquid Glass on iOS 26](https://www.donnywals.com/designing-custom-ui-with-liquid-glass-on-ios-26/) — MEDIUM confidence, developer article
- [DEV: Liquid Glass in Swift: Official Best Practices for iOS 26 & macOS Tahoe](https://dev.to/diskcleankit/liquid-glass-in-swift-official-best-practices-for-ios-26-macos-tahoe-1coo) — MEDIUM confidence, summarizes official guidance
- [DEV: Understanding GlassEffectContainer in iOS 26](https://dev.to/arshtechpro/understanding-glasseffectcontainer-in-ios-26-2n8p) — MEDIUM confidence
- [NN/g: Liquid Glass Is Cracked and Usability Suffers](https://www.nngroup.com/articles/liquid-glass/) — MEDIUM confidence, usability critique; informs anti-feature rationale on legibility
- [Fatbobman: Grow on iOS 26 — Liquid Glass in UIKit/SwiftUI hybrid](https://fatbobman.com/en/posts/grow-on-ios26/) — MEDIUM confidence, real-world implementation notes on sheets and scroll edge
- [LiquidGlassReference GitHub (conorluddy)](https://github.com/conorluddy/LiquidGlassReference) — MEDIUM confidence, community reference; GlassEffectContainer constraints
- [iOS 26.4 Reduce Bright Effects — 9to5Mac](https://9to5mac.com/2026/03/23/ios-26-4-offers-two-liquid-glass-customization-updates/) — MEDIUM confidence; confirms touch-point illumination is significant enough for user control

---

*Feature research for: Apple Liquid Glass UI Control Library (v4.0)*
*Researched: 2026-03-25*

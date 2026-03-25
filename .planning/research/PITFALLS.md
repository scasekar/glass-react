# Pitfalls Research: v4.0 Glass Control Library & Showcase

**Domain:** Pixel-perfect Apple Liquid Glass UI controls + showcase page on top of existing WebGPU rendering pipeline
**Researched:** 2026-03-25
**Confidence:** HIGH for GPU pipeline and React integration pitfalls (derived from v3.0 source + WebGPU spec); MEDIUM for Apple HIG fidelity and showcase design pitfalls (derived from community research, NNGroup, and Infinum accessibility audits)

**Scope:** Pitfalls specific to v4.0: scaling from 3 glass components to 10+ functional controls, matching Apple's Liquid Glass design language pixel-perfectly, and building a showcase page that replaces the tuning page. v3.0 GPU/WASM pipeline pitfalls (device handle lifetime, WaitAny, UV convention, uniform buffer alignment) are addressed in the archived v3.0 PITFALLS research and are not repeated here — they remain valid and the patterns must not regress.

---

## Critical Pitfalls

---

### C1: Exceeding MAX_GLASS_REGIONS — Silent Rendering Corruption at >16 Controls

**What goes wrong:** `GlassRenderer` has a hard cap of `MAX_GLASS_REGIONS = 16` (inherited from v3.0). The uniform buffer is allocated at `(16 + 1) * 256 = 4352 bytes`. If a showcase page renders more than 16 glass components simultaneously (e.g., a full row of segmented control segments + modal + panel + cards), controls beyond slot 16 write to unallocated buffer memory, producing undefined fragment shader output — silent corruption, not an error.

**Why it happens:** The `addRegion()` method increments `this.nextId` without checking against the limit. The `regions` Map can grow beyond 16 entries. The render loop iterates `activeRegions.forEach((region, i) => ...)` and writes to offset `(i + 1) * UNIFORM_STRIDE` — when `i` exceeds 15, this writes past the allocated buffer end.

**How to avoid:**
1. Add a guard in `GlassRenderer.addRegion()`: if `this.regions.size >= MAX_GLASS_REGIONS`, log a warning and return a sentinel ID (or throw). Never silently overwrite.
2. Before building the showcase page, count how many simultaneous glass regions the page requires. If the showcase needs more than 16, either raise `MAX_GLASS_REGIONS` (update the buffer allocation in the same commit) or use CSS glass fallbacks for decorative-only elements.
3. Use a single `GlassPanel` wrapping a complex control cluster rather than each sub-element having its own region. Segmented control segments should share one parent `GlassPanel` region, with CSS handling the individual segment rendering inside it.
4. The uniform buffer size calculation is `(MAX + 1) * 256 bytes`. If raising the limit, update the `createBuffer({ size: ... })` call in `GlassRenderer.init()` to match. A mismatch between the runtime limit and the allocated buffer size is the silent corruption vector.

**Warning signs:**
- The 17th or later component on a page has no glass effect, or produces random colors.
- `GlassRenderer.regions.size` exceeds `MAX_GLASS_REGIONS` in a debug log.
- Adding a component to the showcase causes an unrelated earlier component to visually break.

**Phase to address:** Phase 1 (component API design). Audit the maximum region count before starting control implementation; raise the limit if needed with the buffer allocation update in the same commit.

---

### C2: getBoundingClientRect on Scrolled or Transformed Containers — Glass Misalignment

**What goes wrong:** `GlassRenderer.render()` calls `el.getBoundingClientRect()` every frame to get the element's viewport-relative position. This is correct for the full-page canvas model (where the canvas is `position: fixed; inset: 0`). If the showcase page introduces any scrollable container, CSS transform, or `position: sticky` ancestor, `getBoundingClientRect()` returns the viewport-adjusted rect correctly — but the glass canvas covers the full viewport, so the glass mask lands in the right place. The problem arises if a developer wraps components in a `overflow: auto` container that is itself positioned, or uses `transform: translateX()` for animations — these cause `getBoundingClientRect()` to drift from the canvas pixel position for offscreen elements.

**Why it happens:** The architecture assumes one full-viewport canvas, one coordinate system. A scrolled container clips elements but the canvas does not know about the clip. When an element is partially scrolled out of view, the glass mask renders outside the visible area — the glass effect bleeds through the container's clipping boundary because the WebGPU canvas ignores CSS overflow clipping.

**How to avoid:**
1. Keep the showcase page layout flat: use standard document flow with no scrollable inner containers wrapping glass components. One outer document scroll is fine.
2. Do not apply CSS transforms to elements that have `useGlassRegion` — transforms offset `getBoundingClientRect()` relative to the layout, which is fine, but transforms applied via JS animation (e.g., Framer Motion `animate={{ x: 100 }}`) update mid-frame, causing a one-frame misalignment per animation tick.
3. If any glass component needs a scroll container, clip the WebGPU output with a `<canvas>` element that matches the container dimensions rather than the full viewport — this requires architectural work and should be deferred to a later milestone.
4. Test all showcase layouts at multiple scroll positions to verify glass regions track their DOM elements correctly.

**Warning signs:**
- Glass effect is offset from the visual element by a fixed amount equal to the container's scroll position.
- Glass effect renders in the correct absolute position but outside the visible overflow boundary of its container.
- Works correctly at scroll position 0, breaks when page is scrolled.

**Phase to address:** Phase 1 (showcase layout architecture). Establish the layout constraints before any controls are placed on the page.

---

### C3: Pixel-Perfect Apple Fidelity — Matching the Effect, Not Just the Parameters

**What goes wrong:** The v3.0 tuning loop converged shader parameters toward Apple's Liquid Glass look using a procedural noise background and the default wallpaper. When a different background (user wallpaper, gradient, or solid color) is used, those same parameters produce a noticeably different visual — the glass looks too heavy, too light, or the rim/specular interaction is wrong. Developers mistakenly think parameter convergence = pixel-perfect, but Apple's effect is inherently background-dependent.

**Why it happens:** The dome refraction model displaces background pixels based on their UV position relative to the glass shape. On a uniform or simple background the effect is subtle; on a complex high-frequency background (wallpaper) the effect is dramatic. The v3.0 tuned parameters are optimized for the bundled wallpaper — they are not universal.

**How to avoid:**
1. Do not claim "pixel-perfect" for specific numeric parameters. Instead, design the control system so users can tune presets per background.
2. For the showcase page, use the same bundled wallpaper as the reference background — this is the only context where v3.0 tuned parameters are validated.
3. Per-control presets (button, toggle, slider, modal) should each have independently tuned defaults, not just the panel defaults. A small toggle behaves differently from a full-width panel because the ratio of rim area to interior area differs.
4. When comparing to Apple's native effect, use the same content area (fixed wallpaper, fixed size) and test at the same DPR. Apple's `.clear` style on iPhone 16 Pro Simulator at 3x DPR is the reference — do not compare against macOS screenshots (different DPR, different rendering context).

**Warning signs:**
- Screenshots on a plain white background look washed out compared to the showcase wallpaper demo.
- The "pixel-perfect" comparison passes on the reference wallpaper but fails when a user uploads their own image.
- iOS Simulator visual diff score is good for a panel but poor for a button of the same nominal parameters.

**Phase to address:** Phase 2 (per-control visual tuning). Each control needs individual visual validation against the Apple reference, not just inherited panel defaults.

---

### C4: Functional Controls as Glass Wrappers — State and DOM Event Conflicts

**What goes wrong:** New controls (toggle, slider, segmented control) are implemented by wrapping native HTML inputs or custom elements in `GlassPanel`/`GlassButton`. The glass region is registered on the wrapper, which is a `div`. When the native input inside fires events (`onChange`, `onInput`, `onPointerDown`) and updates React state, the re-render causes the wrapper's position or size to change — `getBoundingClientRect()` returns a new rect on the next rAF frame. If the morph animation (`morphSpeed`) is too slow, the glass mask visually lags the DOM element during interactive transitions (toggle sliding, slider thumb dragging).

**Why it happens:** The glass mask updates on the next rAF frame using the new `getBoundingClientRect()` value, but the DOM element updates immediately during the event. At 60FPS, a 16ms lag is invisible for static elements, but during a drag or toggle animation where the element changes shape/size/position at interactive speed, the one-frame lag becomes visible misalignment.

**How to avoid:**
1. Keep glass regions on stable-size containers, not on elements that change dimensions during interaction. A toggle track is stable; the thumb that slides inside it should be a CSS-only animation, not a separate glass region.
2. For elements that must change size (e.g., an expanding panel), use a high `morphSpeed` (instantaneous snap at `morphSpeed: 0`) so the glass catches up in one frame.
3. Sliders should register one glass region on the slider track (stable), with the thumb rendered purely via CSS. Do not give the draggable thumb its own glass region.
4. Test each interactive control at 60FPS with Chrome DevTools slow-motion recording to verify no visible glass lag during interaction.

**Warning signs:**
- Toggle animation looks fine at 30FPS but the glass mask briefly shows the old position at 60FPS during the toggle transition.
- Slider drag causes the glass overlay to jitter or trail behind the thumb.
- Any control that changes its CSS dimensions during interaction shows a one-frame glass misalignment.

**Phase to address:** Phase 2 (functional controls). Design each control's region topology before implementing interaction, not after.

---

### C5: Overuse of Glass — Cognitive Overload and Readability Degradation

**What goes wrong:** Every component on the showcase page uses the full glass effect. When 10+ glass regions are visible simultaneously, the refraction of the complex background creates a "snow globe" effect — no single element stands out, text contrast drops below WCAG requirements on some backgrounds, and users cannot distinguish interactive from decorative elements.

**Why it happens:** The library makes it easy to apply glass to anything, and during development every element is tested in isolation where the effect looks compelling. The showcase page renders everything together for the first time, revealing that the aggregated effect overwhelms the visual hierarchy.

**How to avoid:**
1. Use Apple's own HIG constraint: one primary glass material per logical view layer (toolbar, modal, floating card). Secondary elements within a glass panel should be CSS-only, not additional glass regions.
2. Establish a visual hierarchy rule: only interactive or primary-focus elements get GPU glass regions. Decorative dividers, labels, and secondary text use CSS glassmorphism (`backdrop-filter: blur()`) or no glass at all.
3. The showcase page should demonstrate the hierarchy visually — not a grid of equal-weight glass components, but a realistic app layout where glass is used purposefully.
4. Test readability by disabling JavaScript (which removes all WebGPU effects) — if the layout still communicates hierarchy clearly, the glass is enhancing; if the layout collapses without it, the glass is carrying structural work it shouldn't.

**Warning signs:**
- Screenshot of the showcase page looks "glassy everywhere" with no clear focal point.
- A user in a usability test cannot identify which element is the primary call-to-action.
- Contrast checker (browser extension or Lighthouse) fails more than 2 elements on the showcase page.

**Phase to address:** Phase 3 (showcase page layout). Establish a hierarchy document before placing components. This is a design decision, not an implementation fix.

---

### C6: Accessibility Regression — Glass Effects Defeating reducedTransparency Support

**What goes wrong:** New controls (toggle, slider, modal) add their own hover/press state mutation of glass props (as `GlassButton` does: `effectiveBlur = pressed ? blur * 0.3 : blur`). When `reducedTransparency` is active, `useGlassRegion` correctly collapses all effects to an opaque surface. But if a control's interaction handler mutates the component's local state and bypasses the `reducedTransparency` guard in `useGlassRegion` — for example, by directly calling `handle.updateBlurRadius()` without checking `prefs.reducedTransparency` first — the control partially breaks the accessibility contract.

**Why it happens:** The `reducedTransparency` guard lives inside `useGlassRegion`'s second `useEffect` (the param-sync effect). It fires when `prefs.reducedTransparency` changes. But if a control calls `handle.updateXxx()` directly (bypassing `useGlassRegion`) in an event handler, that update fires before the next `useEffect` run, temporarily restoring glass effects in a reduced-transparency session.

**How to avoid:**
1. Never call `handle.updateXxx()` directly from event handlers. All glass parameter updates must go through the props passed to `useGlassRegion` — the hook's `useEffect` is the single authority over what params are sent to the renderer, and it already applies the `reducedTransparency` guard.
2. New controls should express all interaction state as React state variables that feed into `useGlassRegion`'s props, following the exact pattern in `GlassButton`: `effectiveBlur`, `effectiveSpecular`, `effectiveRim` computed from state and passed as props.
3. Add a test for each new control: enable `reducedTransparency`, interact with the control (click, drag), and verify the renderer's uniform buffer shows `blurIntensity: 0` throughout.
4. The `useGlassRegion` defaults (line 94-113 of `useGlassRegion.ts`) also handle the `reducedMotion` preference via `handle.updateMorphSpeed(0)`. New controls that introduce additional morph animations must also respect this.

**Warning signs:**
- A toggle click briefly flashes the glass effect when `reducedTransparency` is enabled in OS settings.
- The toggle animation runs even when `reducedMotion` is enabled (animation should be instant).
- A new control works correctly in normal mode but appears to glow or blur momentarily during interaction in accessibility mode.

**Phase to address:** Phase 2 (each control's interaction implementation). Test in reduced-transparency mode before marking any control complete.

---

### C7: Demo vs. Production — Showcase Page Hiding Real Performance Cost

**What goes wrong:** The showcase page uses a hand-picked wallpaper background and fixed layout optimized to look good. Real-world usage (different backgrounds, different screen sizes, more components) exposes that the 81-tap Gaussian blur in the glass shader costs ~0.8ms per region on mobile GPUs. With 10 glass regions visible on the showcase, the shader alone costs ~8ms/frame — leaving only 8ms for background rendering, React updates, layout, and composite at 60FPS.

**Why it happens:** The showcase is built on a desktop with a discrete GPU where 8ms of fragment shader work is trivially available. The performance budget is not validated on integrated/mobile GPU until a user reports jank. The existing 16-region cap prevents unbounded cost, but 10 regions is still expensive on weak hardware.

**How to avoid:**
1. Before finalizing the showcase layout, benchmark with the Chrome DevTools Performance panel on a CPU/GPU throttled profile (4x slowdown, mobile GPU simulation). Target <5ms total shader time.
2. Apply the existing v3.0 region cap (16 max) as a showcase design constraint, not just a technical limit. Aim for 8 or fewer simultaneous glass regions on the primary showcase view.
3. Controls that are not in the viewport should have their glass regions unregistered (via `useGlassRegion`'s cleanup path when the component unmounts or is hidden). Use `display: none` instead of `visibility: hidden` or `opacity: 0` — only `display: none` triggers unmount and region cleanup.
4. Consider a "reduced effects" mode for the showcase page triggered by `prefers-reduced-motion` or a frame rate drop below 30FPS — fall back to CSS `backdrop-filter` for secondary components when the GPU is under pressure.

**Warning signs:**
- Chrome DevTools GPU timeline shows frame time exceeding 16ms on a 2020-era MacBook Air.
- `requestAnimationFrame` callbacks are consistently scheduled more than 3ms late (visible in Chrome tracing).
- The background animation (C++ noise) shows micro-stutters when more than 8 glass regions are visible.

**Phase to address:** Phase 1 (performance budget). Set the showcase region limit before building content, not after.

---

### C8: Showcase Page as a Landing Page — Navigation and Information Architecture Failures

**What goes wrong:** The showcase page is built as a technical demo: a grid of every control variant, labeled with prop names. While useful for developers, it fails as a landing page for designers and potential adopters — there is no narrative, no call-to-action, and the grid layout with 10+ controls in equal visual weight communicates nothing about what the library is for.

**Why it happens:** During development, the page is built incrementally (add a toggle, add a slider, add a modal) and the final layout is never designed — it just accumulates. The result looks like a component kitchen sink, not a product showcase.

**How to avoid:**
1. Design the showcase page's information architecture before writing any components. It must answer three questions in order: (1) what is this? (2) why does it look amazing? (3) how do I use it? The components are the answer to #2, not the entire page.
2. The showcase should tell a story: hero section (full-screen glass effect, headline), feature highlights (2-3 key controls in context), interactive demo (user can interact with controls), developer section (code snippet, install command).
3. The tuning page is not removed — it becomes a secondary panel (drawer or tab) accessible from the showcase, as specified in the project requirements. Never build the showcase as a reskinned tuning page.
4. Test the page with someone who has not seen the library before. If they cannot describe what the library does within 10 seconds of landing, the hierarchy is wrong.

**Warning signs:**
- The showcase page looks identical to the tuning page but with more components.
- The first thing a visitor sees is a parameter slider or a labeled grid of component variants.
- The page has no visible call-to-action (no install command, no GitHub link, no "try it" affordance).

**Phase to address:** Phase 3 (showcase layout). Define the IA document and a wireframe before any showcase code is written.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Copy GlassButton's hover/press state logic into every new control | Fast first implementation | 6 copies of the same 15-line block; one bugfix must be applied to each manually | Never — extract to a `useGlassInteractionState(props)` hook and share |
| Give every sub-element of a composite control its own glass region | Each sub-element independently refracts | Exceeds MAX_GLASS_REGIONS on a realistic page; per-element regions at small scale look over-engineered | Never for sub-elements — register one region on the control's outer container |
| Hard-code Apple wallpaper as the only background option | Showcase always looks good | Library appears unusable with custom backgrounds; exposes parameter fragility | Acceptable for v4.0 demo; add background picker in a later milestone |
| Inline all control styles in the component file | Zero CSS dependencies | Impossible to theme; 300+ lines of style object in each component file | MVP only — move to CSS custom properties with design tokens before publish |
| Skip TypeScript discriminated unions for control variants | Faster to write with wide prop types | Consumers cannot distinguish `<GlassToggle checked />` from `<GlassToggle value="on" />` — type errors surface at runtime not compile time | Never for public API |

---

## Integration Gotchas

Common mistakes when connecting new controls to the existing glass pipeline.

| Integration Point | Common Mistake | Correct Approach |
|---|---|---|
| New control registered with `useGlassRegion` | Registering before the element is mounted (ref is null at hook call time) | `useGlassRegion` already guards `if (!ctx.ready \|\| !elementRef.current) return;` — this is safe, but the ref must be attached to the DOM element, not a portal target |
| Modal / overlay control | Registering the modal's glass region when the modal is hidden (`display: none`) | `display: none` triggers unmount → region cleanup automatically. Only mount the modal's glass content when the modal is open |
| Segmented control segments | One glass region per segment | One glass region on the track container; segments are CSS-only borders inside the glass surface |
| Slider thumb | Glass region on the thumb element (changes position during drag) | Glass region on the stable slider track; thumb is a CSS `::before` pseudo-element or absolutely-positioned div with no glass region |
| Controlled components (external state) | Calling `handle.updateXxx()` directly in `onChange` | Update React state in `onChange`; let `useGlassRegion`'s `useEffect` sync params to the renderer on the next render cycle |

---

## Performance Traps

Patterns that work at small scale but fail as control count grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Each control calls `getBoundingClientRect()` in a useEffect during render | Layout thrashing during page load — all elements force sync layout sequentially | `GlassRenderer.render()` already batches all `getBoundingClientRect()` calls in one rAF loop; controls must NOT call it outside the rAF loop | Breaks when >4 controls mount simultaneously (compounding forced reflows) |
| Showcase page mounts all controls at page load, including off-screen ones | Page load time spikes; MAX_GLASS_REGIONS exceeded before visible components mount | Use lazy mounting for components below the fold (`IntersectionObserver` → mount on first intersection) | Breaks at >6 controls if any are below the fold |
| Each hover state change triggers React re-render of parent | CPU usage spikes on rapid mouse movement over a control cluster | Isolate hover state inside the control component; do not lift hover state to a parent that re-renders siblings | Breaks when >3 controls are hovered in quick succession (mouse sweep) |
| `morphSpeed` set to 0 for all interactive state transitions | Eliminates transition lag | All transitions are frame-0 snaps — loses the smooth-morph feel that distinguishes the library | Acceptable for reducedMotion mode only; all other modes should use morphSpeed >= 4 |
| CSS `transition` applied to the same properties managed by morphLerp | Smooth double-transition | CSS transition and morphLerp fight each other — the rendered position oscillates | Never apply CSS transitions to properties that useGlassRegion controls (cornerRadius, blur, opacity) |

---

## UX Pitfalls

Common user experience mistakes specific to this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Text placed directly over glass without enforced minimum contrast | Text is unreadable on complex wallpapers — contrast ratio as low as 1.5:1 (NNGroup audit of iOS 26 found this exact failure) | Apply `textShadow` (dark mode) or strong background scrim under text; measure contrast ratio against the actual background pixels, not a solid color approximation |
| Touch targets inside glass controls smaller than 44×44pt | Tap error rate increases significantly on mobile; users hit adjacent controls | Every interactive element inside a glass region must be at minimum 44×44 CSS pixels — Apple's own HIG requirement |
| All controls animate identically (same morphSpeed, same specular boost on hover) | Interface feels mechanical and undifferentiated; no visual affordance distinguishes control types | Differentiate interaction feel by control type: buttons get specular boost, toggles get rim intensity change, sliders animate blurRadius along the track |
| Glass modal covers the entire viewport with no apparent edge | Users cannot tell the modal is dismissible or how large it is; "no exit" feeling | Give modals a distinct corner radius (larger than panels), a clear close affordance, and a subtle drop shadow or rim outside the glass edge to define the modal boundary |
| Segmented control active segment not visually distinct | Users cannot tell which segment is selected | Active segment needs a meaningfully different glass effect — higher opacity, stronger specular, or a CSS-only highlight ring — not just a subtle tint change invisible against a busy background |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Toggle control:** Animates visually, but `onChange` callback is never wired to parent state — verify with a controlled test that toggling updates the parent value.
- [ ] **Slider control:** Thumb drags smoothly, but `onValueChange` is not called on every drag event — verify value updates continuously, not just on `pointerup`.
- [ ] **Segmented control:** Active segment highlighted, but keyboard navigation (Tab + Arrow keys) is not wired — verify via keyboard-only interaction test.
- [ ] **Modal control:** Opens and closes with animation, but focus is not trapped inside the modal while open — verify using screen reader or Tab key.
- [ ] **Any control:** Glass region registered, but `aria-label` or semantic role is missing — verify each control passes `axe-core` accessibility scan.
- [ ] **Showcase page:** Components render in development, but the page crashes in production build due to missing WASM binary or incorrect Vite asset handling — verify `npm run build && npm run preview` produces a working page before any milestone review.
- [ ] **Showcase page:** Looks good on MacBook at 100% zoom, but breaks at 150% browser zoom or on a 1366×768 laptop screen — verify at 1280px viewport width.
- [ ] **All controls:** Work with default (image) background mode but have not been tested with `backgroundMode="noise"` — verify all controls render correctly in noise mode.
- [ ] **MAX_GLASS_REGIONS:** Showcase page appears to work, but region count has not been measured — verify `GlassRenderer.regions.size` is always below `MAX_GLASS_REGIONS` during showcase page interaction.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| C1: Silent rendering corruption past region 16 | LOW | Add guard in `addRegion()` — one-line fix; audit showcase page to reduce simultaneous regions below 16 |
| C2: Glass misalignment in scrolled container | HIGH | Remove the scrollable container wrapping glass components; restructure layout to use document scroll only |
| C4: Glass mask lags interaction | LOW | Move the glass region to the stable outer container; use CSS-only animations for the inner interactive element |
| C5: Cognitive overload from too many glass regions | MEDIUM | Reclassify decorative components as CSS `backdrop-filter` only; redesign showcase hierarchy |
| C6: Accessibility regression in new controls | MEDIUM | Revert to the `useGlassRegion` props pattern; remove any direct `handle.updateXxx()` calls from event handlers |
| C7: Performance budget exceeded on mobile | MEDIUM | Reduce visible regions below 8 on the primary showcase view; add lazy-mount for off-screen controls |
| C8: Showcase looks like a kitchen sink | HIGH | Rebuild showcase layout from an IA document; treat it as a product landing page design project, not a component grid |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| C1: Region cap exceeded | Phase 1 — component API design | Count simultaneous regions on showcase page; guard in `addRegion()` logs warning if exceeded |
| C2: Scroll container misalignment | Phase 1 — showcase layout architecture | Smoke test at 3 scroll positions; glass must track DOM element ±2px |
| C3: Parameter fragility on non-reference background | Phase 2 — per-control visual tuning | Visual diff against iOS Simulator at same DPR for each control individually |
| C4: Glass lag on interactive controls | Phase 2 — each functional control | 60FPS recording shows no visible glass misalignment during toggle/slider interaction |
| C5: Cognitive overload | Phase 3 — showcase page layout | Usability test: 3 people can identify the CTA within 10 seconds of first seeing the page |
| C6: Accessibility regression | Phase 2 — each control | `axe-core` passes; reducedTransparency manual test for each control shows opaque surface during interaction |
| C7: Mobile GPU performance | Phase 1 and Phase 3 | Chrome DevTools throttled GPU benchmark: <5ms shader time total on showcase primary view |
| C8: Showcase IA failure | Phase 3 — showcase layout | Pre-build wireframe review before any showcase code is written |

---

## Sources

- [NNGroup: Liquid Glass Is Cracked, and Usability Suffers in iOS 26](https://www.nngroup.com/articles/liquid-glass/) — touch target violations, animation overuse, navigation pattern failures — MEDIUM confidence (NNGroup is authoritative on UX but this covers Apple's implementation specifically)
- [Infinum: Apple's iOS 26 Liquid Glass — Sleek, Shiny, and Questionably Accessible](https://infinum.com/blog/apples-ios-26-liquid-glass-sleek-shiny-and-questionably-accessible/) — contrast ratios as low as 1.5:1 in beta testing, reducedTransparency shortfalls — MEDIUM confidence (verified against Apple's HIG)
- [Apple Human Interface Guidelines — Liquid Glass](https://developer.apple.com/documentation/TechnologyOverviews/liquid-glass) — authoritative source on when and how to apply glass — HIGH confidence
- [DebugBear: How To Fix Forced Reflows And Layout Thrashing](https://www.debugbear.com/blog/forced-reflows) — `getBoundingClientRect()` in rAF loops — HIGH confidence
- [WebGPU Fundamentals: WebGPU Scale](https://webgpufundamentals.org/webgpu/lessons/webgpu-scale.html) — draw call overhead, uniform buffer patterns — HIGH confidence
- [TanStack/virtual issue #359: getBoundingClientRect() is called on every frame](https://github.com/TanStack/virtual/issues/359) — real-world getBoundingClientRect performance in rAF loops — MEDIUM confidence
- Project source: `src/renderer/GlassRenderer.ts` lines 10-12 (`MAX_GLASS_REGIONS = 16`, `UNIFORM_STRIDE = 256`, `uniformBuffer` allocation) — HIGH confidence (source of truth for region cap)
- Project source: `src/hooks/useGlassRegion.ts` lines 62-88 (reducedTransparency guard pattern) — HIGH confidence (source of truth for accessibility contract)
- Project source: `src/components/GlassButton.tsx` lines 54-62 (hover/press state → effective props pattern) — HIGH confidence (source of truth for interaction state pattern)
- Designedforhumans.tech: Apple's New Liquid Glass Design: Practical Guidance — minimum contrast enforcement, visual hierarchy rules — MEDIUM confidence

---
*Pitfalls research for: v4.0 Glass Control Library & Showcase*
*Researched: 2026-03-25*

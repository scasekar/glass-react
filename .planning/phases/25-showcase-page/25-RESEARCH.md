# Phase 25: Showcase Page - Research

**Researched:** 2026-03-25
**Domain:** Product landing page — React single-page scroll layout, IntersectionObserver virtualization, wallpaper selector, TuningDrawer slide-in panel, demonstrating all v4.0 glass controls
**Confidence:** HIGH (architecture from live codebase; IA patterns from established product landing page conventions; GPU budget from direct GlassRenderer.ts read)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SHOW-01 | Showcase page replaces tuning page as main landing with professional product layout | App.tsx mounts `<ShowcasePage />` inside existing `<GlassProvider>`; showcase uses single-page scroll with semantically grouped sections; no React Router needed; anchor-based section nav |
| SHOW-02 | TuningDrawer provides slide-in access to all existing tuning controls from showcase | TuningDrawer is always-mounted, hidden via `transform: translateX(100%)`; toggle button in sticky showcase header drives `tuningDrawerOpen: boolean` in ShowcasePage state; existing tuning UI wrapped, not deleted |
| SHOW-03 | IntersectionObserver-based section virtualization keeps active GPU regions within budget | `useIntersectionObserver(rootMargin: '100%')` hook per section; sections conditionally render children only when `isNear` is true; `useGlassRegion` cleanup path releases regions on unmount; `MAX_GLASS_REGIONS = 32` is the hard cap (confirmed at GlassRenderer.ts line 10) |
| SHOW-04 | Wallpaper selector allows switching background image/noise from showcase page | `GlassProvider` already accepts `backgroundMode` prop (`'image' | 'noise'`); wallpaper state lifts to App.tsx which re-passes to GlassProvider; selector is a `GlassSegmentedControl` or set of `GlassChip`s in the showcase hero or sticky header |
</phase_requirements>

---

## Summary

Phase 25 assembles all v4.0 glass controls (Phases 20-24) into a professional product landing page that replaces the existing `App.tsx` tuning demo. The phase is primarily a design and composition challenge, not an infrastructure challenge — all primitives, controls, and GPU machinery are already shipped. The showcase page must answer three questions in order: (1) what is this library? (2) why does it look better than CSS alternatives? (3) how do I start using it? Controls are the evidence for #2, arranged in a narrative layout that resembles an Apple product page, not a component grid.

The GPU region budget is the only technical constraint requiring active management. `MAX_GLASS_REGIONS = 32` (raised in Phase 20 from 16) means up to 32 simultaneous glass regions can be active. A full showcase page mounting all sections and all control instances simultaneously would exceed this budget. The mitigation is `IntersectionObserver`-based section virtualization: each section is wrapped in a `<VirtualSection>` component that conditionally renders its children only when the section is within one viewport of the current scroll position. React's unmount cleanup in `useGlassRegion` releases GPU regions when sections scroll far away. This approach keeps the simultaneously-active region count well under 32 at any scroll position.

The TuningDrawer preserves the existing v3.0 tuning UI without deletion. It is always-mounted but hidden via CSS transform. The wallpaper selector requires lifting `backgroundMode` state from inside `GlassProvider` to `App.tsx`, where it can be driven by a control in the showcase. The audience is developers and designers — the page must impress a designer visually in 3 seconds and give a developer a copy-paste install command within 10 seconds of scrolling.

**Primary recommendation:** Build in four sequential waves — (1) VirtualSection infrastructure + TuningDrawer shell + App.tsx wiring, (2) hero and two or three high-impact control sections, (3) remaining control sections, (4) developer quick-start section + wallpaper selector + visual polish pass.

---

## Standard Stack

### Core (all already installed — nothing new to add)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `motion` | ^12.38.0 (installed) | Sticky header entrance, section fade-in, TuningDrawer slide animation | `useReducedMotion()` for a11y; `AnimatePresence` for drawer enter/exit |
| `GlassPanel` | in-repo | Hero section glass cards, feature highlight panels | Unchanged v3.0 primitive |
| `GlassButton` | in-repo | CTA buttons in hero, links in developer section | Unchanged v3.0 primitive |
| All v4.0 controls | in-repo (phases 21-24) | Demonstrated in contextual sections | All exported from `src/index.ts` |
| `GlassEffectContainer` | in-repo | Grouping related controls within a section | Phase 20 primitive |
| `APPLE_SPACING`, `APPLE_RADII`, `APPLE_CONTROL_SIZES` | `src/tokens/apple.ts` | All layout spacing, corner radii, dimensions | Phase 20 tokens |
| `IntersectionObserver` | Browser native API | Section virtualization (no library needed) | Chrome 51+, Safari 12.1+ — covers all target browsers |
| `GlassProvider` `backgroundMode` prop | in-repo | Wallpaper / noise toggle from showcase | Already accepts `'image' | 'noise'`; state needs to lift to App.tsx |

### Supporting (design conventions)

| Convention | Value | Purpose |
|------------|-------|---------|
| System font stack | `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` | Apple-authentic typography without licensing issues |
| Page max-width | `1200px` with `margin: 0 auto` | Desktop-comfortable reading width |
| Section vertical rhythm | `120px` between sections | Breathing room, matches Apple product page cadence |
| Hero height | `100vh` minimum | Full-screen hero above fold |
| Sticky header height | `60px` | Compact; scroll-sticky with glass background |

### No New Dependencies

This phase requires zero new npm packages. All animation, accessibility, and glass capabilities are already installed. The `IntersectionObserver` API is browser-native. React Router is explicitly out of scope (REQUIREMENTS.md, Out of Scope section).

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── showcase/                      # NEW: app-level code, NOT exported from index.ts
│   ├── ShowcasePage.tsx           # Top-level shell: sticky header, sections, TuningDrawer
│   ├── TuningDrawer.tsx           # CSS-transform slide-in wrapping existing tuning UI
│   ├── VirtualSection.tsx         # IntersectionObserver wrapper — mounts children near viewport
│   ├── sections/
│   │   ├── HeroSection.tsx        # Full-screen hero: headline, tagline, CTA buttons
│   │   ├── InteractiveSection.tsx # GlassToggle + GlassSlider + GlassSegmentedControl demo
│   │   ├── NavigationSection.tsx  # GlassTabBar + GlassNavigationBar + GlassToolbar + GlassSearchBar
│   │   ├── OverlaySection.tsx     # GlassActionSheet + GlassAlert + GlassSheet + GlassPopover triggers
│   │   ├── FormSection.tsx        # GlassChip + GlassStepper + GlassInput in a mock settings form
│   │   └── DeveloperSection.tsx   # Install command, GitHub link, brief API snippet
│   └── WallpaperSelector.tsx      # GlassSegmentedControl or GlassChip group for bg switching
│
├── App.tsx                        # MODIFIED: lifts backgroundMode state; mounts ShowcasePage
└── (everything else unchanged)
```

### Pattern 1: VirtualSection — IntersectionObserver Gate

**What:** A `<VirtualSection>` wrapper that tracks viewport proximity with `IntersectionObserver`. When the section enters within `rootMargin: "100% 0px"` (one viewport above and below), `isNear` becomes `true` and children mount. When the section scrolls two viewports away, `isNear` becomes `false` and children unmount (releasing all their GPU regions via `useGlassRegion` cleanup).

**When to use:** Every showcase section that contains glass controls. The `<HeroSection>` is always visible and can be mounted unconditionally, but all other sections should use `VirtualSection`.

**Why it works for region cleanup:** `useGlassRegion` registers a cleanup in `useEffect` return that calls `handle.remove()` and `ctx.unregisterRegion(handle.id)`. When React unmounts a control, this runs automatically. No manual region cleanup needed in the showcase.

**Example:**
```typescript
// Source: IntersectionObserver MDN + project GlassRenderer.ts region budget
function VirtualSection({ children, id }: { children: React.ReactNode; id: string }) {
  const [isNear, setIsNear] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsNear(entry.isIntersecting),
      { rootMargin: '100% 0px' }   // mount one viewport before visible
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <section id={id}>
      <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
      {isNear ? children : <div style={{ minHeight: '400px' }} aria-hidden="true" />}
    </section>
  );
}
```

**Critical detail:** The placeholder `<div>` with `minHeight` prevents layout shift (scroll jump) when children mount. Its height should approximate the section's rendered height.

### Pattern 2: TuningDrawer — Always-Mounted CSS Transform Panel

**What:** `TuningDrawer` wraps the existing tuning UI in a fixed-position right-side panel. It is always mounted (never conditionally rendered). Visibility is controlled by `transform: translateX(0%)` (open) vs `transform: translateX(100%)` (closed). A CSS `transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)` provides the slide animation without a JS animation library.

**When to use:** The single TuningDrawer instance in ShowcasePage. Always-mounted to preserve tuning slider state across open/close cycles.

**Why not use motion for the drawer animation:** CSS transitions are sufficient and avoid adding a motion `animate` dependency that could fight with `useGlassRegion`'s morph lerp on the panel glass region (if the drawer panel has a glass background).

**Example:**
```typescript
// Source: Architecture research ARCHITECTURE.md — TuningDrawer always-mounted pattern
function TuningDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      width: 380,
      zIndex: 200,
      transform: open ? 'translateX(0%)' : 'translateX(100%)',
      transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
      overflowY: 'auto',
    }}>
      {/* Existing tuning UI component goes here — unchanged */}
      <ExistingTuningPage onClose={onClose} />
    </div>
  );
}
```

**Important:** The tuning UI components (sliders, preset buttons, etc.) that currently exist in `App.tsx` or a dedicated tuning page file are moved inside the drawer shell — not rewritten or deleted.

### Pattern 3: Wallpaper Selector — Lifted backgroundMode State

**What:** `backgroundMode` state moves from inside `GlassProvider`'s own init (currently hardcoded-ish via its prop default) up to `App.tsx`. `App.tsx` passes the state value to `GlassProvider` and passes `setBackgroundMode` down to `ShowcasePage` via prop. The selector inside the showcase (a `GlassSegmentedControl` or `GlassChip` group) calls `setBackgroundMode`.

**Current wiring:** `GlassProvider` already accepts `backgroundMode?: 'image' | 'noise'` and internally calls `module.setBackgroundMode(backgroundMode === 'image' ? 0 : 1)` in a `useEffect` keyed to `backgroundMode`. This means simply changing the prop triggers the background switch. No engine API changes needed.

**Example wiring in App.tsx:**
```typescript
// Source: src/components/GlassProvider.tsx — backgroundMode prop already supported
export default function App() {
  const [backgroundMode, setBackgroundMode] = useState<'image' | 'noise'>('image');
  return (
    <GlassProvider backgroundMode={backgroundMode}>
      <ShowcasePage
        backgroundMode={backgroundMode}
        onBackgroundModeChange={setBackgroundMode}
      />
    </GlassProvider>
  );
}
```

### Pattern 4: Section-Based Information Architecture

**What:** The showcase page is NOT a component grid. It is a product landing page organized around a narrative. Each section answers one question and uses glass controls as the evidence, not as the subject.

**Proposed section order:**

| Section | Narrative purpose | GPU regions budget (approx) | Primary controls shown |
|---------|------------------|------------------------------|------------------------|
| `HeroSection` | "What is this?" — headline, tagline, one CTA | ~3 (panel + 2 buttons) | GlassPanel, GlassButton |
| `InteractiveSection` | "Why does it feel alive?" — toggle, slider, segmented in a mock settings card | ~6 (toggle track+thumb, slider track, segmented) | GlassToggle, GlassSlider, GlassSegmentedControl |
| `NavigationSection` | "Can it do real app UI?" — a mock app frame | ~4 (nav bar + tab bar bars) | GlassNavigationBar, GlassTabBar, GlassToolbar, GlassSearchBar |
| `OverlaySection` | "What about modals?" — trigger buttons + overlay demos | ~3 at rest, +2 when overlay open | GlassActionSheet, GlassAlert, GlassSheet, GlassPopover |
| `FormSection` | "Complete the palette" — mock form | ~6 (chips + stepper + input) | GlassChip, GlassStepper, GlassInput |
| `DeveloperSection` | "How do I use it?" — install command, API snippet | ~1 (code card panel) | None (static content) |

**Total active regions at any scroll position (with virtualization):** At most 2 adjacent sections are near-mounted simultaneously. Max ~12 regions active — well within `MAX_GLASS_REGIONS = 32`.

### Anti-Patterns to Avoid

- **Kitchen sink layout:** A grid of all control variants labeled with prop names. The showcase section descriptions above are contextual scenarios (settings card, app frame, form), not component catalogs. Each section has a realistic use case framing.
- **Mounting all sections unconditionally:** Without `VirtualSection`, page load mounts ~32+ glass regions. Use `VirtualSection` on every section except `HeroSection`.
- **Deleting the existing tuning UI:** The tuning components are wrapped in `TuningDrawer`, not deleted. The `npm run tune` auto-tuner depends on them.
- **Using `visibility: hidden` or `opacity: 0` to hide off-screen sections:** Only `display: none` (via conditional rendering / unmounting) triggers the `useGlassRegion` cleanup that releases GPU regions. Hidden-but-mounted components still hold regions.
- **CSS transitions on glass-managed properties:** Do not apply `transition` to `border-radius`, `opacity`, or other properties managed by `useGlassRegion`'s morph lerp — they will fight and produce oscillation.
- **Routing the showcase:** No `react-router-dom`. Anchor-based in-page navigation only (`href="#interactive-section"`, `scroll-margin-top` CSS for sticky header offset).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Section near-viewport detection | Custom scroll event throttling | `IntersectionObserver` with `rootMargin` | Browser-native, fires off main thread, zero CPU at rest, no scroll jitter |
| Drawer slide animation | JS `requestAnimationFrame` interpolation | CSS `transition: transform` | Simple, jank-free, does not fight morph lerp, works with `prefers-reduced-motion` via `@media` |
| Smooth section scroll navigation | Manual `window.scrollTo` with lerp | `element.scrollIntoView({ behavior: 'smooth' })` | Browser-native smooth scroll, respects `prefers-reduced-motion` automatically |
| Focus management in drawer | Custom focus trap | Not needed — the drawer is not a modal; it does not trap focus | Drawer is a side panel with a close button; focus trapping is for dialogs only |
| Copy-to-clipboard for install command | None | `navigator.clipboard.writeText()` | One-liner; no library needed |

**Key insight:** Phase 25 has no new infrastructure problems to solve. Every technical capability is already installed or browser-native. The hard work is design quality — the information architecture, visual hierarchy, and narrative flow.

---

## Common Pitfalls

### Pitfall 1: Kitchen Sink Showcase

**What goes wrong:** The page accumulates controls incrementally — add a toggle demo, add a slider demo, add a segmented control demo — without a design narrative. Result: a component grid that looks exactly like the old tuning page but with more controls.

**Why it happens:** Developers build section-by-section without stepping back to see the whole page. No IA document means no check against "does this look like a product page or a Storybook?"

**How to avoid:** Define the section order and the narrative sentence for each section BEFORE writing any JSX. Each section should have a one-sentence description of what a first-time visitor learns from it. If the sentence is "here are all the toggle variants," the section is wrong. If it's "here's how these controls look in a real settings screen," it's right.

**Warning signs:** Any section contains a label that reads like a prop name (`checked={true}`, `disabled variant`, `small size`). Those belong in documentation, not the showcase.

### Pitfall 2: Exceeding GPU Region Budget

**What goes wrong:** Without `VirtualSection`, all sections mount at page load. A full showcase with 6 sections × ~5 glass regions each = ~30 regions at page load, approaching the `MAX_GLASS_REGIONS = 32` cap. Adding an overlay control pushes past the cap.

**Why it happens:** Works fine during development (one section focused on at a time, others collapsed). Breaks on first full-page load test when all sections render.

**How to avoid:** Use `VirtualSection` on every section except HeroSection. After implementing, verify with a debug log: add `console.log('regions:', renderer.regions.size)` temporarily to `GlassRenderer.render()` and confirm the count never exceeds 20 during normal showcase scrolling.

**Warning signs:** A section in the middle of the page has controls that render without glass effect (no blur, no refraction) — this is the silent corruption symptom of exceeding `MAX_GLASS_REGIONS`.

### Pitfall 3: Wallpaper State Wiring Scope Creep

**What goes wrong:** `backgroundMode` state placed inside `ShowcasePage` (or lower) but `GlassProvider` is mounted above `ShowcasePage` in `App.tsx`. The wallpaper selector cannot reach the provider's prop.

**Why it happens:** `GlassProvider` is the root; its `backgroundMode` prop must be driven from outside. Placing the state below the provider means it cannot bubble up to affect the prop.

**How to avoid:** State lives in `App.tsx`. `ShowcasePage` receives `backgroundMode` and `onBackgroundModeChange` as props and passes them down to `WallpaperSelector`. This is the only correct data flow — `GlassProvider` already handles the prop reactively via `useEffect`.

**Warning signs:** Changing the wallpaper selector does not change the background. Check whether `backgroundMode` prop on `GlassProvider` is actually changing when the selector fires.

### Pitfall 4: Showcase Demo Values Breaking on Background Switch

**What goes wrong:** v3.0 glass parameters are tuned for the bundled wallpaper. When the user switches to noise mode, all controls look different (too heavy or too light) because the tuned parameter values were optimized for the image background.

**Why it happens:** Noise backgrounds have different frequency spectra than natural photos. The blur/refraction/specular values that look correct on a wallpaper may look over-saturated or muddy on a noise background.

**How to avoid:** After implementing wallpaper switching, do a visual check of all showcase sections in both `image` and `noise` modes. The TuningDrawer is available from the showcase for live parameter adjustment — use it to verify each section. This is not a code fix; it is a design tuning step.

**Warning signs:** A control that looks great in the hero section on the wallpaper looks washed out or cartoonishly heavy in noise mode.

### Pitfall 5: Layout Shift from VirtualSection Placeholder Height

**What goes wrong:** When a section unmounts (off-screen), the placeholder `<div>` collapses to height 0 (or whatever default is used). When the user scrolls back and the section remounts, the page height changes suddenly, causing a scroll jump.

**Why it happens:** The placeholder height must match the section's rendered height to prevent Cumulative Layout Shift. If the placeholder is `height: 0` or `minHeight` is wrong, scroll position jumps when sections mount.

**How to avoid:** Give each section's `VirtualSection` a `minHeight` prop set to the section's approximate rendered height (measure once in development). For example, `NavigationSection` ~ `600px`, `OverlaySection` ~ `500px`. These values do not need to be pixel-perfect — within 50px is sufficient to prevent noticeable jump.

---

## Code Examples

### VirtualSection Hook Pattern

```typescript
// Source: IntersectionObserver MDN API — browser native, no library
// Usage: Wrap each showcase section to gate glass control mounting
import { useState, useEffect, useRef } from 'react';

export function useNearViewport(rootMargin = '100% 0px'): {
  ref: React.RefObject<HTMLDivElement>;
  isNear: boolean;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [isNear, setIsNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsNear(entry.isIntersecting),
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return { ref, isNear };
}
```

### TuningDrawer Integration in ShowcasePage

```typescript
// Source: Architecture research — always-mounted pattern for state preservation
function ShowcasePage({ backgroundMode, onBackgroundModeChange }) {
  const [tuningOpen, setTuningOpen] = useState(false);

  return (
    <>
      <StickyHeader onTuningToggle={() => setTuningOpen(o => !o)} />
      <main>
        <HeroSection backgroundMode={backgroundMode} onBackgroundModeChange={onBackgroundModeChange} />
        <VirtualSection id="interactive" minHeight={500}>
          <InteractiveSection />
        </VirtualSection>
        {/* ... other virtual sections ... */}
      </main>
      {/* Always mounted — never conditionally render */}
      <TuningDrawer open={tuningOpen} onClose={() => setTuningOpen(false)} />
    </>
  );
}
```

### Anchor Navigation (No Router)

```typescript
// Source: Architecture research — anchor scroll pattern
// Section elements use id attributes; header links use href="#section-id"
// CSS scroll-margin-top accounts for sticky header height

// In StickyHeader:
<nav>
  <a href="#interactive" onClick={(e) => {
    e.preventDefault();
    document.getElementById('interactive')?.scrollIntoView({ behavior: 'smooth' });
  }}>Controls</a>
</nav>

// In CSS (or inline styles):
// section { scroll-margin-top: 72px; }  // 60px header + 12px breathing room
```

### Wallpaper Selector with GlassSegmentedControl

```typescript
// Source: GlassProvider.tsx backgroundMode prop + GlassSegmentedControl from Phase 21
// WallpaperSelector is a GlassSegmentedControl or two GlassChip components
import { GlassSegmentedControl } from '../components/controls';

function WallpaperSelector({ value, onChange }) {
  return (
    <GlassSegmentedControl
      segments={[
        { label: 'Wallpaper', value: 'image' },
        { label: 'Noise', value: 'noise' },
      ]}
      value={value}
      onChange={onChange}
    />
  );
}
```

---

## Showcase Information Architecture

This section documents the required IA for a passing showcase (prevents C8 kitchen-sink failure).

### Section Order and Narrative Contract

Each section must answer exactly one question. If a designer can describe what the section is "about" in one sentence that does NOT include control names or prop values, the IA is correct.

| # | Section | One-Sentence Purpose | Visitor Takeaway |
|---|---------|---------------------|------------------|
| 0 | `StickyHeader` | Permanent navigation with wallpaper toggle and tuning access | "I can navigate and tune from anywhere" |
| 1 | `HeroSection` | "This is Apple Liquid Glass — the real GPU effect, in React" | First impression; establishes visual quality bar |
| 2 | `InteractiveSection` | "The controls feel alive — physics, spring, glass lens" | Differentiates from CSS glassmorphism |
| 3 | `NavigationSection` | "Full iOS navigation patterns, ready to use" | Completeness signal for app developers |
| 4 | `OverlaySection` | "Even modals feel fluid — the morph animation is why" | The highest-impact demo (ActionSheet morph) |
| 5 | `FormSection` | "The complete control palette for any form or settings screen" | Breadth signal for library evaluators |
| 6 | `DeveloperSection` | "Start in 5 minutes — one npm install, one provider" | Conversion: evaluator → adopter |

### Hero Section Requirements

The hero must NOT be a component demo. It must communicate what the library IS:
- Headline: Describes the value proposition ("Apple Liquid Glass for React")
- Tagline: Single sentence on differentiation ("WebGPU-powered refraction, not CSS blur")
- Background: The live glass effect — the canvas is already rendering, the hero IS the demo
- CTA: Primary ("View on GitHub"), Secondary ("Explore controls" → smooth scroll to InteractiveSection)
- Wallpaper selector: In hero or sticky header

### Developer Section Requirements

Must include:
- npm install command with copy button
- Minimal code example (4-6 lines showing `<GlassProvider>` + one control)
- GitHub link (prominent)
- Browser compatibility note ("WebGPU: Chrome 113+, Edge 113+, Safari 18+")

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Tuning page as the main landing (App.tsx static demo) | ShowcasePage as product landing page | SHOW-01 replacement |
| backgroundMode hardcoded in GlassProvider default | backgroundMode lifted to App.tsx state | Required for SHOW-04 wallpaper selector |
| No GPU region virtualization (works at 3 controls) | IntersectionObserver VirtualSection (required at 30+ controls) | SHOW-03 requirement |
| No access to tuning from main page | TuningDrawer slide-in from showcase | SHOW-02 requirement |

**GlassProvider already supports:** `backgroundMode='image' | 'noise'` prop with reactive `useEffect` — the engine call `module.setBackgroundMode()` fires on every prop change. No engine API changes needed for the wallpaper selector.

**MAX_GLASS_REGIONS is already 32** (confirmed: `GlassRenderer.ts` line 10: `export const MAX_GLASS_REGIONS = 32`). Phase 20 already raised it from 16. The showcase can safely have up to 32 simultaneous regions.

---

## Open Questions

1. **Which existing file contains the current tuning UI?**
   - What we know: App.tsx currently shows a simple GlassPanel/GlassButton demo, not the full tuning page. The full tuning controls (sliders for blur/specular/rim/etc.) exist somewhere from Phase 19 work.
   - What's unclear: The exact file path for the v3.0 tuning page component that `TuningDrawer` will wrap.
   - Recommendation: Before building `TuningDrawer`, read the Phase 19 plans and locate the tuning UI component. It may be in `src/showcase/TuningPage.tsx` or similar from the Phase 19 "Tuning Page Redesign." The planner should add a task to locate this file as Wave 0.

2. **Exact section heights for VirtualSection placeholder minHeight**
   - What we know: Sections need a placeholder height to prevent scroll jump when they unmount.
   - What's unclear: Exact rendered heights — depends on control dimensions, responsive layout.
   - Recommendation: Implement VirtualSection with a `minHeight` prop. Use generous defaults (400px–600px) in Wave 1 and tune after sections are implemented in Wave 2-3.

3. **GlassSegmentedControl signature for WallpaperSelector**
   - What we know: GlassSegmentedControl exists in `src/components/controls/GlassSegmentedControl.tsx` (Phase 21). It uses `value`/`onChange` controlled pattern.
   - What's unclear: Whether its `segments` prop accepts objects `{ label, value }` or just string labels. Check Phase 21 types before wiring.
   - Recommendation: Planner should include a task to read `GlassSegmentedControl` types before implementing `WallpaperSelector`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.1 (unit) + Playwright ^1.58.2 (e2e) |
| Config file | `vitest.config.ts` (root) — includes `src/**/__tests__/**/*.test.{ts,tsx}` |
| Quick run command | `npm run test` (vitest run --reporter=verbose) |
| Full suite command | `npm run test && npm run test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHOW-01 | App renders ShowcasePage (not tuning UI) as default view | unit (smoke) | `npm run test` | ❌ Wave 0 |
| SHOW-01 | ShowcasePage has hero section, control sections, developer section | Playwright e2e | `npm run test:e2e` | ❌ Wave 0 |
| SHOW-02 | TuningDrawer is hidden on load; toggle button opens it | unit | `npm run test` | ❌ Wave 0 |
| SHOW-02 | TuningDrawer closing preserves slider positions | manual-only | — | N/A — state preservation requires visual check |
| SHOW-03 | Sections below fold are not mounted on page load | unit | `npm run test` | ❌ Wave 0 |
| SHOW-03 | GPU region count does not exceed MAX at any scroll position | Playwright e2e (with console log spy) | `npm run test:e2e` | ❌ Wave 0 |
| SHOW-04 | Switching wallpaper selector changes backgroundMode prop | unit | `npm run test` | ❌ Wave 0 |
| SHOW-04 | All glass controls render visibly in both image and noise modes | Playwright screenshot | `npm run test:e2e` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run test` (unit suite, ~5s)
- **Per wave merge:** `npm run test && npm run test:e2e`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/showcase/__tests__/ShowcasePage.test.tsx` — SHOW-01 smoke test (renders without crash, has expected section IDs)
- [ ] `src/showcase/__tests__/TuningDrawer.test.tsx` — SHOW-02 visibility toggle test
- [ ] `src/showcase/__tests__/VirtualSection.test.tsx` — SHOW-03 IntersectionObserver mounting gate
- [ ] `tests/showcase.spec.ts` (Playwright) — SHOW-01 full page structure, SHOW-03 region budget check, SHOW-04 wallpaper switch visual diff

---

## Sources

### Primary (HIGH confidence)

- `src/renderer/GlassRenderer.ts` line 10 — `MAX_GLASS_REGIONS = 32` (Phase 20 raised from 16); `UNIFORM_STRIDE = 256` — direct codebase read
- `src/components/GlassProvider.tsx` lines 208-213 — `backgroundMode` prop reactive `useEffect` calling `module.setBackgroundMode()` — confirms wallpaper selector requires only prop state lift to App.tsx
- `src/components/controls/index.ts` — confirms GlassToggle, GlassSlider, GlassSegmentedControl, GlassChip, GlassStepper, GlassInput are all exported (Phases 21-22 complete)
- `src/index.ts` — confirms all Phase 20-22 controls are exported from library barrel
- `src/tokens/apple.ts` — APPLE_SPACING, APPLE_RADII, APPLE_CONTROL_SIZES all defined; available for showcase layout
- `src/components/GlassEffectContainer.tsx` — GlassEffectContainer shipped (Phase 20); `animate` prop wraps children in AnimatePresence
- `.planning/research/ARCHITECTURE.md` — Section-Based Showcase Layout pattern (Pattern 4), TuningDrawer always-mounted pattern (Pattern 5), Section state model
- `.planning/research/PITFALLS.md` — C7 (performance budget), C8 (kitchen sink IA), C5 (cognitive overload), Anti-Pattern 3 (mounting all sections), Anti-Pattern 5 (deleting tuning page)
- `package.json` `test` script — `vitest run`; `test:e2e` — `playwright test`
- `vitest.config.ts` — `include: ['src/**/__tests__/**/*.test.{ts,tsx}']`, `environment: 'node'`
- REQUIREMENTS.md Out of Scope — React Router explicitly excluded; single-page anchor navigation confirmed

### Secondary (MEDIUM confidence)

- MDN IntersectionObserver API — `rootMargin`, `isIntersecting`, observer cleanup pattern — well-established browser API
- Apple product page design conventions — hero → features → social proof → developer CTA — standard pattern for developer-facing product pages
- `.planning/research/FEATURES.md` — Feature landscape section "Showcase Phase" launch controls list

### Tertiary (LOW confidence)

- Section height estimates (400-600px placeholder minHeight) — estimated from typical control cluster layouts; must be calibrated after sections are implemented

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies already installed; GlassProvider backgroundMode prop verified from source; MAX_GLASS_REGIONS = 32 confirmed from source
- Architecture: HIGH — VirtualSection pattern from browser-native IntersectionObserver (MDN); TuningDrawer pattern from architecture research; wallpaper wiring from GlassProvider source
- IA / design: MEDIUM — product landing page conventions are established but the exact visual design requires designer judgment; section order is a recommendation not a spec
- Pitfalls: HIGH — GPU budget from direct source read; kitchen-sink failure mode from architecture research and prior planning research

**Research date:** 2026-03-25
**Valid until:** 2026-05-25 (stable stack, 60 days)

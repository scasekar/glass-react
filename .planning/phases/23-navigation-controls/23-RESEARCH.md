# Phase 23: Navigation Controls - Research

**Researched:** 2026-03-25
**Domain:** Apple Liquid Glass navigation surfaces — GlassTabBar, GlassNavigationBar, GlassToolbar, GlassSearchBar
**Confidence:** HIGH (architecture from live codebase; Apple HIG specs from WWDC25 official sessions; dimension values from community reference implementations at MEDIUM confidence)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NAV-01 | GlassTabBar renders bottom tab bar with glass background and active tab indicator | Full-width GlassPanel bar; active item uses tinted GlassButton; scroll-minimize via ResizeObserver/scroll handler; item cluster grouping via GlassEffectContainer; APPLE_SPACING tokens for item gap |
| NAV-02 | GlassNavigationBar renders top navigation bar with glass background, title, and back action | Full-width GlassPanel bar; back button is GlassButton; title is a styled text node; button clusters use GlassEffectContainer per group; bold left-aligned typography; APPLE_RADII tokens for button corner radii |
| NAV-03 | GlassToolbar renders action toolbar with glass background and icon buttons | Full-width GlassPanel bar; each icon action is a GlassButton; clusters share GlassEffectContainer; primary action uses refractionMode="prominent" tinted style; APPLE_SPACING tokens for item gap |
| NAV-04 | GlassSearchBar renders search field with glass background and clear/cancel actions | GlassPanel capsule wrapping native `<input>`; inactive/active state machine; clear button (GlassButton) visible when non-empty; cancel GlassButton animates in on focus; keyboard dismiss on cancel; APPLE_RADII.pill for capsule shape |
</phase_requirements>

---

## Summary

Phase 23 builds the four Apple navigation surface controls — GlassTabBar, GlassNavigationBar, GlassToolbar, and GlassSearchBar — on top of the fully-shipped Phase 20 foundation and the compositional patterns established in Phase 21/22 plans. These are not widget controls (toggle, slider) — they are full-width bars that float above content at fixed positions. Each is a structural layout element composed of GlassPanel (the bar surface) plus GlassButton instances (the action items within). The critical architectural difference from Phase 21/22 controls is that navigation surfaces span the full viewport width, use `position: fixed` or `position: sticky`, and contain multiple GlassButton children that share a GlassEffectContainer for visual cluster grouping.

All dependencies are already installed. `motion` provides the animation for tab bar minimize/expand and search bar cancel button entrance. `@radix-ui/react-toggle-group` provides tab bar ARIA patterns (roving tabindex, `aria-selected`, `role="tablist"`). The GlassEffectContainer (Phase 20) provides shared morph-ID namespacing for button clusters within nav and toolbar. The GPU region budget is the primary sizing constraint: each navigation bar contributes 1 region for the bar surface plus N regions for button children. A composition rule — do not put each individual icon button in a nav bar into its own GlassButton — must be applied carefully. Toolbar and nav bar items that are clustered together should share one GlassEffectContainer; each cluster registers as a small number of independent buttons.

GlassSearchBar is the most interaction-rich control in this phase: it has a meaningful state machine (inactive → focused → typing → has-value → cancelled) and involves animation (cancel button slides in, clear button appears). GlassTabBar's scroll-minimize behavior requires DOM scroll integration, which is a React concern rather than a shader concern. GlassNavigationBar and GlassToolbar are structurally similar and can share implementation patterns.

**Primary recommendation:** Build GlassNavigationBar and GlassToolbar together as Wave 1 (shared bar pattern, button clusters), then GlassSearchBar as Wave 2 (input state machine), then GlassTabBar as Wave 3 (scroll-minimize scroll integration, roving tabindex). Export all four from `src/components/controls/index.ts` and from `src/index.ts`.

---

## Standard Stack

### Core (all already installed in package.json — Phase 20)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `motion` | ^12.38.0 | Tab bar minimize/expand animation; search bar cancel entrance | `animate()` for height/opacity spring; `useReducedMotion()` for a11y |
| `@radix-ui/react-toggle-group` | ^1.1.11 | GlassTabBar ARIA tablist pattern — roving tabindex, `aria-selected`, keyboard navigation | Already installed; single-select toggle group maps directly to tab bar semantics |
| `GlassPanel` | in-repo | Full-width bar glass surface | Composes `useGlassRegion`; auto-applies `reducedTransparency` guard |
| `GlassButton` | in-repo | Tab items, nav bar buttons, toolbar actions, search clear/cancel | Composes `useGlassRegion`; hover/active morph built in |
| `GlassEffectContainer` | in-repo | Button cluster grouping within bars | Provides shared morph-ID namespace; no GPU region of its own |
| `APPLE_SPACING` | `src/tokens/apple.ts` | Bar padding, item gap | `APPLE_SPACING.md` (16px) for bar padding; `APPLE_SPACING.sm` (8px) for icon gap |
| `APPLE_RADII` | `src/tokens/apple.ts` | Button corner radii, search capsule | `APPLE_RADII.pill` for search bar; `APPLE_RADII.md` (14) for nav/toolbar buttons |
| `APPLE_CONTROL_SIZES` | `src/tokens/apple.ts` | `minTapTarget` (44px) for all interactive items | Accessibility minimum touch target |

### Navigation Bar Dimensions (MEDIUM confidence — community reference)

| Control | Dimension | Value | Source |
|---------|-----------|-------|--------|
| GlassTabBar | height | ~49px standard, ~83px with home indicator inset | iOS HIG (community ref) |
| GlassTabBar | icon size | ~25px | Community reference |
| GlassTabBar | item min-width | 44px (minTapTarget) | Apple HIG (HIGH) |
| GlassNavigationBar | height | ~44px + status bar | iOS HIG (community ref) |
| GlassNavigationBar | title font | 17px semibold (`.headline`) | WWDC25 session 284 (HIGH) |
| GlassNavigationBar | back icon | `‹` chevron, 17px | Convention |
| GlassToolbar | height | ~44px | Same as nav bar (HIGH) |
| GlassSearchBar | height | ~36px (capsule) | Community reference (MEDIUM) |
| GlassSearchBar | icon size | ~16px magnifier | Convention |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@radix-ui/react-toggle-group` for tab bar | Custom `role="tablist"` + keyboard handler | Radix handles arrow key navigation, roving tabindex, and selection correctly; building from scratch adds scope |
| `position: fixed` bars | `position: sticky` | Fixed is correct for bars that always stay at top/bottom regardless of scroll; sticky follows scroll containers and is not appropriate for viewport-level nav bars |
| GlassPanel for full bar surface | Multiple GlassButton children without wrapper | The bar itself needs glass rendering (background blur); individual buttons add hover interaction; both layers are needed |

**Installation:** Nothing to install — all dependencies installed in Phase 20.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   └── controls/
│       ├── types.ts                        # MODIFIED: add NAV prop interfaces
│       ├── GlassTabBar.tsx                 # NAV-01
│       ├── GlassNavigationBar.tsx          # NAV-02
│       ├── GlassToolbar.tsx                # NAV-03
│       ├── GlassSearchBar.tsx              # NAV-04
│       ├── index.ts                        # MODIFIED: add NAV exports
│       └── __tests__/
│           ├── GlassTabBar.test.tsx
│           ├── GlassNavigationBar.test.tsx
│           ├── GlassToolbar.test.tsx
│           └── GlassSearchBar.test.tsx
└── index.ts                                # MODIFIED: re-export NAV controls
```

### Pattern 1: Glass Bar Surface — Full-Width Fixed Panel

**What:** Every navigation surface is a `GlassPanel` that spans the viewport width, positioned fixed (top or bottom), with a height derived from Apple HIG dimensions. Child items are GlassButton instances. The bar contributes 1 GPU region; each distinct interactive button group contributes additional regions.

**When to use:** GlassTabBar, GlassNavigationBar, GlassToolbar. All follow this pattern.

**GPU region accounting:**
- GlassTabBar: 1 (bar) + N (active item, treated as one GlassButton) = 2 total minimum
- GlassNavigationBar: 1 (bar) + 1 (back button cluster) + 1 (actions cluster) = 3 total
- GlassToolbar: 1 (bar) + 1 per button cluster = 2–4 total
- GlassSearchBar: 1 (capsule container) + 1 (cancel button, conditionally mounted) = 2 total

**Example (GlassNavigationBar skeleton):**
```typescript
// Source: composition pattern from ARCHITECTURE.md + GlassButton.tsx
export function GlassNavigationBar({
  title, onBack, actions, style,
}: GlassNavigationBarProps) {
  return (
    <GlassPanel
      cornerRadius={0}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: 44,
        display: 'flex', alignItems: 'center',
        paddingLeft: APPLE_SPACING.md, paddingRight: APPLE_SPACING.md,
        zIndex: 100,
        ...style,
      }}
    >
      {/* Back button cluster */}
      {onBack && (
        <GlassEffectContainer id="navbar-back">
          <GlassButton
            cornerRadius={APPLE_RADII.md}
            style={{ minWidth: APPLE_CONTROL_SIZES.minTapTarget, height: APPLE_CONTROL_SIZES.minTapTarget }}
            onClick={onBack}
            aria-label="Back"
          >
            ‹
          </GlassButton>
        </GlassEffectContainer>
      )}
      {/* Title */}
      <span style={{ flex: 1, textAlign: 'left', fontWeight: 600, fontSize: 17, paddingLeft: APPLE_SPACING.sm }}>
        {title}
      </span>
      {/* Actions cluster */}
      {actions && (
        <GlassEffectContainer id="navbar-actions">
          {actions}
        </GlassEffectContainer>
      )}
    </GlassPanel>
  );
}
```

### Pattern 2: GlassTabBar — Roving Tabindex via Radix Toggle Group

**What:** Tab bar uses `@radix-ui/react-toggle-group` for `role="tablist"`, `aria-selected`, and arrow key navigation. The selected item is visually distinguished via a tinted GlassButton. Scroll-minimize behavior tracks scroll events and animates bar height using `motion`'s `animate()`.

**When to use:** GlassTabBar only — the only navigation surface that uses the tablist pattern.

**Key ARIA mapping:**
- `ToggleGroup.Root` → `role="tablist"` (via Radix)
- `ToggleGroup.Item` → `role="tab"`, `aria-selected` (via Radix)
- Associated content panel → `role="tabpanel"`, `aria-labelledby`

**Scroll-minimize integration:**
```typescript
// Source: ARCHITECTURE.md + FEATURES.md GlassTabBar specification
const [minimized, setMinimized] = useState(false);
const lastScrollY = useRef(0);

useEffect(() => {
  const onScroll = () => {
    const currentY = window.scrollY;
    if (currentY > lastScrollY.current && currentY > 50) {
      setMinimized(true);  // scroll down → minimize
    } else {
      setMinimized(false); // scroll up → expand
    }
    lastScrollY.current = currentY;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  return () => window.removeEventListener('scroll', onScroll);
}, []);
```

**Animation pattern (minimized ↔ expanded):**
```typescript
// Source: motion/react docs — useReducedMotion for a11y
const reducedMotion = useReducedMotion();
// height: minimized ? 49 : 83 (icon-only vs icon+label)
// When reducedMotion: instant snap, no spring
```

**Tab item active tinting:** The active tab item uses `refractionMode="prominent"` on its GlassButton to produce the tinted prominent style. All other tab items use the default `.glass` (translucent) style.

### Pattern 3: GlassSearchBar — Input State Machine

**What:** GlassSearchBar has a 4-state machine: `idle → focused → typing → cancelled`. The outer capsule is a GlassPanel. The inner `<input>` is a native element (not a separate glass region). The cancel button is conditionally mounted (via React state) and animates in from the right using `motion`. The clear button (×) appears when value is non-empty.

**State machine:**
```
idle ──onFocus──> focused ──onInput──> typing
typing ──onClear──> focused
typing / focused ──onCancel──> idle (clears value, blurs input)
```

**Focus state glass enhancement:** On focus, the GlassPanel's `specular` and `rim` props increase to give visual feedback — following the exact pattern used by GlassInput (Phase 22). This ensures consistent focus affordance across all glass input surfaces.

**Cancel button entrance animation:**
```typescript
// Source: motion/react docs — AnimatePresence + initial/animate/exit
{focused && (
  <motion.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 20 }}
    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
  >
    <GlassButton cornerRadius={APPLE_RADII.md} onClick={onCancel}>
      Cancel
    </GlassButton>
  </motion.div>
)}
```

**AnimatePresence context:** GlassSearchBar should be wrapped in `GlassEffectContainer` (provides `AnimatePresence` context via `animate` prop) OR wrap the cancel button in its own `<AnimatePresence>` locally. Since search bars are standalone, local `<AnimatePresence>` is simpler.

### Pattern 4: Button Cluster Grouping

**What:** Navigation bars and toolbars group related buttons into visual clusters using `GlassEffectContainer`. Each cluster has its own container; buttons within a cluster share the `containerId` for `layoutId` coordination. The containers sit adjacent to each other inside the main bar GlassPanel.

**When to use:** Any time two or more adjacent GlassButtons in a navigation surface should visually "cluster" — appear to share a glass background as a group.

**Anti-pattern:** Giving every individual icon button its own top-level glass region. Each GlassButton already registers 1 region. A toolbar with 5 individual buttons = 5 additional regions (+ 1 for the bar) = 6 total just for the toolbar. Keep clusters to ≤ 3 buttons each; nest multiple clusters in separate GlassEffectContainers rather than one flat list of standalone buttons.

### Anti-Patterns to Avoid

- **Fixed position without `zIndex` management:** Navigation bars at `position: fixed` must have appropriate `zIndex` (100–200 range) to float above content. Without it, content scrolls over the glass bar, which looks correct but breaks click targets.
- **Tab bar items with their own `cornerRadius` set to 0:** Tab items inside the bar must preserve their individual corner radii for glass rendering. The bar itself uses `cornerRadius={0}` but child GlassButtons keep `cornerRadius={APPLE_RADII.md}` or `APPLE_RADII.pill`.
- **Search bar registering `<input>` as a glass region:** The native `<input>` element must NOT call `useGlassRegion` or be wrapped in a separate GlassPanel. Only the outer capsule GlassPanel registers a region. Inner `<input>` is unstyled and positioned over the glass surface with a transparent background.
- **Scroll listener on every bar:** Use one shared scroll handler. If all four bars are simultaneously mounted (valid in a showcase), attach a single `window.scroll` listener — not four. Scope the listener to the component that needs it (typically only GlassTabBar for minimize behavior).
- **Nav bar corner radius on the bar itself:** The full-width bar GlassPanel uses `cornerRadius={0}` so the glass renders edge-to-edge. Only the button children use their own corner radii.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab bar keyboard navigation | Custom `onKeyDown` ArrowLeft/Right handler | `@radix-ui/react-toggle-group` | Radix handles roving tabindex, wrap-around, `aria-selected` state sync; custom handler omits edge cases |
| Cancel button entrance animation | CSS `transition` + class toggle | `motion/react` `AnimatePresence` + spring | CSS transitions cannot animate mount/unmount; AnimatePresence handles exit correctly |
| Search input focus state enhancement | Direct `useGlassRegion` handle call | Prop-driven `specular`/`rim` via `useState` → `GlassPanel` props | Direct handle calls bypass `reducedTransparency` guard per ARCHITECTURE.md pitfall C6 |
| Tab minimize scroll tracking | Intersection Observer on a sentinel element | `window.scroll` passive event listener with direction delta | IntersectionObserver is for element visibility, not scroll direction — wrong tool for minimize behavior |

**Key insight:** Navigation surfaces have no novel GPU or shader work. All complexity is React state management (tab selection, search focus state machine, scroll-minimize). Use existing Radix primitives and `motion` for the interaction layer; keep glass composition strictly through GlassPanel/GlassButton.

---

## Common Pitfalls

### Pitfall 1: GPU Region Budget Exceeded by Bar + Buttons

**What goes wrong:** A GlassTabBar with 5 items (5 GlassButton regions) + GlassNavigationBar (3 regions) + GlassToolbar (3 regions) + GlassSearchBar (2 regions) = 13 regions from navigation controls alone. Phase 21/22 controls and the showcase page together could push past `MAX_GLASS_REGIONS = 32`.

**Why it happens:** Each GlassButton and GlassPanel call `useGlassRegion` on mount. Navigation surfaces contain many buttons. Building a full demo page with all four nav controls + 3 Phase 21 controls + 3 Phase 22 controls simultaneously would consume 20+ regions.

**How to avoid:** Scope demonstration to one navigation control at a time in the showcase. Never mount all four navigation controls simultaneously in the same viewport unless a region audit confirms budget. The showcase page (Phase 25) uses IntersectionObserver virtualization to prevent this at scale.

**Warning signs:** Glass effect disappears on some controls with no console error. Happens when region count exceeds `MAX_GLASS_REGIONS = 32` (raised in Phase 20; was 16 before).

### Pitfall 2: Glass Mask Misalignment on Scroll-Minimized Tab Bar

**What goes wrong:** When GlassTabBar animates height change (minimize/expand), the GPU glass region's bounding rect is sampled before layout settles, causing the glass effect to render at the old dimensions for one or more frames.

**Why it happens:** `getBoundingClientRect()` is called each animation frame by `GlassRenderer`. If the CSS height transition is driven by `motion` with spring physics, intermediate frames have fractional heights. The glass region mask follows correctly because the renderer reads bounds each frame — but the `cornerRadius` stays constant during animation. This is not misalignment in the traditional sense; the effect follows the DOM correctly.

**How to avoid:** Only the outer bar GlassPanel (with `cornerRadius={0}`) is the glass region. Animate only its `height` style. Do not animate glass parameters (blur, opacity) during minimize — the glass renderer already interpolates these via morph speed. Keep minimize animation to height-only.

**Warning signs:** Glass effect appears to "lag" behind bar height during rapid scroll direction changes.

### Pitfall 3: Search Bar Input Not Accessible When Glass Panel Covers It

**What goes wrong:** The glass shader renders the GlassPanel surface visually on top of the native `<input>` — but if `z-index` is not managed correctly, the glass layer intercepts pointer events, making the input un-clickable.

**Why it happens:** `GlassPanel` renders as a `<div>` with `position: relative`. The GPU-drawn glass texture is on a `<canvas>` behind all DOM elements. The `<input>` inside GlassPanel is in normal flow and receives events correctly. The pitfall only occurs if an additional overlay (e.g., a click handler on the GlassPanel itself) captures events before they reach the `<input>`.

**How to avoid:** Do not add `onClick` to the GlassPanel wrapper of GlassSearchBar. Let focus events flow naturally to the `<input>`. Use `onFocus`/`onBlur` on the `<input>` element to drive the state machine.

**Warning signs:** Clicking the search bar capsule does nothing; the input does not gain focus.

### Pitfall 4: Back Action Prop Naming Convention Mismatch

**What goes wrong:** Phase 23 introduces `onBack` as the navigation action prop for GlassNavigationBar. If subsequent phases (Phase 25 showcase) expect a different prop name (e.g., `backAction`, `onBackPress`), there is a breaking rename.

**Why it happens:** Nav bar prop naming conventions differ between React and Apple HIG terminology.

**How to avoid:** Follow the existing prop naming convention established in Phase 21/22 types: callbacks use `on` prefix + verb (e.g., `onCheckedChange`, `onValueChange`). For nav bar: `onBack: () => void`. For toolbar actions: `actions: GlassToolbarAction[]` where each action has `{ icon: ReactNode; label: string; onPress: () => void; primary?: boolean }`. Define all types in `src/components/controls/types.ts` before implementation.

### Pitfall 5: Tab Content Rendering Outside Component

**What goes wrong:** GlassTabBar (NAV-01) requires switching content on tab change. The success criterion states "switching tabs updates content" — but GlassTabBar itself should not own content rendering. If content rendering is baked into the bar component, it becomes inflexible and uncompossable.

**Why it happens:** Over-coupling the navigation control with its content.

**How to avoid:** GlassTabBar is a controlled component that calls `onTabChange(value)`. Content rendering is the parent's responsibility. The success criterion "switching tabs updates content" is tested by wiring GlassTabBar to a local `useState` in the test (or showcase), and verifying the callback fires — not that the tab bar renders content panels.

---

## Code Examples

Verified patterns from official sources and established project conventions:

### GlassTabBar Props Interface

```typescript
// Source: Pattern from src/components/controls/types.ts (GlassToggleProps convention)
export interface GlassTabItem {
  /** Unique value for this tab */
  value: string;
  /** Visible label */
  label: string;
  /** Icon node (SVG, text emoji, or icon component) */
  icon?: React.ReactNode;
}

export interface GlassTabBarProps {
  /** Currently selected tab value */
  value: string;
  /** Callback fired when a tab is selected */
  onValueChange: (value: string) => void;
  /** Tab items to render */
  tabs: GlassTabItem[];
  /** Whether the bar minimizes on scroll-down. Default: false */
  scrollMinimize?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles applied to the bar surface */
  style?: React.CSSProperties;
}
```

### GlassNavigationBar Props Interface

```typescript
// Source: Pattern from src/components/controls/types.ts
export interface GlassToolbarAction {
  /** Unique key */
  id: string;
  /** Icon or label node */
  icon: React.ReactNode;
  /** Accessible label */
  label: string;
  /** Click handler */
  onPress: () => void;
  /** Whether this is the primary action (glassProminent style) */
  primary?: boolean;
}

export interface GlassNavigationBarProps {
  /** Navigation title (left-aligned, bold) */
  title: string;
  /** Back button callback — renders back chevron when provided */
  onBack?: () => void;
  /** Right-side action buttons */
  actions?: GlassToolbarAction[];
  /** Additional inline styles applied to the bar surface */
  style?: React.CSSProperties;
  /** CSS class name */
  className?: string;
}
```

### GlassSearchBar Props Interface

```typescript
// Source: Pattern from src/components/controls/types.ts
export interface GlassSearchBarProps {
  /** Current search text value */
  value: string;
  /** Callback fired on input change */
  onValueChange: (value: string) => void;
  /** Callback fired when cancel is pressed (also clears value) */
  onCancel?: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Accessible label for the search input */
  label?: string;
  /** Whether the search bar is disabled */
  disabled?: boolean;
  /** Additional inline styles */
  style?: React.CSSProperties;
  /** CSS class name */
  className?: string;
}
```

### Radix ToggleGroup for Tab Bar

```typescript
// Source: @radix-ui/react-toggle-group official docs
import * as ToggleGroup from '@radix-ui/react-toggle-group';

<ToggleGroup.Root
  type="single"
  value={value}
  onValueChange={(v) => { if (v) onValueChange(v); }}  // guard empty deselect
  role="tablist"
  aria-label="Navigation tabs"
  style={{ display: 'flex', gap: APPLE_SPACING.xs }}
>
  {tabs.map((tab) => (
    <ToggleGroup.Item
      key={tab.value}
      value={tab.value}
      aria-label={tab.label}
    >
      <GlassButton
        cornerRadius={APPLE_RADII.md}
        refractionMode={value === tab.value ? 'prominent' : undefined}
        style={{ minWidth: APPLE_CONTROL_SIZES.minTapTarget, height: APPLE_CONTROL_SIZES.minTapTarget }}
      >
        {tab.icon}
        {!minimized && <span>{tab.label}</span>}
      </GlassButton>
    </ToggleGroup.Item>
  ))}
</ToggleGroup.Root>
```

### Search Bar Focus State Glass Enhancement

```typescript
// Source: GlassInput pattern from Phase 22 RESEARCH.md — prop-driven state
const [focused, setFocused] = useState(false);

<GlassPanel
  cornerRadius={APPLE_RADII.pill}
  specular={focused ? 0.35 : undefined}   // elevated specular on focus
  rim={focused ? 0.30 : undefined}         // elevated rim on focus
  style={{ display: 'flex', alignItems: 'center', height: 36, paddingLeft: APPLE_SPACING.sm }}
>
  <input
    style={{ background: 'transparent', border: 'none', outline: 'none', flex: 1 }}
    onFocus={() => setFocused(true)}
    onBlur={() => setFocused(false)}
    value={value}
    onChange={(e) => onValueChange(e.target.value)}
    placeholder={placeholder ?? 'Search'}
    aria-label={label ?? 'Search'}
  />
  {value && <GlassButton cornerRadius={APPLE_RADII.md} onClick={() => onValueChange('')}>×</GlassButton>}
  <AnimatePresence>
    {focused && (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
        <GlassButton cornerRadius={APPLE_RADII.md} onClick={() => { onValueChange(''); onCancel?.(); }}>
          Cancel
        </GlassButton>
      </motion.div>
    )}
  </AnimatePresence>
</GlassPanel>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSS `backdrop-filter: blur()` for glass nav bars | WebGPU refraction + specular shader per region | This project (v1.0 → v3.0) | True optical glass simulation vs CSS frosted effect |
| Tab bar at screen bottom via `position: fixed; bottom: 0` | Same — fixed positioning is correct | Unchanged | No change needed |
| Framer Motion for spring animations | `motion` (rebranded, `motion/react` import path) | v12 (2025) | Import path changed; functionality is identical |
| `role="tablist"` built manually | `@radix-ui/react-toggle-group` | Phase 20 (installed) | Radix handles roving tabindex correctly; manual is error-prone |
| NavBar title centered | NavBar title bold, left-aligned | iOS 26 / WWDC25 | Left-aligned is the current Apple HIG standard for iOS 26 navigation |

**Deprecated/outdated:**
- Centered navigation bar titles: iOS 26 moved to bold left-aligned titles per WWDC25 session 284. Do not use `text-align: center` for GlassNavigationBar title.
- `framer-motion` package name: Replaced by `motion` package at v12. The `motion/react` import is correct; do not use `framer-motion` import paths.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 + @testing-library/react 16.3.2 + jsdom 29.0.1 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run src/components/controls/__tests__/GlassTabBar.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NAV-01 | GlassTabBar renders, active tab highlighted, onValueChange fires on click | unit | `npx vitest run src/components/controls/__tests__/GlassTabBar.test.tsx` | Wave 0 |
| NAV-01 | Scroll minimize sets aria-hidden on labels when minimized | unit | same file | Wave 0 |
| NAV-02 | GlassNavigationBar renders title, back button triggers onBack | unit | `npx vitest run src/components/controls/__tests__/GlassNavigationBar.test.tsx` | Wave 0 |
| NAV-03 | GlassToolbar renders action buttons, primary action is visually distinct, onPress fires | unit | `npx vitest run src/components/controls/__tests__/GlassToolbar.test.tsx` | Wave 0 |
| NAV-04 | GlassSearchBar accepts input, clear button appears on non-empty value, cancel fires callback | unit | `npx vitest run src/components/controls/__tests__/GlassSearchBar.test.tsx` | Wave 0 |
| NAV-04 | Cancel button mounts on focus, unmounts on blur/cancel | unit | same file | Wave 0 |
| NAV-01–04 | All four controls render without errors when composed in single viewport | integration | `npx vitest run` (all control tests) | Wave 0 |

**Mock pattern (established by GlassChip.test.tsx):**
```typescript
vi.mock('../../hooks/useGlassEngine', () => ({
  useGlassEngine: () => ({
    renderer: null,
    preferences: { darkMode: true, reducedMotion: false, reducedTransparency: false },
  }),
}));
vi.mock('../../hooks/useGlassRegion', () => ({
  useGlassRegion: () => null,
}));
vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: { div: ({ children, ...rest }: React.HTMLAttributes<HTMLDivElement>) => <div {...rest}>{children}</div> },
  useReducedMotion: () => false,
}));
```

### Sampling Rate

- **Per task commit:** `npx vitest run src/components/controls/__tests__/Glass[ControlName].test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/components/controls/__tests__/GlassTabBar.test.tsx` — covers NAV-01
- [ ] `src/components/controls/__tests__/GlassNavigationBar.test.tsx` — covers NAV-02
- [ ] `src/components/controls/__tests__/GlassToolbar.test.tsx` — covers NAV-03
- [ ] `src/components/controls/__tests__/GlassSearchBar.test.tsx` — covers NAV-04

No framework install needed — Vitest, @testing-library/react, and jsdom are all installed.

---

## Open Questions

1. **Scroll minimize threshold and spring curve for GlassTabBar**
   - What we know: Tab bar minimizes on scroll-down; expands on scroll-up. This is HIGH confidence from WWDC25 session 356.
   - What's unclear: The exact scroll offset threshold (50px? 100px?) and the spring curve for the height animation. The existing research flags this as MEDIUM confidence.
   - Recommendation: Use `scrollY > 50 && delta > 0` as the trigger threshold. Spring: `stiffness: 300, damping: 30` (same as Phase 21 toggle). Validate visually against iOS Simulator — the exact feel matters more than exact numbers. This is tunable post-implementation.

2. **Whether GlassTabBar label visibility in minimized state should use opacity:0 vs not-rendering**
   - What we know: Minimized state shows icon only, no label. This is HIGH confidence.
   - What's unclear: Whether to `display: none` / unmount the label (simpler, no animation) vs `opacity: 0` (preserves layout, allows fade animation). Radix ToggleGroup does not touch label visibility.
   - Recommendation: Use `motion` to animate label opacity from 1 to 0 in minimize. This produces a fade that looks correct without layout shift. If `useReducedMotion()` is true, skip the fade and use `display: none` equivalent instantly.

3. **Whether Phase 21 and Phase 22 controls will be implemented before Phase 23 runs**
   - What we know: ROADMAP.md states Phase 23 "Depends on: Phase 21 (validates composition pattern at scale)." The controls directory currently only has `types.ts` — no implementations exist yet.
   - What's unclear: Whether Phase 23 will be executed before Phase 21/22 are done, or in parallel.
   - Recommendation: Phase 23 can be planned and planned independently — it does not use any Phase 21/22 control outputs; it only uses the same GlassPanel/GlassButton primitives. The dependency is architectural validation, not a code import dependency. Execution order should remain Phase 21 → Phase 22 → Phase 23.

---

## Sources

### Primary (HIGH confidence)

- Live codebase: `src/components/GlassPanel.tsx`, `GlassButton.tsx`, `GlassEffectContainer.tsx` — composition pattern, prop interfaces, region registration behavior
- Live codebase: `src/hooks/useGlassRegion.ts` — accessibility guard pattern (reducedTransparency), prop-driven state → glass param flow (pitfall C6 prevention)
- Live codebase: `src/tokens/apple.ts` — APPLE_SPACING, APPLE_RADII, APPLE_CONTROL_SIZES definitions (version in repo is source of truth)
- Live codebase: `src/index.ts` — barrel export pattern for library public API
- Live codebase: `src/components/__tests__/GlassChip.test.tsx` — mock pattern for `useGlassEngine`, `useGlassRegion`, `motion/react` in jsdom tests
- `.planning/research/ARCHITECTURE.md` — Glass Primitive Composition pattern, anti-patterns, GPU region budget analysis
- `.planning/research/FEATURES.md` — GlassTabBar, GlassNavigationBar, GlassToolbar, GlassSearchBar Apple HIG specs per control
- `.planning/phases/21-core-interactive-controls/21-RESEARCH.md` — established Radix + motion + GlassPanel composition pattern
- WWDC25 session 284 "Build a UIKit app with the new design" — navigation bar button grouping, bold left-aligned titles, toolbar patterns (HIGH)
- WWDC25 session 356 "Get to know the new design system" — tab bar minimize behavior, scroll edge effects, shape geometry (HIGH)
- `@radix-ui/react-toggle-group` docs — ToggleGroup.Root/Item API, `type="single"`, `onValueChange` guard pattern (HIGH)
- `motion/react` docs — `AnimatePresence`, `useReducedMotion`, spring transition config (HIGH)

### Secondary (MEDIUM confidence)

- Donny Wals: "Exploring tab bars on iOS 26 with Liquid Glass" — tab bar minimize specifics, item cluster grouping behavior
- `.planning/research/SUMMARY.md` — Phase 3 (this phase) description, scroll-minimize flag as MEDIUM confidence research item
- `package.json` (live) — confirms `@radix-ui/react-toggle-group` ^1.1.11, `motion` ^12.38.0, `@radix-ui/react-dialog` ^1.1.15 are installed

### Tertiary (LOW confidence)

- GlassTabBar exact dimensions (49px height, 25px icon): from community reference implementations — verify against iOS Simulator
- GlassNavigationBar exact height (44px): community reference — verify against iOS Simulator
- GlassSearchBar capsule height (36px): community reference — verify against iOS Simulator

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies installed and verified in package.json; no new installs required
- Architecture: HIGH — derived from live codebase reads of GlassPanel, GlassButton, GlassEffectContainer, useGlassRegion, plus established Phase 21/22 patterns
- Apple HIG specs (behavior): HIGH — WWDC25 sessions 284 and 356 are official transcripts
- Apple HIG specs (dimensions): MEDIUM — community reference implementations; not official Apple numerical spec
- Pitfalls: HIGH (GPU budget, glass mask lag, input events) — all from source code analysis; MEDIUM (prop naming, tab content separation) — from project convention inference

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable library stack; Apple HIG dimensions may be refined by iOS Simulator calibration)

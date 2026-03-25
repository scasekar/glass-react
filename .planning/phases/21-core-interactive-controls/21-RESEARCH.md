# Phase 21: Core Interactive Controls - Research

**Researched:** 2026-03-25
**Domain:** React interactive controls — GlassToggle, GlassSlider, GlassSegmentedControl — spring animation via motion, accessibility via Radix UI, glass composition via GlassPanel/GlassButton
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CTRL-01 | GlassToggle renders as a switch with spring-animated glass thumb matching Apple's 51x31px dimensions | `APPLE_CONTROL_SIZES.toggleWidth/Height/ThumbSize/ThumbInset` already in `src/tokens/apple.ts`; `@radix-ui/react-switch` provides ARIA switch role + keyboard; `motion` `useSpring`/`animate` provides spring thumb slide |
| CTRL-02 | GlassSlider renders continuous value control with glass track fill and glass thumb | `APPLE_CONTROL_SIZES.sliderTrackHeight/ThumbSize` in tokens; `@radix-ui/react-slider` provides ARIA slider + arrow key step; GlassPanel for track/fill regions, GlassButton for thumb; pointer capture pattern for drag |
| CTRL-03 | GlassSegmentedControl renders segments with a glass thumb capsule that slides between options via spring animation | `APPLE_CONTROL_SIZES.segmentedHeight/Padding` in tokens; `@radix-ui/react-toggle-group` provides roving tabindex + ARIA; `motion` `layoutId` provides spring indicator morph; container is NOT glass (opaque tinted) |
</phase_requirements>

---

## Summary

Phase 21 builds three interactive controls — GlassToggle, GlassSlider, and GlassSegmentedControl — on top of the fully-implemented Phase 20 foundation. All dependencies are already installed (`motion` ^12.38.0, all `@radix-ui/*` packages), design tokens are in `src/tokens/apple.ts`, `GlassEffectContainer` is implemented, and the `GlassPanel`/`GlassButton` composition pattern is validated. This phase is purely additive: new files in `src/components/controls/`, no changes to the GPU pipeline, no changes to `GlassRenderer`, no changes to `useGlassRegion`.

The three controls follow a strict two-layer architecture. The accessibility layer (Radix primitive) owns ARIA roles, keyboard navigation, and state machine. The visual layer (GlassPanel + GlassButton + motion) owns appearance and animation. The critical composition rule — derived from `ARCHITECTURE.md` and confirmed by reading `GlassButton.tsx` — is that controls never call `useGlassRegion` directly; they compose `GlassPanel` and `GlassButton`, which self-register GPU regions and automatically apply the `reducedTransparency` guard. Spring animations via `motion` handle the thumb slide (GlassToggle), thumb drag (GlassSlider), and floating indicator morph (GlassSegmentedControl). The `useReducedMotion()` hook from `motion/react` disables spring overshoot when the OS `prefers-reduced-motion` preference is active.

The binding constraint for this phase is GPU region budget: GlassToggle uses 2 regions (track + thumb), GlassSlider uses 3 regions (track + fill + thumb), and GlassSegmentedControl uses 1 region (glass indicator only; the container is NOT a glass region). `MAX_GLASS_REGIONS` is now 32 (raised in Phase 20), which comfortably covers a showcase page that contains multiple instances of each control simultaneously.

**Primary recommendation:** Wrap each Radix primitive using the `asChild` + motion composition pattern. The Radix root handles state and keyboard; `motion.div` inside provides spring animation; `GlassPanel`/`GlassButton` wraps the animated element for glass rendering. Each control file is self-contained in `src/components/controls/`.

---

## Standard Stack

### Core (all already installed — Phase 20)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `motion` | ^12.38.0 | Spring physics, layout animations | `layoutId` is the only viable approach for segmented control indicator; `useSpring` for toggle/slider thumb; `useReducedMotion` for a11y |
| `@radix-ui/react-switch` | ^1.2.6 | ARIA switch role, Space key toggle, `aria-checked` | Handles both controlled/uncontrolled; toggle track renders as `Switch.Root`, thumb as `Switch.Thumb` |
| `@radix-ui/react-slider` | ^1.3.6 | ARIA slider, arrow key steps, `aria-valuenow/min/max` | Multi-thumb support, step, range; keyboard increments per ARIA spec |
| `@radix-ui/react-toggle-group` | ^1.1.11 | Roving tabindex, arrow key navigation, `aria-pressed` | Correct WAI-ARIA pattern for segmented controls; single or multiple selection |
| `GlassPanel` | in-repo | Glass surface (track, fill, indicator) | Composes `useGlassRegion`; auto-applies `reducedTransparency` guard |
| `GlassButton` | in-repo | Interactive glass surface (thumb) | Composes `useGlassRegion`; adds hover/active state changes |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `useGlassEffect` (in-repo) | in-repo | Access `GlassEffectContainer` context for layoutId prefixing | When segmented control is inside a `GlassEffectContainer`; provides `containerId` for motion `layoutId` scoping |
| `APPLE_CONTROL_SIZES` | `src/tokens/apple.ts` | Toggle (51x31px), slider (4px track, 28px thumb), segmented (32px height) | All dimension constants for all three controls |
| `APPLE_SPACING` | `src/tokens/apple.ts` | Padding, gaps within controls | Insets, segmented label padding |
| `APPLE_RADII` | `src/tokens/apple.ts` | `pill` (9999) for toggle/slider capsules, `md` (14) for toggle thumb | Corner radii |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `motion` layoutId for segmented indicator | Manually calculating translate offsets | Manual math is complex and breaks when segment count changes dynamically; layoutId is declarative and correct |
| Radix Switch for toggle | Native `<input type="checkbox">` with ARIA | Would require manually implementing `role="switch"` keyboard pattern, state machine — not worth it |
| Radix Slider for slider | Custom pointer event handler only | Radix provides arrow key stepping, ARIA `aria-valuenow`, and handles RTL — skipping Radix means building all of this from scratch |

**Installation:** Nothing to install — all dependencies installed in Phase 20.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   ├── controls/                         # NEW: Phase 21 target
│   │   ├── GlassToggle.tsx              # CTRL-01
│   │   ├── GlassSlider.tsx              # CTRL-02
│   │   ├── GlassSegmentedControl.tsx    # CTRL-03
│   │   └── index.ts                     # barrel export
│   ├── GlassPanel.tsx                   # UNCHANGED
│   ├── GlassButton.tsx                  # UNCHANGED
│   └── GlassEffectContainer.tsx         # UNCHANGED (Phase 20)
├── tokens/
│   └── apple.ts                          # UNCHANGED (Phase 20)
└── index.ts                              # ADD new exports
```

### Pattern 1: Radix Root + motion.div + GlassPanel/GlassButton Composition

**What:** The Radix primitive root handles state and ARIA. A `motion.div` wraps the animated element for spring physics. `GlassPanel` or `GlassButton` provides the glass GPU region. The three layers compose without conflict.

**When to use:** Every animated glass control in this phase.

**Key insight from `GlassEffectContainer.test.tsx`:** motion is always mocked in unit tests using `vi.mock('motion/react', ...)`. Control tests must follow the same mocking strategy.

**Toggle structure:**
```typescript
// CTRL-01: GlassToggle composition
// Source: Radix docs + GlassButton.tsx pattern

import * as Switch from '@radix-ui/react-switch';
import { motion, useReducedMotion } from 'motion/react';
import { GlassPanel } from '../GlassPanel';
import { APPLE_CONTROL_SIZES, APPLE_RADII } from '../../tokens/apple';

export function GlassToggle({ checked, onCheckedChange, label, disabled }: GlassToggleProps) {
  const shouldReduceMotion = useReducedMotion();

  const spring = shouldReduceMotion
    ? { type: 'tween', duration: 0 }
    : { type: 'spring', stiffness: 500, damping: 30, mass: 0.8 };

  return (
    <Switch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      style={{ /* outer touch target wrapper, 44px min */ }}
    >
      {/* Track — glass region 1 */}
      <GlassPanel
        cornerRadius={APPLE_RADII.pill}
        style={{
          width: APPLE_CONTROL_SIZES.toggleWidth,
          height: APPLE_CONTROL_SIZES.toggleHeight,
          position: 'relative',
          background: checked ? 'rgba(52, 199, 89, 0.6)' : undefined,
        }}
      >
        {/* Thumb — glass region 2 */}
        <Switch.Thumb asChild>
          <motion.div
            layout
            transition={spring}
            style={{
              position: 'absolute',
              top: APPLE_CONTROL_SIZES.toggleThumbInset,
              left: checked
                ? APPLE_CONTROL_SIZES.toggleWidth - APPLE_CONTROL_SIZES.toggleThumbSize - APPLE_CONTROL_SIZES.toggleThumbInset
                : APPLE_CONTROL_SIZES.toggleThumbInset,
              width: APPLE_CONTROL_SIZES.toggleThumbSize,
              height: APPLE_CONTROL_SIZES.toggleThumbSize,
            }}
          >
            {/* Glass thumb — renders as GlassPanel capsule */}
            <GlassPanel cornerRadius={APPLE_RADII.pill} style={{ width: '100%', height: '100%' }} />
          </motion.div>
        </Switch.Thumb>
      </GlassPanel>
    </Switch.Root>
  );
}
```

**Segmented control structure (layoutId pattern):**
```typescript
// CTRL-03: GlassSegmentedControl — layoutId for spring indicator morph
// Source: motion.dev layoutId docs

import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useGlassEffect } from '../../context/GlassEffectContext';
import { GlassPanel } from '../GlassPanel';
import { APPLE_CONTROL_SIZES, APPLE_SPACING, APPLE_RADII } from '../../tokens/apple';

export function GlassSegmentedControl({ value, onValueChange, segments }: GlassSegmentedControlProps) {
  const shouldReduceMotion = useReducedMotion();
  const effect = useGlassEffect(); // optional: for layoutId scoping in GlassEffectContainer

  const indicatorId = effect ? `${effect.containerId}-seg-indicator` : 'seg-indicator';

  const spring = shouldReduceMotion
    ? { type: 'tween', duration: 0 }
    : { type: 'spring', stiffness: 400, damping: 35 };

  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={onValueChange}
      style={{
        // Container is NOT glass — opaque tinted capsule
        display: 'flex',
        height: APPLE_CONTROL_SIZES.segmentedHeight,
        padding: APPLE_CONTROL_SIZES.segmentedPadding,
        borderRadius: APPLE_RADII.pill,
        background: 'rgba(80, 80, 100, 0.4)',
        position: 'relative',
      }}
    >
      {segments.map((seg) => (
        <ToggleGroup.Item key={seg.value} value={seg.value} asChild>
          <button style={{ position: 'relative', flex: 1, background: 'none', border: 'none' }}>
            {/* Glass indicator — spring-morphs between segments */}
            {value === seg.value && (
              <motion.div
                layoutId={indicatorId}
                transition={spring}
                style={{
                  position: 'absolute', inset: 0,
                  borderRadius: APPLE_RADII.pill,
                }}
              >
                <GlassPanel cornerRadius={APPLE_RADII.pill} style={{ width: '100%', height: '100%' }} />
              </motion.div>
            )}
            <span style={{ position: 'relative', zIndex: 1 }}>{seg.label}</span>
          </button>
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
```

**Slider structure:**
```typescript
// CTRL-02: GlassSlider — pointer capture + GlassPanel regions
// Source: Radix Slider docs + GlassButton.tsx pattern

import * as RadixSlider from '@radix-ui/react-slider';
import { motion, useReducedMotion } from 'motion/react';
import { GlassPanel } from '../GlassPanel';
import { GlassButton } from '../GlassButton';
import { APPLE_CONTROL_SIZES, APPLE_RADII } from '../../tokens/apple';

export function GlassSlider({ value, onValueChange, min = 0, max = 100, step = 1, label }: GlassSliderProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <RadixSlider.Root
      value={[value]}
      onValueChange={([v]) => onValueChange(v)}
      min={min} max={max} step={step}
      aria-label={label}
      style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}
    >
      {/* Track — glass region 1 */}
      <RadixSlider.Track asChild>
        <GlassPanel
          cornerRadius={APPLE_RADII.pill}
          style={{ flexGrow: 1, height: APPLE_CONTROL_SIZES.sliderTrackHeight, position: 'relative' }}
        >
          {/* Fill — glass region 2 */}
          <RadixSlider.Range asChild>
            <GlassPanel
              cornerRadius={APPLE_RADII.pill}
              style={{ position: 'absolute', height: '100%' }}
            />
          </RadixSlider.Range>
        </GlassPanel>
      </RadixSlider.Track>

      {/* Thumb — glass region 3 */}
      <RadixSlider.Thumb asChild>
        <GlassButton
          cornerRadius={APPLE_RADII.pill}
          style={{
            width: APPLE_CONTROL_SIZES.sliderThumbSize,
            height: APPLE_CONTROL_SIZES.sliderThumbSize,
          }}
          aria-label={label}
        />
      </RadixSlider.Thumb>
    </RadixSlider.Root>
  );
}
```

### Pattern 2: useReducedMotion for Accessibility

**What:** `useReducedMotion()` from `motion/react` returns `true` when the OS `prefers-reduced-motion: reduce` media query is active. When true, use `{ type: 'tween', duration: 0 }` as the transition (instant snap) instead of spring physics.

**When to use:** Every animated glass control. Apply at the spring config level — not by conditionally mounting/unmounting animation components.

**Critical:** This handles the `reducedMotion` preference. The `reducedTransparency` preference is already handled by `useGlassRegion` inside `GlassPanel`/`GlassButton` — no additional code needed in controls.

```typescript
// Source: motion.dev/docs/react-use-reduced-motion
import { useReducedMotion } from 'motion/react';

const shouldReduceMotion = useReducedMotion();
const springConfig = shouldReduceMotion
  ? { type: 'tween' as const, duration: 0 }
  : { type: 'spring' as const, stiffness: 500, damping: 30 };
```

### Pattern 3: Radix asChild Composition

**What:** Radix uses `asChild` to merge its behavior (ARIA attributes, event handlers, focus management) onto a custom element. The pattern is `<Radix.Part asChild><YourElement /></Radix.Part>`.

**When to use:** Every Radix primitive part that needs to render as a GlassPanel, GlassButton, or motion.div instead of the default Radix element.

**Compatibility:** Confirmed: `motion` ^12 + Radix `asChild` are compatible. Use `<Radix.Root asChild><motion.div /></Radix.Root>`. Do NOT apply `asChild` to the portal root of Dialog/Popover (not needed in this phase).

```typescript
// Source: radix-ui.com/primitives/docs/guides/composition
<Switch.Thumb asChild>
  <motion.div layout transition={spring}>
    <GlassPanel cornerRadius={9999} style={{ width: '100%', height: '100%' }} />
  </motion.div>
</Switch.Thumb>
```

### Anti-Patterns to Avoid

- **Calling `useGlassRegion` directly in a control:** Bypasses `reducedTransparency` guard, dark/light defaults, and morph speed defaults. Always compose `GlassPanel` or `GlassButton` instead.
- **Giving the slider thumb its own `motion.div` with layout animation independent of Radix positioning:** Radix Slider positions the thumb using transform; adding a `motion` layout animation on top of Radix's positioning creates double-transform conflicts. Use `GlassButton` directly as the `Radix.Thumb asChild` target.
- **Making the segmented control container a `GlassPanel`:** The container is opaque/tinted, NOT glass. Only the selected indicator thumb is glass. This is the most common implementation mistake.
- **Using `framer-motion` import:** Deprecated. Import everything from `motion/react`.
- **Applying CSS transitions on `left`/`top` for toggle thumb:** Use motion `layout` animation instead — it handles the spring correctly without fighting CSS transitions.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ARIA switch keyboard (Space to toggle) | Custom `onKeyDown` handler | `@radix-ui/react-switch` | W3C Switch ARIA pattern is precisely specified; easy to implement incorrectly on focus vs click vs keyboard |
| ARIA slider (arrow key increment, min/max, step) | Custom pointer event math | `@radix-ui/react-slider` | Arrow keys, step, RTL, multi-thumb — Radix handles all of it; building from scratch is 200+ lines |
| Roving tabindex for segmented control | Manual `tabIndex` management | `@radix-ui/react-toggle-group` | Roving tabindex across dynamic item count requires careful DOM observation; Radix does it correctly |
| Spring animation with overshoot | CSS `transition` or `cubic-bezier` | `motion` spring type | CSS cannot produce damped spring overshoot. `spring` with `stiffness`/`damping` is the only correct approach |
| Segmented control indicator position morph | Manual `getBoundingClientRect()` + translate | `motion` `layoutId` | Layout animations handle segment resizing, dynamic item addition, and RTL without manual geometry math |
| reducedTransparency fallback | Conditional rendering or separate component | `useGlassRegion` inside `GlassPanel`/`GlassButton` | Already implemented — composing the primitive is free |

**Key insight:** The accessibility contract (ARIA, keyboard, reduced-motion) and the glass rendering contract (reducedTransparency, GPU regions) are both fully handled by existing primitives. Control authors only write the visual layout and wire state — they do not implement accessibility or GPU concerns.

---

## Common Pitfalls

### Pitfall 1: Glass Mask Lag on Animated Thumb (C4)

**What goes wrong:** When the toggle thumb slides, the glass shader mask (which is based on `getBoundingClientRect()`) lags one rAF behind the CSS/motion animation. At 60fps this creates visible misalignment between the glass effect and the DOM element.

**Why it happens:** `GlassRenderer` reads `getBoundingClientRect()` inside the rAF loop. Motion's spring runs in a separate WAAPI/JS loop that may be slightly ahead or behind.

**How to avoid:** Register ONE glass region on the stable outer container; animate the thumb position with `motion` transforms only (`x`/`y` transform, not `left`/`top`). CSS `transform` does not trigger layout recalculation, so `getBoundingClientRect()` of the outer container stays stable. The thumb's glass appearance comes from GlassPanel positioned inside the outer container.

**Warning signs:** Glass effect appears offset from the visual thumb position during animation; misalignment resolves after animation completes.

**Applied rule for this phase:**
- GlassToggle: Track is the stable GlassPanel region; thumb is a motion.div with `layout` inside the track
- GlassSlider: Track is the stable GlassPanel region; thumb position is managed by Radix (it uses CSS transform internally)
- GlassSegmentedControl: Container is NOT glass; the glass indicator uses `layoutId` (motion handles the transform)

### Pitfall 2: Direct `useGlassRegion` Call Breaking Accessibility Contract (C6)

**What goes wrong:** A control calls `useGlassRegion` directly in its component body, bypassing `GlassPanel`. The `reducedTransparency` guard in `useGlassRegion` is not applied (the check requires `prefs.reducedTransparency` from `useGlassEngine`'s context, which IS in `useGlassRegion`). Actually, calling `useGlassRegion` directly DOES apply the guard — but it bypasses the dark/light tint defaults and morph speed defaults that are carefully tuned in `useGlassRegion`. Future changes to those defaults won't propagate.

**How to avoid:** Always compose `GlassPanel` or `GlassButton`. Confirmed by reading `GlassButton.tsx` — `GlassButton` is the canonical example of the composition pattern (it calls `useGlassRegion` with computed effective values from its own state, not a raw passthrough).

### Pitfall 3: motion layoutId Conflicts Across Multiple Instances

**What goes wrong:** If two `GlassSegmentedControl` instances on the same page use the same `layoutId` for their indicator, motion will animate the single indicator between the two separate controls — wrong behavior.

**How to avoid:** Scope the layoutId using `useId()` (React 18+) or prefix with the `containerId` from `useGlassEffect()`. Pattern from `GlassEffectContainer.tsx`: it uses `useId()` for `containerId`. Controls should do the same.

```typescript
const id = useId(); // React 18+
const indicatorId = `${id}-indicator`;
```

### Pitfall 4: Radix Slider Range Width vs GlassPanel Region

**What goes wrong:** `Radix.Range` sets its width via CSS style. If `GlassPanel` is used as the `asChild` target for `Radix.Range`, the GlassPanel GPU region reads the DOM element's bounding rect. Radix may set `width` as a CSS custom property (`--radix-slider-thumb-transform`), not a direct `style.width`. The GlassPanel glass region will correctly track the element size via `getBoundingClientRect()` on the next rAF — but the element must have non-zero dimensions at mount time or the region will register with zero size.

**How to avoid:** Verify the GlassPanel for the fill region has a non-zero initial size. If `value` starts at `min`, fill width is 0 — use `min-width: 4px` as a fallback or accept that a zero-value fill has no visible glass effect (this is visually correct).

### Pitfall 5: Toggle ON State Color vs Glass Tint

**What goes wrong:** The toggle's ON state needs a green fill. If this is implemented by passing `tint={[0.2, 0.78, 0.35]}` (green) to the track's GlassPanel, the glass shader tints the refracted background green — which looks correct but may fight with the reducedTransparency fallback (which makes the surface near-opaque with the same tint).

**How to avoid:** Apply the ON state color as a CSS `background` on the track's outer div, OUTSIDE the GlassPanel. Let the glass effect remain neutral and layer the color on top via CSS. This is visually consistent and does not interfere with the glass shader's tint uniform.

---

## Code Examples

Verified patterns from official sources and in-repo codebase:

### motion Spring Config for Apple Controls

```typescript
// Source: motion.dev/docs/react-transitions
// These stiffness/damping values produce iOS-like spring feel

// Toggle thumb snap: fast settle with slight overshoot
const TOGGLE_SPRING = { type: 'spring', stiffness: 500, damping: 30, mass: 0.8 } as const;

// Segmented indicator glide: smooth slide with gentle overshoot
const SEGMENT_SPRING = { type: 'spring', stiffness: 400, damping: 35 } as const;

// Reduced-motion: instant snap, no spring
const NO_MOTION = { type: 'tween', duration: 0 } as const;

// Usage:
const shouldReduceMotion = useReducedMotion();
const springConfig = shouldReduceMotion ? NO_MOTION : TOGGLE_SPRING;
```

### Radix Switch Controlled Pattern

```typescript
// Source: radix-ui.com/primitives/docs/components/switch
import * as Switch from '@radix-ui/react-switch';

// Radix Switch: Root is the boolean state machine
// onCheckedChange receives the new boolean value
<Switch.Root
  checked={checked}
  onCheckedChange={onCheckedChange}
  disabled={disabled}
  aria-label={label}
>
  <Switch.Thumb />  // Renders the thumb; use asChild for glass
</Switch.Root>
```

### Radix Slider Controlled Pattern

```typescript
// Source: radix-ui.com/primitives/docs/components/slider
import * as Slider from '@radix-ui/react-slider';

// value is always an array (supports multi-thumb)
// onValueChange receives number[] — destructure for single-thumb
<Slider.Root
  value={[value]}
  onValueChange={([v]) => onValueChange(v)}
  min={min} max={max} step={step}
  aria-label={label}
>
  <Slider.Track>
    <Slider.Range />   // The filled portion
  </Slider.Track>
  <Slider.Thumb />     // The draggable thumb; use asChild for GlassButton
</Slider.Root>
```

### Radix ToggleGroup Controlled Pattern

```typescript
// Source: radix-ui.com/primitives/docs/components/toggle-group
import * as ToggleGroup from '@radix-ui/react-toggle-group';

// type="single" for segmented control behavior (one selected at a time)
// value="" is the unselected state — consider requiring a default value
<ToggleGroup.Root
  type="single"
  value={value}
  onValueChange={(v) => { if (v) onValueChange(v); }}  // guard empty string
>
  <ToggleGroup.Item value="option1">Label 1</ToggleGroup.Item>
  <ToggleGroup.Item value="option2">Label 2</ToggleGroup.Item>
</ToggleGroup.Root>
```

### motion layoutId for Floating Indicator

```typescript
// Source: motion.dev/docs/react-layout-animations
// layoutId causes motion to spring-animate the element from its previous
// layout position to its new position whenever the element re-mounts
// (which happens when the selected segment changes and we conditionally render)

{value === seg.value && (
  <motion.div
    layoutId="seg-indicator"   // Must be unique per control instance
    transition={springConfig}
    style={{ position: 'absolute', inset: 0, borderRadius: 9999 }}
  >
    <GlassPanel cornerRadius={9999} style={{ width: '100%', height: '100%' }} />
  </motion.div>
)}
```

### Mocking motion/react in Vitest

```typescript
// Source: GlassEffectContainer.test.tsx (in-repo)
// All tests involving motion must mock it — jsdom has no WAAPI

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: React.forwardRef(({ children, ...props }: any, ref: any) => (
      <div ref={ref} {...props}>{children}</div>
    )),
  },
  useReducedMotion: () => false,
}));
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `framer-motion` import | `motion/react` import | motion v11 rebranding | Old import still works as alias but deprecated; use `motion/react` throughout |
| CSS `transition` for toggle | `motion` spring with `layout` | v4.0 requirement | Spring overshoot is non-negotiable for Apple-authentic feel |
| Manual tabindex management for segmented | Radix ToggleGroup roving tabindex | v4.0 requirement (Radix added in Phase 20) | Zero-cost accessibility |
| `transform: translateX` math for indicator | motion `layoutId` | v4.0 requirement | Eliminates all position calculation; works with variable-width segments |

**Deprecated/outdated:**
- `framer-motion`: Replaced by `motion` — same API, new package, already installed.
- `left`/`top` CSS animation for toggle thumb: Replaced by motion `layout` animation — avoids layout thrash and is spring-capable.

---

## Open Questions

1. **Toggle ON state: green tint in glass shader or CSS background?**
   - What we know: GlassPanel accepts a `tint` prop that passes to the shader; CSS `background` on the wrapper also works
   - What's unclear: Whether tinting via the glass shader or CSS background gives better visual fidelity to Apple's green toggle
   - Recommendation: Use CSS `background: rgba(52, 199, 89, 0.6)` on a wrapper div outside the GlassPanel. This separates the glass effect from the ON-state color, avoids interference with `reducedTransparency` fallback, and is easier to tune. LOW confidence — test against the iOS reference app.

2. **Slider thumb: GlassButton vs GlassPanel**
   - What we know: `GlassButton` adds hover/active state changes (blur reduction on press, specular boost on hover) which are desirable for a draggable thumb; `GlassPanel` is a neutral surface
   - What's unclear: Whether Radix Slider's `asChild` on `Slider.Thumb` works correctly with `GlassButton` (which renders a `<button>`)
   - Recommendation: Use `GlassPanel` for the thumb (renders as `<div>`) with `asChild`. `GlassButton` renders a `<button>` which is semantically wrong inside a slider thumb context — Radix Slider Thumb should be the accessible element. If hover feedback is wanted, implement it inline using `motion` `whileHover` and `whileTap`.

3. **Segmented control: what if onValueChange provides an empty string (user clicks active segment)?**
   - What we know: Radix ToggleGroup type="single" can return empty string if user clicks the currently selected item (deselecting)
   - What's unclear: Whether GlassSegmentedControl should allow deselection
   - Recommendation: Guard in `onValueChange`: `(v) => { if (v) onValueChange(v); }`. This prevents the undefined state. For the showcase, always start with a default segment selected.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.1 |
| Config file | `vitest.config.ts` — `include: ['src/**/__tests__/**/*.test.{ts,tsx}']`, `environment: node` |
| Quick run command | `npx vitest run --reporter=verbose src/components/controls` |
| Full suite command | `npx vitest run --reporter=verbose` |

Note: The vitest config uses `environment: node` as default but tests using React components use the `@vitest-environment jsdom` docblock override (confirmed in `GlassEffectContainer.test.tsx`). All new control tests must include `/** @vitest-environment jsdom */`.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CTRL-01 | GlassToggle renders at 51x31px, thumb slides on toggle, updates bound state | unit | `npx vitest run src/components/controls/__tests__/GlassToggle.test.tsx` | ❌ Wave 0 |
| CTRL-01 | GlassToggle respects reducedMotion (no spring) | unit | `npx vitest run src/components/controls/__tests__/GlassToggle.test.tsx` | ❌ Wave 0 |
| CTRL-01 | GlassToggle keyboard accessible (Space toggles) | unit | `npx vitest run src/components/controls/__tests__/GlassToggle.test.tsx` | ❌ Wave 0 |
| CTRL-02 | GlassSlider value updates continuously on change | unit | `npx vitest run src/components/controls/__tests__/GlassSlider.test.tsx` | ❌ Wave 0 |
| CTRL-02 | GlassSlider clamps value within min/max | unit | `npx vitest run src/components/controls/__tests__/GlassSlider.test.tsx` | ❌ Wave 0 |
| CTRL-02 | GlassSlider keyboard accessible (arrow key step) | unit | `npx vitest run src/components/controls/__tests__/GlassSlider.test.tsx` | ❌ Wave 0 |
| CTRL-03 | GlassSegmentedControl switches segment on click | unit | `npx vitest run src/components/controls/__tests__/GlassSegmentedControl.test.tsx` | ❌ Wave 0 |
| CTRL-03 | GlassSegmentedControl indicator mounts for active segment | unit | `npx vitest run src/components/controls/__tests__/GlassSegmentedControl.test.tsx` | ❌ Wave 0 |
| CTRL-03 | GlassSegmentedControl keyboard accessible (arrow key navigation) | unit | `npx vitest run src/components/controls/__tests__/GlassSegmentedControl.test.tsx` | ❌ Wave 0 |
| All | All three controls render without errors (smoke test) | unit | `npx vitest run src/components/controls` | ❌ Wave 0 |

Note: Visual tests (spring animation quality, glass effect appearance, Apple HIG fidelity) are MANUAL-ONLY — they require visual inspection in the browser against the iOS reference app. Playwright E2E smoke tests can verify render-without-crash and basic interaction, but not visual quality.

### Sampling Rate

- **Per task commit:** `npx vitest run src/components/controls`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/components/controls/__tests__/GlassToggle.test.tsx` — covers CTRL-01 (state, keyboard, reducedMotion)
- [ ] `src/components/controls/__tests__/GlassSlider.test.tsx` — covers CTRL-02 (value update, min/max, keyboard)
- [ ] `src/components/controls/__tests__/GlassSegmentedControl.test.tsx` — covers CTRL-03 (selection, indicator, keyboard)
- [ ] `src/components/controls/index.ts` — barrel export (needed before tests can import from the directory)

Shared mock pattern: all three test files must mock `motion/react`, `useGlassRegion`, and `useGlassEngine` following the pattern in `GlassEffectContainer.test.tsx`.

---

## Sources

### Primary (HIGH confidence)

- In-repo: `src/components/GlassButton.tsx` — canonical composition pattern (`useGlassRegion` + effective blur/specular/rim from state); keyboard + hover event handlers
- In-repo: `src/components/GlassPanel.tsx` — `useGlassRegion` composition, `cornerRadius`, `textStyles` pattern
- In-repo: `src/hooks/useGlassRegion.ts` — `reducedTransparency` guard, `DARK_DEFAULTS`/`LIGHT_DEFAULTS`, `handle.updateXxx()` API
- In-repo: `src/components/GlassEffectContainer.tsx` — `useId()` for stable ID, `AnimatePresence` wrap, `GlassEffectContext.Provider`
- In-repo: `src/context/GlassEffectContext.ts` — `useGlassEffect()` hook, `containerId` for layoutId scoping
- In-repo: `src/tokens/apple.ts` — `APPLE_CONTROL_SIZES`, `APPLE_SPACING`, `APPLE_RADII` with exact values
- In-repo: `src/components/__tests__/GlassEffectContainer.test.tsx` — motion mock pattern, jsdom environment docblock
- In-repo: `vitest.config.ts` — test include glob, node environment default
- In-repo: `package.json` — confirms `motion` ^12.38.0, all `@radix-ui/*` packages are installed as production deps

### Secondary (MEDIUM confidence)

- `.planning/research/STACK.md` (2026-03-25) — motion/Radix integration patterns, `asChild` composition, version compatibility table
- `.planning/research/ARCHITECTURE.md` (2026-03-25) — Glass Primitive Composition Pattern, Controlled Component Interface Pattern, region budget for Phase 21 controls
- `.planning/research/FEATURES.md` (2026-03-25) — Apple HIG specifications for GlassToggle, GlassSlider, GlassSegmentedControl from WWDC25 sessions 219 and 284

### Tertiary (LOW confidence)

- `APPLE_CONTROL_SIZES` values (toggle 51x31px, slider 4px track, segmented 32px): from community reference implementations, marked LOW confidence in `src/tokens/apple.ts`. Pending iOS Simulator calibration against ios-reference app (deferred per project scope).

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified installed; API patterns confirmed from in-repo source reading
- Architecture: HIGH — composition pattern derived directly from GlassButton.tsx and GlassPanel.tsx source; region budget confirmed (MAX_GLASS_REGIONS=32 post Phase 20)
- Pitfalls: HIGH (GPU/mask lag, accessibility contract) — from ARCHITECTURE.md PITFALLS research; MEDIUM (toggle color, slider thumb type) — from design analysis
- Validation: HIGH — test infrastructure confirmed from vitest.config.ts and existing test files

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable dependencies; motion and Radix APIs are well-versioned)

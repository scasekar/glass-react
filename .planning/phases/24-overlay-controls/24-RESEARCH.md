# Phase 24: Overlay Controls - Research

**Researched:** 2026-03-25
**Domain:** React modal/overlay controls — GlassActionSheet, GlassAlert, GlassSheet, GlassPopover — using Radix Dialog/Popover primitives, ReactDOM portals, motion animations, focus trapping, and glass panel composition
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OVR-01 | GlassActionSheet renders bottom action sheet with glass option rows and cancel button | `@radix-ui/react-dialog` (already installed) provides focus trap + portal + Escape dismiss; `motion` drag for dismiss gesture; GlassPanel + GlassButton composition for option rows; slides up from bottom with `motion` y-axis animation |
| OVR-02 | GlassAlert renders centered dialog with glass background, title, message, and action buttons | `@radix-ui/react-dialog` provides focus trap + portal + Escape dismiss; GlassPanel wrapping Dialog.Content via `asChild`; GlassButton for action rows; simplest of the four overlays |
| OVR-03 | GlassSheet renders half/full modal sheet with glass background and drag-to-dismiss | `@radix-ui/react-dialog` for focus trap + portal; `motion` `drag="y"` + `dragConstraints` + `onDragEnd` with `info.offset.y` threshold for dismiss gesture; `dragElastic` for rubber-band feel; `forceMount` + `AnimatePresence` for exit animation |
| OVR-04 | GlassPopover renders contextual popover with glass background anchored to trigger element | `@radix-ui/react-popover` (already installed) provides anchor positioning, outside-click dismiss, Escape dismiss, `avoidCollisions`; GlassPanel wrapping Popover.Content via `asChild` |
</phase_requirements>

---

## Summary

Phase 24 builds four overlay controls — GlassActionSheet, GlassAlert, GlassSheet, and GlassPopover — that render above page content using `ReactDOM.createPortal` (via Radix's built-in Portal). All four controls are Layer 2 controls that depend on GlassPanel/GlassButton primitives (Layer 0, shipped) and the GlassEffectContainer (shipped in Phase 20). The key dependencies — `@radix-ui/react-dialog` ^1.1.15 and `@radix-ui/react-popover` ^1.1.15 — are already installed as confirmed in `package.json`.

The architectural pattern for all four controls is: **Radix primitive handles accessibility behavior + motion handles animation + GlassPanel/GlassButton provides the glass surface**. Radix Dialog handles focus trapping, Escape key close, portal rendering, aria-modal, and focus return on dismiss. Radix Popover handles anchor positioning, viewport collision avoidance, outside-click dismiss, and Escape key close. The glass composition pattern follows the established rule: controls compose GlassPanel/GlassButton and never call `useGlassRegion` directly.

The critical implementation insight for animation is the `forceMount` + `AnimatePresence` pattern. Radix will unmount portal content when closed by default; this prevents motion's exit animations from running. The fix is to add `forceMount` on `Dialog.Portal`, `Dialog.Overlay`, and `Dialog.Content`, then gate the entire portal with a state-driven `AnimatePresence` or use `data-state` CSS animations. The motion.dev documentation confirms the forceMount pattern explicitly for Radix components.

GPU region budget: each overlay control uses 1-2 GlassPanel regions when open (the glass surface itself plus optionally a backdrop tint panel). They unmount when closed, releasing regions. `MAX_GLASS_REGIONS` is 32 (raised in Phase 20), so overlay controls pose no budget risk even when combined with navigation controls.

**Primary recommendation:** Use `@radix-ui/react-dialog` for GlassActionSheet, GlassAlert, and GlassSheet. Use `@radix-ui/react-popover` for GlassPopover. Wrap Dialog.Content/Popover.Content with `asChild` and a `React.forwardRef`-wrapped GlassPanel. Use `motion` with `forceMount` for smooth enter/exit animations. The `asChild` pattern requires GlassPanel to forward its ref — verify this is true before planning implementation (GlassPanel currently uses `useMergedRef` with the caller's `ref` prop, which satisfies this requirement).

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@radix-ui/react-dialog` | ^1.1.15 | Focus trap, portal, Escape dismiss, aria-modal, scroll lock for GlassActionSheet, GlassAlert, GlassSheet | Only viable approach — building focus trap from scratch requires 300+ lines handling all browser quirks; Radix is WAI-ARIA compliant out of the box |
| `@radix-ui/react-popover` | ^1.1.15 | Anchor positioning, collision avoidance, outside-click dismiss for GlassPopover | Handles all edge cases: viewport boundaries, RTL, multiple stacked popovers; `avoidCollisions` prevents off-screen placement |
| `motion` | ^12.38.0 | Enter/exit animations (slide-up, fade), drag-to-dismiss for GlassSheet/GlassActionSheet | `drag="y"` + `onDragEnd` for dismiss gesture; `AnimatePresence` for exit animations; spring physics for sheet slide |
| `GlassPanel` | in-repo | Glass surface for all overlay content areas | Composes `useGlassRegion`; auto-applies `reducedTransparency` guard; provides text color defaults |
| `GlassButton` | in-repo | Action rows in GlassActionSheet, GlassAlert action buttons | Hover/active glass morph built in; correct tap target sizing |
| `GlassEffectContainer` | in-repo | Groups glass elements for coordinated morph animations | Required for GlassActionSheet button-to-sheet morph; provides `containerId` for motion `layoutId` scoping |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `APPLE_RADII` | `src/tokens/apple.ts` | `xl` (28px) for modal/sheet corner radius, `pill` for action row capsules | All overlay corner radii |
| `APPLE_SPACING` | `src/tokens/apple.ts` | Padding inside overlays, gap between action rows | All overlay insets |
| `useGlassEffect` (in-repo) | in-repo | Access `GlassEffectContainer` context for layoutId prefixing in morphing transitions | GlassActionSheet morph from trigger button |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Radix Dialog for focus trap | Manual focus trap with `focus-trap-react` | `focus-trap-react` is a separate dependency; Radix Dialog already installed and handles all WAI-ARIA dialog patterns beyond just focus trap (aria-modal, scroll lock, return focus) |
| Radix Popover for positioning | Custom `useOverlayPosition` hook | Custom hook is simpler but misses viewport collision avoidance in all four directions; Radix handles Safari/Chrome quirks in `getBoundingClientRect` during scroll |
| motion drag for sheet dismiss | Native pointer events | Motion's `dragElastic` and spring snap-back provide the rubber-band feel expected on iOS; native pointer events require manual velocity calculation |

**Installation:** Nothing to install — all dependencies are already in `package.json`.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   ├── controls/
│   │   ├── GlassActionSheet.tsx   # OVR-01 — Radix Dialog + slide-up from bottom
│   │   ├── GlassAlert.tsx         # OVR-02 — Radix Dialog + centered GlassPanel
│   │   ├── GlassSheet.tsx         # OVR-03 — Radix Dialog + drag-to-dismiss + half/full height
│   │   ├── GlassPopover.tsx       # OVR-04 — Radix Popover + GlassPanel anchor
│   │   ├── types.ts               # ADD: overlay prop interfaces
│   │   └── index.ts               # ADD: barrel export for overlay controls
│   └── (existing GlassPanel, GlassButton, GlassEffectContainer — UNCHANGED)
├── components/__tests__/
│   ├── GlassActionSheet.test.tsx  # Tests per vitest pattern
│   ├── GlassAlert.test.tsx
│   ├── GlassSheet.test.tsx
│   └── GlassPopover.test.tsx
└── index.ts                       # MODIFY: add overlay controls to public barrel export
```

### Pattern 1: Radix Dialog + GlassPanel with forceMount + AnimatePresence

**What:** Use `Dialog.Content asChild` to render a `React.forwardRef`-wrapped GlassPanel as the dialog surface. `forceMount` on Portal/Overlay/Content lets motion control the exit animation. AnimatePresence gates the entire portal render based on the `open` state.

**When to use:** GlassAlert (centered modal), GlassSheet (bottom sheet), GlassActionSheet (bottom action sheet).

**Key detail:** GlassPanel already accepts a `ref` prop via `useMergedRef` — it satisfies the `React.forwardRef` requirement for `asChild`. Radix will merge aria attributes, role="dialog", and aria-modal onto the GlassPanel's rendered `<div>`.

**Example:**
```tsx
// Source: motion.dev/docs/radix — forceMount + AnimatePresence pattern
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'motion/react';
import { GlassPanel } from '../GlassPanel';
import { APPLE_RADII } from '../../tokens/apple';

export function GlassAlert({ open, onOpenChange, title, message, children }: GlassAlertProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: 'fixed', inset: 0,
                  background: 'rgba(0,0,0,0.4)',
                  zIndex: 9998,
                }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                style={{
                  position: 'fixed', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 9999,
                  minWidth: 280, maxWidth: 400,
                }}
              >
                <GlassPanel cornerRadius={APPLE_RADII.xl}>
                  <Dialog.Title>{title}</Dialog.Title>
                  <Dialog.Description>{message}</Dialog.Description>
                  {children}
                </GlassPanel>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
```

### Pattern 2: Drag-to-Dismiss Sheet

**What:** GlassSheet uses `motion` `drag="y"` with `dragConstraints={{ top: 0 }}` to allow only downward dragging. `onDragEnd` checks `info.offset.y > 100 || info.velocity.y > 500` to decide whether to close. `dragElastic={0.3}` provides rubber-band resistance above the drag origin.

**When to use:** GlassSheet (OVR-03) and GlassActionSheet (OVR-01 — both can dismiss by dragging down).

**Example:**
```tsx
// Source: motion.dev/docs/react-drag — drag-to-dismiss pattern
import { motion } from 'motion/react';

function SheetContent({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      drag="y"
      dragConstraints={{ top: 0 }}     // can't drag up past origin
      dragElastic={{ top: 0, bottom: 0.3 }}  // rubber-band on downward drag
      onDragEnd={(_, info) => {
        if (info.offset.y > 100 || info.velocity.y > 500) {
          onClose();
        }
      }}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
    >
      <GlassPanel cornerRadius={APPLE_RADII.xl}>
        {/* sheet content */}
      </GlassPanel>
    </motion.div>
  );
}
```

### Pattern 3: Radix Popover + GlassPanel

**What:** Use `Popover.Content asChild` to render a GlassPanel as the popover surface. Radix handles anchor positioning (`side`, `align`, `sideOffset`), viewport collision avoidance (`avoidCollisions`), outside-click dismiss (`onInteractOutside`), and Escape key dismiss. No focus trap — popovers are non-modal.

**When to use:** GlassPopover (OVR-04).

**Example:**
```tsx
// Source: radix-ui.com/primitives/docs/components/popover
import * as Popover from '@radix-ui/react-popover';
import { motion, AnimatePresence } from 'motion/react';
import { GlassPanel } from '../GlassPanel';

export function GlassPopover({ trigger, children, open, onOpenChange }: GlassPopoverProps) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        {trigger}
      </Popover.Trigger>
      <AnimatePresence>
        {open && (
          <Popover.Portal forceMount>
            <Popover.Content
              asChild
              forceMount
              sideOffset={8}
              avoidCollisions
              onInteractOutside={() => onOpenChange(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
              >
                <GlassPanel cornerRadius={APPLE_RADII.lg}>
                  {children}
                </GlassPanel>
              </motion.div>
            </Popover.Content>
          </Popover.Portal>
        )}
      </AnimatePresence>
    </Popover.Root>
  );
}
```

### Pattern 4: Action Row Composition

**What:** GlassActionSheet and GlassAlert action buttons follow the Apple HIG button hierarchy: secondary actions use plain GlassButton (translucent), primary actions add a tint (`tint` prop on GlassButton with opacity), destructive actions use red tint. Each action row in GlassActionSheet is a full-width GlassButton with `cornerRadius={APPLE_RADII.pill}`.

**When to use:** Any overlay with action buttons.

**Example:**
```tsx
// Action row composition pattern for GlassActionSheet
<div style={{ display: 'flex', flexDirection: 'column', gap: APPLE_SPACING.sm }}>
  {actions.map((action) => (
    <GlassButton
      key={action.label}
      cornerRadius={APPLE_RADII.pill}
      tint={action.destructive ? [0.8, 0.1, 0.1] : undefined}
      opacity={action.primary ? 0.25 : undefined}
      onClick={() => { action.onPress(); onOpenChange(false); }}
      style={{
        width: '100%',
        padding: `${APPLE_SPACING.md}px ${APPLE_SPACING.lg}px`,
        fontSize: 17,
        fontWeight: action.primary ? 600 : 400,
      }}
    >
      {action.label}
    </GlassButton>
  ))}
</div>
```

### Anti-Patterns to Avoid

- **Calling `useGlassRegion` directly inside overlay components:** Always compose GlassPanel/GlassButton; never call `useGlassRegion` raw. Violates accessibility contract (bypasses `reducedTransparency` guard).
- **Skipping `forceMount` on Portal/Overlay/Content:** Without `forceMount`, Radix unmounts content immediately on close, cutting off motion exit animations mid-frame.
- **Nesting GlassPanel inside Dialog.Content without `asChild`:** Without `asChild`, Radix wraps content in its own `<div role="dialog">` AND GlassPanel renders another `<div>`. The double-div causes stacking context conflicts. Use `asChild` on Dialog.Content to merge onto a single element — but note this requires the child to be a `React.forwardRef` component. Use `motion.div` as the `asChild` child, then put GlassPanel inside it (safer than `asChild` + GlassPanel directly).
- **Registering a GPU region for the dimming overlay:** The semi-transparent backdrop does NOT need a glass effect. It is a plain `rgba(0,0,0,0.4)` `<div>`. Adding a GlassPanel as the overlay would waste a GPU region and double-sample.
- **Stacking glass on glass:** The GlassPanel inside the modal samples the background scene. If the modal is placed on top of other GlassPanel elements (e.g., a toolbar), those underlying panels are composited into the background texture — this is correct behavior. Do not wrap the entire overlay in another GlassPanel.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Focus trap inside modal | Custom tabIndex/focus cycling loop | `@radix-ui/react-dialog` | Focus trap must handle: all focusable element types, portals, Shadow DOM, iOS VoiceOver quirks, dynamic content additions — 300+ lines with known bugs |
| Anchor positioning | `getBoundingClientRect` + manual CSS top/left | `@radix-ui/react-popover` | Collision avoidance in all 4 directions, scroll recalculation, ResizeObserver, RTL layout — complex to get right across browsers |
| Outside-click dismiss | Document `mousedown` listener | Radix `onInteractOutside` | Radix correctly handles: portals (click on same portal = not outside), touch events, pointer capture, nested dialogs |
| Escape key handling | `useEffect` + `keydown` listener | Radix built-in | Radix coordinates Escape across nested dialogs (only topmost closes) — document-level listeners fire for all, causing incorrect multi-close |
| Scroll lock during modal | `document.body.style.overflow = 'hidden'` | Radix Dialog `modal` prop | Radix preserves scrollbar width to prevent layout shift; restores scroll position correctly on close |

**Key insight:** The Radix primitives for Dialog and Popover exist precisely because these behaviors are deceptively hard. Each "simple" behavior (outside click, Escape, focus trap) has 3-5 browser/device-specific edge cases that Radix has already solved.

---

## Common Pitfalls

### Pitfall 1: Missing `forceMount` Cuts Off Exit Animations

**What goes wrong:** `motion` exit animations don't run. The overlay disappears instantly on close.

**Why it happens:** Radix Dialog and Popover unmount portal content immediately when `open` transitions to `false`. By the time `AnimatePresence` attempts to animate the exit, the elements are already removed from the DOM.

**How to avoid:** Add `forceMount` to `Dialog.Portal`, `Dialog.Overlay`, and `Dialog.Content` (and equivalently for Popover). Gate the entire portal tree with `{open && ...}` inside `AnimatePresence`. This hands control of DOM presence to motion rather than Radix.

**Warning signs:** Console warning "Cannot update a component from inside the function body of a different component" or overlay disappears with no animation.

### Pitfall 2: `asChild` Requires `React.forwardRef` on Child

**What goes wrong:** Radix throws a runtime error or ref is null.

**Why it happens:** `asChild` clones the child element and injects a ref. If the child component doesn't use `React.forwardRef`, the ref is not forwarded to the DOM node.

**How to avoid:** Do NOT use `Dialog.Content asChild` with a plain GlassPanel because GlassPanel currently wraps a `<div>` with `useMergedRef` but must be confirmed to use `React.forwardRef` at the component boundary. The safer pattern: use `Dialog.Content asChild` with a `motion.div`, and place GlassPanel inside the `motion.div` (not as the asChild target). This avoids the forwardRef requirement entirely.

**Warning signs:** `Warning: Function components cannot be given refs.` in console; `ref` is `null` in Radix internals.

### Pitfall 3: Dialog.Content `aria-describedby` Warning When No Description

**What goes wrong:** Console warning from Radix: "Missing `Description` or `aria-describedby={undefined}`".

**Why it happens:** WAI-ARIA dialog spec expects `aria-describedby`. Radix enforces this. GlassAlert has a description; GlassSheet may not.

**How to avoid:** For overlay controls without a description text, add `<Dialog.Description className="sr-only">` with a brief description, or explicitly pass `aria-describedby={undefined}` to Dialog.Content to suppress the warning intentionally.

### Pitfall 4: GlassPanel GPU Region Persists After Close if `forceMount` + No AnimatePresence Gate

**What goes wrong:** GPU regions from overlays accumulate even when no overlay is visible. Region count slowly grows toward the 32-region limit.

**Why it happens:** If `forceMount` is used without properly gating with `AnimatePresence`/conditional render, GlassPanel's `useGlassRegion` registers a region during mount and does not release it because the component stays mounted.

**How to avoid:** Ensure the pattern is `AnimatePresence > {open && <Dialog.Portal forceMount>...}`. The `{open && ...}` condition ensures React unmounts (and useGlassRegion cleanup fires) when the overlay is not needed.

### Pitfall 5: Drag Dismiss Competes with Scroll Inside Sheet

**What goes wrong:** Scrolling content inside GlassSheet triggers the drag-to-dismiss gesture, making vertical lists unusable.

**Why it happens:** `motion` `drag="y"` captures all pointer events on the sheet, including those that start on a scrollable child.

**How to avoid:** Apply `drag="y"` only to a non-scrollable drag handle element (e.g., a pill handle at the top of the sheet), not to the entire sheet container. Make the rest of the sheet content a non-draggable container. GlassSheet should expose an optional `showDragHandle` prop (default: `true`).

### Pitfall 6: Popover Glass Region Miscalculated During Initial Open

**What goes wrong:** The glass effect appears offset or misaligned when the popover first opens.

**Why it happens:** The GlassPanel inside the popover registers its region via `getBoundingClientRect()` on mount. If the popover content is still animating (y-translate during fade-in), the initial rect is captured during the motion animation, not at the final resting position.

**How to avoid:** Use `onOpenAutoFocus` callback on `Popover.Content` to delay the first glass region measurement by one rAF (`requestAnimationFrame`) after the popover is fully positioned. Alternatively, use `initial={{ opacity: 0 }}` only (no y-translation) for popover entry to avoid position-during-animation issues.

---

## Code Examples

Verified patterns from official sources:

### Radix Dialog Controlled Open/Close

```tsx
// Source: radix-ui.com/primitives/docs/components/dialog
import * as Dialog from '@radix-ui/react-dialog';

function GlassAlertExample() {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen} modal>
      <Dialog.Trigger asChild>
        <GlassButton onClick={() => setOpen(true)}>Open Alert</GlassButton>
      </Dialog.Trigger>
      {/* Portal + AnimatePresence pattern — see Pattern 1 above */}
    </Dialog.Root>
  );
}
```

### Radix Popover Controlled with Side Positioning

```tsx
// Source: radix-ui.com/primitives/docs/components/popover
import * as Popover from '@radix-ui/react-popover';

<Popover.Content
  side="top"           // above trigger
  align="start"        // left-aligned with trigger
  sideOffset={8}       // 8px gap from trigger
  avoidCollisions      // auto-flip if off screen
  onInteractOutside={() => onOpenChange(false)}
>
```

### Motion Drag Dismiss with Velocity Threshold

```tsx
// Source: motion.dev/docs/react-drag
import { motion } from 'motion/react';

<motion.div
  drag="y"
  dragConstraints={{ top: 0 }}
  dragElastic={{ top: 0, bottom: 0.3 }}
  onDragEnd={(_, info) => {
    // Close on significant drag OR fast flick
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose();
    }
  }}
/>
```

### motion AnimatePresence + forceMount for Radix

```tsx
// Source: motion.dev/docs/radix (Tooltip example, Dialog pattern equivalent)
import { AnimatePresence, motion } from 'motion/react';
import * as Dialog from '@radix-ui/react-dialog';

<AnimatePresence>
  {open && (
    <Dialog.Portal forceMount>
      <Dialog.Overlay asChild forceMount>
        <motion.div exit={{ opacity: 0 }} />
      </Dialog.Overlay>
      <Dialog.Content asChild forceMount>
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        >
          {/* GlassPanel inside, not as asChild target */}
          <GlassPanel cornerRadius={APPLE_RADII.xl}>
            {children}
          </GlassPanel>
        </motion.div>
      </Dialog.Content>
    </Dialog.Portal>
  )}
</AnimatePresence>
```

### GlassPanel forwardRef Verification

```tsx
// GlassPanel currently uses useMergedRef(internalRef, ref) where ref comes from props.
// This means it DOES forward refs when a ref prop is passed — React 19 supports ref as prop.
// Radix asChild injects a ref via React.cloneElement — this works IF the child accepts ref as prop.
// React 19 function components accept ref as a regular prop (no forwardRef needed).
// VERIFIED: GlassPanel signature includes `ref` in destructured props — React 19 compatible.
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ReactDOM.createPortal` manually | `@radix-ui/react-dialog` Portal (wraps createPortal) | v1.0+ Radix | Focus trap, scroll lock, aria-modal all handled automatically |
| `framer-motion` package | `motion` package (`motion/react` import) | ~2024 rebranding | Same API, new package name — project already uses `motion` |
| Manual `onCloseAutoFocus` to return focus | Radix Dialog handles focus return automatically | Radix default behavior | Focus automatically returns to trigger on close |
| CSS `backdrop-filter: blur()` overlays | WebGPU GlassPanel compositing | v3.0 architecture | CSS blur would double-blur over WebGPU pipeline |
| `React.forwardRef()` to accept ref | React 19 ref-as-prop | React 19 | GlassPanel uses `ref` as destructured prop — works with Radix asChild |

---

## Open Questions

1. **GlassActionSheet morph from trigger button**
   - What we know: FEATURES.md specifies that GlassActionSheet should morph from the source button (button bounds expand to sheet bounds) using `GlassEffectContainer` shared namespace and `layoutId` animation
   - What's unclear: The SUMMARY.md flags this as "architecturally novel" with no established web precedent. The `GlassEffectContainer` provides `containerId` for `layoutId` scoping, but the visual morphing requires the button to be inside `GlassEffectContainer` AND the sheet content to use matching `layoutId` values.
   - Recommendation: Implement as two-phase — Phase 24 Plan 01 implements a simple slide-up without morph (sufficient for OVR-01 requirement); morph animation can be a Plan 02 enhancement. The OVR-01 requirement text says "slides up from bottom" and does not mandate the morph explicitly.

2. **Dialog.Content `asChild` + motion.div ref behavior**
   - What we know: Radix `asChild` uses `React.cloneElement` to inject ref onto child. `motion.div` is a DOM element wrapper that correctly forwards refs.
   - What's unclear: Whether `Dialog.Content asChild` + `motion.div` (not a forwardRef component, but a DOM element) correctly receives the Radix-injected ref in all cases.
   - Recommendation: Use `motion.div` as the `asChild` target (it is a DOM element, not a component, so ref merging is straightforward). Keep GlassPanel as a non-asChild child inside. This is the documented pattern from motion.dev.

3. **Popover glass region alignment during initial open**
   - What we know: Pitfall 6 above identifies a potential misalignment when popover content animates on entry. The `useGlassRegion` hook captures `getBoundingClientRect()` on mount via `useEffect`.
   - What's unclear: Whether `useEffect` fires after the browser paints the initial position (post-animation) or during the animation.
   - Recommendation: Start with `initial={{ opacity: 0 }}` only (no y translation) for GlassPopover. If misalignment is observed during testing, add a 1-rAF delay via `onOpenAutoFocus`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.1 |
| Config file | `vitest.config.ts` (includes `src/**/__tests__/**/*.test.{ts,tsx}`) |
| Quick run command | `npx vitest run --reporter=verbose src/components/__tests__/GlassAlert.test.tsx` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OVR-01 | GlassActionSheet renders option rows and calls action callbacks | unit (jsdom) | `npx vitest run src/components/__tests__/GlassActionSheet.test.tsx` | Wave 0 |
| OVR-01 | Cancel button calls onOpenChange(false) | unit (jsdom) | same file | Wave 0 |
| OVR-02 | GlassAlert renders title and message | unit (jsdom) | `npx vitest run src/components/__tests__/GlassAlert.test.tsx` | Wave 0 |
| OVR-02 | Action buttons trigger callbacks and close | unit (jsdom) | same file | Wave 0 |
| OVR-03 | GlassSheet renders children when open | unit (jsdom) | `npx vitest run src/components/__tests__/GlassSheet.test.tsx` | Wave 0 |
| OVR-03 | GlassSheet does not render when closed | unit (jsdom) | same file | Wave 0 |
| OVR-04 | GlassPopover renders children when open | unit (jsdom) | `npx vitest run src/components/__tests__/GlassPopover.test.tsx` | Wave 0 |
| OVR-04 | GlassPopover closes on onOpenChange(false) | unit (jsdom) | same file | Wave 0 |
| All | Focus trapping and Escape close | manual-only | — | Radix handles; verify in browser with keyboard-only navigation |

**Note on mocking:** Tests must mock `useGlassEngine` (no WebGPU in jsdom) and `useGlassRegion` following the established pattern in `GlassChip.test.tsx`. Radix Dialog requires `document.body` to be available (jsdom provides this).

**Note on Radix Dialog in jsdom:** Radix Dialog portals into `document.body`. The `@vitest-environment jsdom` directive in each test file ensures `document.body` exists. `render()` from `@testing-library/react` correctly handles portal content — queries like `screen.getByRole('dialog')` find portal-rendered content.

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/components/__tests__/GlassActionSheet.test.tsx` — covers OVR-01
- [ ] `src/components/__tests__/GlassAlert.test.tsx` — covers OVR-02
- [ ] `src/components/__tests__/GlassSheet.test.tsx` — covers OVR-03
- [ ] `src/components/__tests__/GlassPopover.test.tsx` — covers OVR-04
- [ ] `src/components/controls/GlassActionSheet.tsx` — implementation file
- [ ] `src/components/controls/GlassAlert.tsx` — implementation file
- [ ] `src/components/controls/GlassSheet.tsx` — implementation file
- [ ] `src/components/controls/GlassPopover.tsx` — implementation file
- [ ] `src/components/controls/types.ts` — update with overlay prop interfaces

---

## Sources

### Primary (HIGH confidence)

- `package.json` (direct read) — `@radix-ui/react-dialog` ^1.1.15 and `@radix-ui/react-popover` ^1.1.15 confirmed installed; `motion` ^12.38.0 confirmed installed
- `src/components/GlassPanel.tsx` (direct read) — `ref` accepted as prop via `useMergedRef`; React 19 compatible with Radix `asChild`
- `src/components/GlassButton.tsx` (direct read) — hover/active state pattern; confirms GlassButton is composable as overlay action button
- `src/hooks/useGlassRegion.ts` (direct read) — region register/cleanup lifecycle; confirms portal elements release regions on unmount
- `src/components/GlassEffectContainer.tsx` (direct read) — `containerId` provided via context; `AnimatePresence` wraps children by default
- `src/context/GlassEffectContext.ts` (direct read) — `useGlassEffect()` hook returns `containerId` for `layoutId` scoping
- `src/tokens/apple.ts` (direct read) — `APPLE_RADII.xl` (28), `APPLE_SPACING`, confirmed available
- radix-ui.com/primitives/docs/components/dialog — Dialog parts, focus trap, portal, forceMount, asChild, Escape key behavior (fetched 2026-03-25)
- radix-ui.com/primitives/docs/components/popover — Popover parts, positioning props, avoidCollisions, outside-click, asChild (fetched 2026-03-25)
- radix-ui.com/primitives/docs/guides/composition — asChild pattern mechanics, forwardRef requirement (fetched 2026-03-25)
- motion.dev/docs/radix — forceMount + AnimatePresence pattern for Radix components (fetched 2026-03-25)
- motion.dev/docs/react-drag — drag prop, dragConstraints, dragElastic, onDragEnd with info.offset/velocity (fetched 2026-03-25)
- `.planning/research/SUMMARY.md` — overlay portal pattern, dependency decisions, pitfall C1-C6
- `.planning/research/ARCHITECTURE.md` — Overlay Portal Pattern 3; `useOverlayPosition` hook in project structure
- `.planning/research/FEATURES.md` — Apple HIG specs for GlassActionSheet, GlassAlert, GlassSheet, GlassPopover

### Secondary (MEDIUM confidence)

- radix-ui.com/primitives/docs/guides/animation — data-state CSS animation pattern vs forceMount JS pattern (fetched 2026-03-25)
- motion.dev/docs/react-gestures — drag event lifecycle details (WebSearch verified with official docs)
- Radix GitHub issue #1061 — `forceMount` required for Framer Motion exit animations in Dialog portals; confirms the forceMount pattern is intentional and documented

### Tertiary (LOW confidence)

- WebSearch: "drag-to-dismiss bottom sheet 2025" — community pattern for offset.y > 100 || velocity.y > 500 thresholds; exact thresholds are conventions, not specifications — tune during implementation against feel

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies directly confirmed in package.json; Radix APIs fetched from official docs
- Architecture: HIGH — Radix Dialog/Popover official API confirmed; forceMount pattern confirmed from motion.dev official docs; GlassPanel/GlassButton composition pattern established in prior phases
- Pitfalls: HIGH (GPU/React) — derived from direct code analysis of useGlassRegion lifecycle and Radix known issues; MEDIUM (drag thresholds) — community convention

**Research date:** 2026-03-25
**Valid until:** 2026-06-25 (Radix and motion APIs are stable; no breaking changes expected in 90 days)

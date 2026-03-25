# Architecture Research

**Domain:** Apple Liquid Glass UI Control Library — v4.0 showcase and control set
**Researched:** 2026-03-25
**Confidence:** HIGH

---

## Context: What Changed in v3.0 (Stable Baseline)

The v3.0 architecture is fully shipped and provides the integration point for all v4.0 work:

- JS creates `GPUDevice` and passes it to C++ WASM engine
- C++ renders background only (noise or image) to an offscreen `GPUTexture`
- `GlassRenderer` (TypeScript) owns the glass shader pipeline — reads the C++ texture, renders glass over it per-region
- React components (`GlassPanel`, `GlassButton`, `GlassCard`) call `useGlassRegion`, which registers DOM elements as glass regions in `GlassRenderer` via `GlassContext`
- `GlassRegionHandle` interface bridges React prop changes to `GlassRenderer.setRegionXxx()` calls
- `GlassProvider` owns the GPU device, the render loop, and provides `GlassContext`

**v4.0 does not change any of the above.** The C++ engine, `GlassRenderer`, all primitives, and `useGlassRegion` are untouched. New controls and the showcase page compose on top of the existing system.

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        React Application Layer                       │
├─────────────────────────────────────┬───────────────────────────────┤
│        Showcase Page (main landing) │  Tuning Drawer (overlay)      │
│  ┌───────────────────────────────┐  │  ┌─────────────────────────┐  │
│  │  ShowcasePage                 │  │  │   TuningDrawer           │  │
│  │  (single-page scroll)        │  │  │   (existing tuning UI    │  │
│  └─────────────┬─────────────────┘  │   wrapped in slide panel) │  │
│                │                    │  └─────────────────────────┘  │
│  ┌─────────────┴─────────────────────────────────────────────────┐  │
│  │                    Showcase Sections                            │  │
│  │  HeroSection  ButtonsSection  TogglesSection  SlidersSection   │  │
│  │  SegmentedSection  ModalSection  PopoverSection  FormSection   │  │
│  └─────────────┬─────────────────────────────────────────────────┘  │
│                │                                                      │
├────────────────┴─────────────────────────────────────────────────────┤
│                     Glass Control Components (NEW v4.0)               │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐  │
│  │ GlassToggle  │  │ GlassSlider  │  │ GlassSegmentedControl      │  │
│  │ GlassSwitch  │  │ GlassStepper │  │ GlassModal                 │  │
│  │ GlassChip    │  │ GlassInput   │  │ GlassPopover               │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬────────────────┘  │
│         │                 │                       │                   │
│    Each control composes GlassPanel and/or GlassButton                │
├──────────────────────────────────────────────────────────────────────┤
│                  Glass Primitives — UNCHANGED from v3.0               │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────┐   │
│  │ GlassPanel │  │GlassButton │  │ GlassCard  │  │useGlassRegion│   │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └──────┬───────┘   │
│        └───────────────┴───────────────┴────────────────┘            │
│                                │                                      │
├────────────────────────────────┴─────────────────────────────────────┤
│              GlassProvider / GlassRenderer — UNCHANGED from v3.0      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ GlassProvider: GPUDevice owner, rAF loop, ResizeObserver,    │    │
│  │                GlassContext provider, a11y prefs             │    │
│  │ GlassRenderer: WGSL pipeline, uniform buffers (16 regions),  │    │
│  │                morph lerp, dynamic offset draw               │    │
│  └──────────────────────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────────────────────┤
│                     C++ WASM Background Engine — UNCHANGED            │
│  Background-only: noise or image → GPUTexture (offscreen)             │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | v4.0 Status |
|-----------|----------------|-------------|
| `GlassProvider` | Owns `GPUDevice`, `GlassRenderer`, rAF loop, provides `GlassContext` | UNCHANGED |
| `GlassRenderer` | WebGPU pipeline, per-region uniform buffers, 16-region draw, morph lerp | UNCHANGED |
| `useGlassRegion` | Registers DOM element as glass region; syncs React props to `GlassRegionHandle` | UNCHANGED |
| `GlassPanel` | Generic `<div>` with full 16-parameter glass surface | UNCHANGED — composable by controls |
| `GlassButton` | `<button>` with hover/active morph built in | UNCHANGED — composable by controls |
| `GlassCard` | `<article>` with glass surface | UNCHANGED |
| **New: Glass control components** | Functional widgets that embed `GlassPanel`/`GlassButton` as their glass surface | NEW in v4.0 |
| **New: ShowcasePage** | Full-viewport single-page scroll, section-per-control-family, main landing | NEW in v4.0 |
| **New: TuningDrawer** | Existing tuning UI wrapped in a right-side slide-in panel | NEW wrapper in v4.0 |

---

## Recommended Project Structure

```
src/
├── components/
│   ├── GlassProvider.tsx      # unchanged v3.0
│   ├── GlassPanel.tsx         # unchanged v3.0
│   ├── GlassButton.tsx        # unchanged v3.0
│   ├── GlassCard.tsx          # unchanged v3.0
│   ├── types.ts               # unchanged v3.0
│   │
│   └── controls/              # NEW: v4.0 widget controls
│       ├── GlassToggle.tsx    # toggle switch (boolean on/off)
│       ├── GlassSlider.tsx    # continuous range input
│       ├── GlassSegmentedControl.tsx  # multi-option tab selector
│       ├── GlassStepper.tsx   # increment/decrement counter
│       ├── GlassChip.tsx      # tag / filter chip (GlassButton variant)
│       ├── GlassModal.tsx     # full-screen overlay dialog (portal)
│       ├── GlassPopover.tsx   # anchored overlay panel (portal)
│       ├── GlassInput.tsx     # text field
│       └── index.ts           # barrel export for all controls
│
├── showcase/                  # NEW: showcase page (not exported from index.ts)
│   ├── ShowcasePage.tsx       # top-level layout, sticky header, section scroll
│   ├── TuningDrawer.tsx       # existing tuning UI in a CSS-transform slide-in shell
│   ├── sections/
│   │   ├── HeroSection.tsx    # headline, tagline, background CTA buttons
│   │   ├── ButtonsSection.tsx # GlassButton variants
│   │   ├── TogglesSection.tsx # GlassToggle, GlassSwitch instances
│   │   ├── SlidersSection.tsx # GlassSlider instances
│   │   ├── SegmentedSection.tsx  # GlassSegmentedControl instances
│   │   ├── ModalSection.tsx   # GlassModal trigger + demo
│   │   ├── PopoverSection.tsx # GlassPopover trigger + demo
│   │   └── FormSection.tsx    # GlassInput, GlassStepper, GlassChip
│   └── tokens.ts              # design tokens (spacing, radii, type scale, animation)
│
├── hooks/
│   ├── useGlassRegion.ts           # unchanged v3.0
│   ├── useGlassEngine.ts           # unchanged v3.0
│   ├── useAccessibilityPreferences.ts  # unchanged v3.0
│   ├── useMergedRef.ts             # unchanged v3.0
│   └── useOverlayPosition.ts       # NEW: anchor/viewport positioning for popover
│
├── context/
│   └── GlassContext.ts        # unchanged v3.0
│
├── renderer/                  # unchanged v3.0
├── wasm/                      # unchanged v3.0
├── utils/
│   ├── contrast.ts            # unchanged v3.0
│   └── overlay.ts             # NEW: shared rect/clamp math for modal and popover
│
├── App.tsx                    # MODIFIED: mounts <ShowcasePage /> instead of demo
├── index.ts                   # MODIFIED: adds new controls to public barrel export
└── main.tsx                   # unchanged
```

### Structure Rationale

- **`components/controls/`:** Separates new high-level controls from the three stable primitives. Primitives are the core library API. Controls are higher-level widgets built on top. The subdirectory boundary enforces this distinction and prevents accidentally exposing internal control state in the base primitive API.
- **`showcase/`:** Entirely separate from `components/` — showcase code is never exported from `index.ts`. It is the demo app, not the library. This pattern matches the existing project: the tuning page in v2.0/v3.0 was co-located but was not an exported library component.
- **`showcase/sections/`:** One file per control family. Independent state, independent implementation. Enables shipping sections incrementally as controls are completed without cross-file entanglement.
- **`hooks/useOverlayPosition.ts`:** Both `GlassModal` and `GlassPopover` need anchor-relative positioning. Extracting this avoids duplication and keeps positioning logic independently testable.

---

## Architectural Patterns

### Pattern 1: Glass Primitive Composition

**What:** New controls are thin functional wrappers around the existing glass primitives (`GlassPanel`, `GlassButton`). A `GlassToggle` renders a `GlassPanel` (the track) containing a `GlassButton` (the thumb). A `GlassSlider` renders a `GlassPanel` (the track), another `GlassPanel` (the active fill), and a `GlassButton` (the draggable thumb). Controls do not call `useGlassRegion` directly; they rely on the primitives to register and manage their own GPU regions.

**When to use:** Every new control that has a visible glass surface. This is the universal composition pattern for all v4.0 controls.

**Trade-offs:** Each primitive registers its own GPU region. A `GlassToggle` uses 2 regions (track + thumb). A `GlassSlider` uses up to 3 regions. The 16-region limit in `GlassRenderer` becomes the binding constraint for how many controls can be simultaneously mounted. Section-based virtualization (lazy-mount off-screen sections) is the mitigation — see Anti-Patterns.

**Example:**
```typescript
// GlassToggle: track = GlassPanel, thumb = GlassButton
export function GlassToggle({ checked, onChange, label }: GlassToggleProps) {
  return (
    <GlassPanel
      cornerRadius={16}
      style={{ width: 51, height: 31, position: 'relative', cursor: 'pointer' }}
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      aria-label={label}
    >
      <GlassButton
        cornerRadius={14}
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 22 : 2,
          width: 27,
          height: 27,
          transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
    </GlassPanel>
  );
}
```

### Pattern 2: Controlled Component Interface

**What:** All new controls follow the controlled component pattern — state lives in the parent (or in a local `useState` within the showcase section). Controls receive `value`/`onChange` or `checked`/`onChange`. Controls never own their authoritative state internally.

**When to use:** Every functional control in v4.0.

**Trade-offs:** Showcase sections must manage per-control state locally, but this is intentional. Controlled components are composable in real applications without hidden internal state. The showcase sections serve as the state owners for the demo.

**Example:**
```typescript
// Each section holds its own local state — no global store needed
function TogglesSection() {
  const [wifi, setWifi] = useState(true);
  const [bluetooth, setBluetooth] = useState(false);
  return (
    <>
      <GlassToggle checked={wifi} onChange={setWifi} label="Wi-Fi" />
      <GlassToggle checked={bluetooth} onChange={setBluetooth} label="Bluetooth" />
    </>
  );
}
```

### Pattern 3: Overlay Portal Pattern

**What:** `GlassModal` and `GlassPopover` render into a `ReactDOM.createPortal` targeting `document.body`. This escapes any `overflow: hidden` stacking context in the showcase page. The `GlassPanel` inside the portal registers its GPU region normally — `getBoundingClientRect()` returns correct viewport-relative coordinates for portal elements.

**When to use:** Modal dialogs and anchored popovers only. All other controls render in-place.

**Trade-offs:** Portal contents are outside the normal DOM layout flow but React event delegation still works correctly in React 18/19. Accessibility requires `aria-modal="true"` on the dialog, `role="dialog"`, and a focus trap implementation.

**Example:**
```typescript
export function GlassModal({ open, onClose, children }: GlassModalProps) {
  if (!open) return null;
  return ReactDOM.createPortal(
    <div role="dialog" aria-modal="true"
         style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      {/* Semi-transparent backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }}
           onClick={onClose} />
      {/* GlassPanel registers its own GPU region — works correctly in portals */}
      <GlassPanel cornerRadius={28}
                  style={{ position: 'absolute', top: '50%', left: '50%',
                           transform: 'translate(-50%, -50%)', minWidth: 320 }}>
        {children}
      </GlassPanel>
    </div>,
    document.body
  );
}
```

### Pattern 4: Section-Based Showcase Layout

**What:** The showcase page is a single long scroll with semantically grouped `<section>` elements. Each section demonstrates one control family. A sticky header provides anchor navigation links and the tuning drawer toggle button. Sections are scrolled-into-view via in-page anchor links, not client-side routing.

**When to use:** The showcase page layout. No React Router dependency is needed.

**Trade-offs:** In-page scroll is simpler than routing and matches Apple's product showcase aesthetic. URL does not change per section, which is acceptable for a demo page. If a multi-page developer docs site is added later (out of scope for v4.0), routing can be introduced at that point.

### Pattern 5: TuningDrawer as Always-Mounted Overlay

**What:** The existing tuning UI (v3.0 dev page) is wrapped in a `TuningDrawer` component that is always mounted but hidden via `transform: translateX(100%)`. A settings icon in the showcase sticky header toggles a `tuningDrawerOpen` boolean in `ShowcasePage` state, which drives a CSS class/style that transitions the drawer into view.

**When to use:** The tuning drawer pattern specifically. Do not conditionally mount/unmount the drawer.

**Trade-offs:** Always-mounted preserves the tuning UI's internal state (slider positions, preset selections) when the drawer is dismissed. CSS transform avoids re-initialization cost. A conditionally-mounted approach would reset tuning state on each open, which is poor developer ergonomics when iterating on glass parameters.

---

## Data Flow

### Glass Region Registration (Controls → Renderer)

```
GlassToggle renders
    │
    ├── GlassPanel (track)          GlassButton (thumb)
    │       ↓                               ↓
    │  useGlassRegion(ref, props)   useGlassRegion(ref, props)
    │       ↓                               ↓
    │  GlassContext.registerRegion(element) — both
    │       ↓
    │  GlassRenderer.addRegion(element) → assigns region ID
    │       ↓
    │  GlassRegionHandle stored in hook's handleRef
    │
    └── Per-frame: GlassRenderer reads getBoundingClientRect() live
                   writes UV rect + uniforms → GPU uniform buffer
                   glass WGSL shader draws each region
```

### Interaction State Flow

```
User input (click, drag, keypress)
    ↓
Control event handler (e.g., GlassToggle onClick)
    ↓
Parent useState in showcase section (e.g., setWifi(true))
    ↓
Re-render → control receives new checked prop
    ↓
CSS transition animates visual position (thumb slide, etc.)
    ↓
useGlassRegion syncs updated GlassStyleProps to GlassRegionHandle
    ↓
GlassRenderer morph lerp smoothly transitions blur/opacity/etc.
```

### Showcase Page State

```
ShowcasePage (top-level)
├── tuningDrawerOpen: boolean  (useState)
│     → controls TuningDrawer CSS transform
│
└── Each <section> component holds its own independent state:
    HeroSection      → (no interactive state)
    ButtonsSection   → activeVariant: string
    TogglesSection   → { wifi, bluetooth, airdrop, ... }: boolean[]
    SlidersSection   → { volume, brightness, zoom }: number[]
    SegmentedSection → selectedIndex: number[]  (one per demo instance)
    ModalSection     → modalOpen: boolean
    PopoverSection   → popoverAnchor: HTMLElement | null
    FormSection      → { name, value, count }: Record<string, unknown>
```

No global state manager is needed. `useState` within each section is sufficient. The only shared state at the page level is `tuningDrawerOpen`.

---

## Build Order (Phase Implications)

The dependency graph is bottom-up. Primitives already exist. Build controls by ascending dependency layer:

**Layer 0 — Already shipped (v3.0):**
`GlassPanel`, `GlassButton`, `GlassCard`, `useGlassRegion`, `GlassProvider`, `GlassRenderer`

**Layer 1 — Independent controls (no inter-control dependencies):**
Each depends only on Layer 0 primitives. These can be built in parallel or sequentially.

| Control | Glass Regions Used | Notes |
|---------|-------------------|-------|
| `GlassChip` | 1 (GlassButton variant) | Simplest — just a styled GlassButton |
| `GlassToggle` | 2 (track GlassPanel + thumb GlassButton) | Core boolean control |
| `GlassSegmentedControl` | N+1 (container + one per segment) | Track where N = segment count |
| `GlassStepper` | 3 (decrement button + display panel + increment button) | Uses GlassButton for ± |
| `GlassInput` | 1 (GlassPanel wrapping native `<input>`) | Native input inside glass container |
| `GlassSlider` | 3 (track + fill + thumb) | Most complex of Layer 1; needs pointer event handling |

**Layer 2 — Overlay controls (require `useOverlayPosition` utility):**
Build after Layer 1 to keep scope clean. Require portal + positioning logic.

| Control | Dependencies | Notes |
|---------|-------------|-------|
| `GlassPopover` | `useOverlayPosition`, `GlassPanel`, portal | Anchored to a trigger element |
| `GlassModal` | `GlassPanel`, portal, focus trap | Simpler positioning (center-screen) |

**Layer 3 — Showcase sections (depend on Layer 1 + Layer 2 controls):**
Build each section once its control is ready. Sections are independent of each other.

**Layer 4 — Showcase page shell:**
`ShowcasePage` assembles all sections. `TuningDrawer` wraps existing tuning UI. Both require all sections to exist first.

**Layer 5 — Entry point:**
Replace `App.tsx` with `<ShowcasePage />`. Add new controls to `src/index.ts` barrel export.

---

## Scaling Considerations

This is a single-page demo app + library. The relevant scaling constraint is the GPU region budget.

| Scenario | Architecture Adjustment |
|----------|--------------------------|
| 0–5 controls visible simultaneously | No issue. Well within `MAX_GLASS_REGIONS = 16`. |
| 6–12 controls visible | Approaching limit. Controls using multiple regions (slider = 3, stepper = 3) count against budget. |
| 12–16 controls visible | Near the limit. Requires careful counting. |
| 16+ controls visible | Exceeds the hard limit. **Must** use section virtualization so off-screen sections do not mount glass regions. |

### GPU Region Budget for Showcase

The showcase page will have 8+ sections, each with multiple control instances. If all sections mount simultaneously, the region budget will be exceeded.

**Recommended mitigation: `IntersectionObserver`-based section virtualization.** Wrap each `<section>` in a component that conditionally renders its children only when the section is within a 1-viewport-height proximity of the current scroll position. Controls that are unmounted release their GPU regions via `useGlassRegion`'s cleanup effect (`handle.remove()` + `ctx.unregisterRegion(handle.id)`).

A lightweight `useIntersectionObserver(rootMargin: '100%')` hook provides the proximity flag without any library dependency.

Alternatively: increasing `MAX_GLASS_REGIONS` beyond 16 is a one-line change in `GlassRenderer.ts` and `glass.wgsl` (the uniform buffer stride calculation). The GPU uniform buffer would grow to `N * 256` bytes. Up to 32–64 regions is well within WebGPU limits.

---

## Anti-Patterns

### Anti-Pattern 1: Controls Calling `useGlassRegion` Directly

**What people do:** Build a new control by calling `useGlassRegion(ref, props)` directly inside the control component, bypassing `GlassPanel` or `GlassButton`.

**Why it's wrong:** Duplicates the accessibility override logic (reduced-transparency, dark/light defaults, morph speed), dark/light tint defaults, and all future changes to these defaults. A tuning update to default `blur` or `aberration` in `useGlassRegion` propagates to all primitives but not to direct-call controls.

**Do this instead:** Compose `GlassPanel` or `GlassButton` as the glass surface. If neither element type fits (e.g., a `<span>` or `<li>` is needed), consider adding a new primitive (e.g., `GlassSurface` without a semantic element) rather than calling `useGlassRegion` raw inside a high-level widget.

### Anti-Pattern 2: Global State Store for Showcase Demo Values

**What people do:** Put all showcase interactive state in a React context, Zustand store, or Redux slice — `showcaseState.wifiEnabled`, `showcaseState.volume`, etc.

**Why it's wrong:** Couples all sections together. A state update in `TogglesSection` causes re-renders in `SlidersSection`. For 30+ controls, this produces unnecessary re-render cascades on every user interaction.

**Do this instead:** Each showcase section holds its own local `useState`. Sections are fully independent React subtrees. The only shared state at the `ShowcasePage` level is `tuningDrawerOpen`.

### Anti-Pattern 3: Mounting All Sections on Page Load

**What people do:** Render all showcase sections unconditionally when the page loads, mounting every control and registering all GPU regions at startup.

**Why it's wrong:** 8 sections × ~4 glass primitives per section = ~32 GPU regions, double the `MAX_GLASS_REGIONS = 16` limit. Exceeding this silently drops regions from the render (no error, just missing glass effects on some controls).

**Do this instead:** Use `IntersectionObserver` to mount section children only when the section is near the viewport. React's unmount cleanup in `useGlassRegion` automatically releases GPU regions when a section scrolls far away. This keeps the simultaneously-active region count within budget at all scroll positions.

### Anti-Pattern 4: React Router for Section Navigation

**What people do:** Add `react-router-dom` and define routes like `/showcase/buttons`, `/showcase/sliders` to allow deep-linking into showcase sections.

**Why it's wrong:** Unnecessary dependency for a scroll-based single-page demo. Router adds complexity, changes URL behavior, and complicates state preservation in the tuning drawer across navigation events.

**Do this instead:** Use anchor-based in-page navigation. Section elements get `id="buttons-section"`, header nav uses `href="#buttons-section"`, CSS provides `scroll-margin-top` to account for the sticky header. For animated scroll: `document.getElementById('buttons-section')?.scrollIntoView({ behavior: 'smooth' })`. No router needed.

### Anti-Pattern 5: Deleting the Existing Tuning Page

**What people do:** Remove the existing tuning UI components to simplify the codebase when building the showcase.

**Why it's wrong:** The tuning page is the primary developer tool for adjusting the 16 shader parameters per region. It is also the interface that drives the coordinate-descent auto-tuner (`npm run tune`). Deleting it removes critical workflow capability.

**Do this instead:** Move the tuning UI into a `TuningDrawer` — a right-side slide-in panel triggered by a settings icon in the showcase header. The tuning UI component itself is preserved; only a shell wrapper is added. The drawer is always-mounted but hidden via CSS transform.

---

## Integration Points

### Composing with Existing Primitives

| Boundary | Communication | Notes |
|----------|---------------|-------|
| New control → `GlassPanel` | Component composition — control renders `GlassPanel` as child/wrapper | GlassPanel self-registers region; control passes GlassStyleProps through to customize the glass appearance |
| New control → `GlassButton` | Component composition — interactive surfaces use GlassButton | GlassButton handles hover/active morph state internally; no extra work for control authors |
| New control → `useGlassEngine()` | Direct hook call only if control needs `preferences.darkMode` for text color outside of a GlassPanel | GlassPanel's built-in `textStyles` already handles dark/light mode text — most controls won't need this |

### Portal Controls and GlassRenderer

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `GlassModal` / `GlassPopover` (portal) → `GlassRenderer` | `GlassPanel` inside portal registers region via `GlassContext` normally | Portal elements are in the DOM; `getBoundingClientRect()` returns correct viewport coordinates; glass effect renders correctly |
| `GlassPopover` → anchor element | `useOverlayPosition(anchorRef)` reads `anchorRef.current.getBoundingClientRect()` and returns CSS position values | Must recompute on scroll and window resize; `ResizeObserver` on anchor element handles this |

### TuningDrawer and Existing Tuning State

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `TuningDrawer` → existing tuning UI | Shell wrapper with CSS transform — the existing tuning component is a direct child | Tuning state is internal to the tuning component; the drawer only controls its visibility. No props or callbacks needed beyond `open` boolean. |
| `ShowcasePage` → `TuningDrawer` | `tuningDrawerOpen: boolean` prop from ShowcasePage's useState | Minimal coupling — ShowcasePage owns the toggle, TuningDrawer receives it |

### Public API Additions to `src/index.ts`

```typescript
// New additions alongside unchanged v3.0 exports:
export { GlassToggle } from './components/controls/GlassToggle';
export { GlassSlider } from './components/controls/GlassSlider';
export { GlassSegmentedControl } from './components/controls/GlassSegmentedControl';
export { GlassStepper } from './components/controls/GlassStepper';
export { GlassChip } from './components/controls/GlassChip';
export { GlassModal } from './components/controls/GlassModal';
export { GlassPopover } from './components/controls/GlassPopover';
export { GlassInput } from './components/controls/GlassInput';
// Type exports:
export type {
  GlassToggleProps,
  GlassSliderProps,
  GlassSegmentedControlProps,
  GlassStepperProps,
  GlassChipProps,
  GlassModalProps,
  GlassPopoverProps,
  GlassInputProps,
} from './components/controls/index';
```

The showcase page components (`ShowcasePage`, `TuningDrawer`, sections) are **not** exported from `index.ts` — they are application code, not library code.

---

## Sources

- Live codebase direct read: `src/components/GlassPanel.tsx`, `GlassButton.tsx`, `GlassProvider.tsx`, `context/GlassContext.ts`, `hooks/useGlassRegion.ts`, `renderer/GlassRenderer.ts` — primary source for integration point analysis, region budget, cleanup patterns (HIGH confidence)
- `.planning/PROJECT.md` — v4.0 milestone goals, active requirements, key architecture decisions table (HIGH confidence)
- React 19 `ReactDOM.createPortal` — stable API since React 16; portal elements in DOM, events delegate normally (HIGH confidence)
- `IntersectionObserver` MDN — browser-native API, widely supported (Chrome 51+, Safari 12.1+); no library needed (HIGH confidence)
- `GlassRegionState.ts` `MAX_GLASS_REGIONS = 16` constant in `GlassRenderer.ts` — direct codebase read confirming region budget (HIGH confidence)

---

*Architecture research for: Apple Liquid Glass v4.0 Control Library and Showcase Page*
*Researched: 2026-03-25*

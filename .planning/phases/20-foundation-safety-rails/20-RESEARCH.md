# Phase 20: Foundation & Safety Rails - Research

**Researched:** 2026-03-25
**Domain:** GPU region budget management, React context primitive design, Apple design tokens, dependency integration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Region budget strategy**
- Raise MAX_GLASS_REGIONS from 16 to 32 in GlassRenderer.ts (line 10)
- Update uniform buffer allocation: `(32 + 1) * 256 = 8448 bytes`
- Add overflow guard in addRegion(): if regions.size >= MAX_GLASS_REGIONS, throw an error (hard fail, not warning)
- No-op handle NOT returned — error forces developer to fix layout or use virtualization
- IntersectionObserver virtualization deferred to Phase 25 (showcase page concern, not foundation)

**GlassEffectContainer scope**
- Full implementation, not a stub — morph animations, shared styling, region pooling
- Claude's discretion on the exact API design and internal architecture
- Must provide shared morph ID namespace for coordinated animations (e.g., button → sheet transitions)
- Should be usable as a logical grouping container for composite controls

**Design token granularity**
- Control dimensions (sizes, padding per control type) + spacing scale + corner radii
- NOT full color palette or typography (glass pipeline handles color; system font stack handles type)
- TypeScript const objects (type-safe, tree-shakeable), NOT CSS custom properties
- Matches existing v3.0 pattern (as-const token objects)
- Tokens: APPLE_CONTROL_SIZES, APPLE_SPACING, APPLE_RADII at minimum

**Dependency integration**
- Install ALL dependencies upfront in this phase (one clean npm install):
  - `motion` ^12.38.0
  - `@radix-ui/react-switch`, `@radix-ui/react-slider`, `@radix-ui/react-toggle-group`, `@radix-ui/react-dialog`, `@radix-ui/react-popover`, `@radix-ui/react-tooltip`, `@radix-ui/react-select`
- Smoke test: spring animation on existing GlassPanel + Radix Switch renders without errors
- Build must pass with zero errors after installation

### Claude's Discretion
- GlassEffectContainer internal architecture and React context design
- Exact Apple HIG dimensions (calibrate against iOS Simulator reference)
- Smoke test component structure and location
- Whether to add `motion` as a peer dependency or direct dependency

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FND-01 | GlassEffectContainer primitive provides shared sampling region and morph ID grouping for child controls | GlassContext pattern, morphLerp infrastructure in GlassRegionState.ts, React context design |
| FND-02 | MAX_GLASS_REGIONS increased from 16 to 32 with addRegion() guard preventing overflow | Exact code locations in GlassRenderer.ts (line 10, line 128); buffer math documented |
| FND-03 | Apple design tokens (spacing, radii, control sizes) defined as TypeScript const objects | Existing project convention from STACK.md; iOS Simulator reference values documented |
</phase_requirements>

---

## Summary

Phase 20 is a pure infrastructure phase — no visual output beyond a smoke test. All three deliverables (region budget increase, GlassEffectContainer, design tokens) must exist before Phases 21-24 can build controls safely. The work is almost entirely additive: two lines change in GlassRenderer.ts, one new component file, one new token file, and package.json gains nine new entries.

The region budget change is the highest-risk task despite being mechanically simple. The uniform buffer is allocated at init time; growing it requires a `device.createBuffer()` call with the new size, which happens in `GlassRenderer.init()` (line 127-130). The buffer allocation is at `(MAX_GLASS_REGIONS + 1) * UNIFORM_STRIDE` — changing `MAX_GLASS_REGIONS` from 16 to 32 is line 10, and the buffer recalculates automatically from the constant. No shader changes are needed; the WGSL render loop iterates over `this.regions.Map` entries at draw time and uses dynamic buffer offsets per region. The overflow guard belongs in `addRegion()` before the `this.regions.set(id, region)` call at line 187.

GlassEffectContainer is architecturally novel in the web context: Apple's SwiftUI version ensures multiple glass elements share one background-sampling region, reducing GPU memory and enabling morphing transitions. The web equivalent cannot share actual GPU sampling (each GlassPanel gets its own region registered with GlassRenderer), but it can provide a shared React context that (1) namespaces morph IDs so coordinated animations know they belong to the same group, and (2) provides shared default props (glassprops) for visual coherence across children. The full implementation must include motion's `AnimatePresence` support for mount/unmount morph transitions.

**Primary recommendation:** Three sequential tasks: (1) bump region budget + add guard, (2) install deps + smoke test, (3) create tokens file + GlassEffectContainer. The budget fix is prerequisite to everything; deps must be installed before the smoke test GlassEffectContainer can reference `motion`. Tokens and GlassEffectContainer can be a single task.

---

## Standard Stack

### Core — Phase 20 New Additions

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `motion` | ^12.38.0 | Spring animations, layout morph, AnimatePresence | Required for Apple-authentic spring physics; `layoutId` is the only viable mechanism for segmented control indicator morph |
| `@radix-ui/react-switch` | ^1.2.6 | WAI-ARIA switch role for GlassToggle (Phase 21) | Install now, use Phase 21 — one clean npm install |
| `@radix-ui/react-slider` | ^1.3.6 | Range slider ARIA for GlassSlider (Phase 21) | Install now, use Phase 21 |
| `@radix-ui/react-toggle-group` | ^1.1.11 | Roving tabindex for GlassSegmentedControl (Phase 21) | Install now, use Phase 21 |
| `@radix-ui/react-dialog` | ^1.1.15 | Focus trap + portal for overlays (Phase 24) | Install now, use Phase 24 |
| `@radix-ui/react-popover` | ^1.1.15 | Anchor positioning for GlassPopover (Phase 24) | Install now, use Phase 24 |
| `@radix-ui/react-tooltip` | ^1.2.8 | Hover/focus tooltip with delay | Install now, use Phase 22-24 |
| `@radix-ui/react-select` | ^2.2.6 | Keyboard-navigable select picker | Install now, use Phase 22 |

### Existing Stack (Unchanged — Do Not Re-research)

| Library | Version | Purpose |
|---------|---------|---------|
| React | 19.2.4 | Peer dep |
| Vite | 6.4.1 | Build + dev server |
| TypeScript | 5.7+ | Strict mode |
| Vitest | ^4.1.1 | Unit tests |
| Playwright | ^1.58.2 | E2E tests |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `motion` as direct dep | `motion` as peer dep | Peer dep puts version management on consumers; direct dep controls the version lock — correct for a library that ships animations as part of its behavior |
| Throw error on overflow | Return no-op handle + console.warn | No-op handle allows silent rendering corruption; throw forces developer awareness at component mount time, which is earlier and more debuggable |
| TypeScript const objects for tokens | CSS custom properties | CSS custom props cannot be consumed in TypeScript code without re-declaring constants; const objects are tree-shakeable and type-safe |

**Installation:**
```bash
npm install motion @radix-ui/react-switch @radix-ui/react-slider @radix-ui/react-toggle-group @radix-ui/react-dialog @radix-ui/react-popover @radix-ui/react-tooltip @radix-ui/react-select
```

---

## Architecture Patterns

### Existing Codebase — Exact Edit Locations

**FND-02: GlassRenderer.ts budget increase**

```
src/renderer/GlassRenderer.ts
  Line 10:  const MAX_GLASS_REGIONS = 16;           → change to 32
  Line 128: size: (MAX_GLASS_REGIONS + 1) * UNIFORM_STRIDE   → recalculates automatically
  Line 171-188: addRegion() method — add guard before regions.set()
```

Current `addRegion()` (line 171-188):
```typescript
addRegion(element: HTMLElement, initialUniforms?: Partial<GlassUniforms>): number {
  const id = this.nextId++;
  const uniforms: GlassUniforms = { ... };
  const region: GlassRegionState = { ... };
  this.regions.set(id, region);  // ← guard goes HERE, before this line
  return id;
}
```

After the guard, `addRegion()` must throw rather than return a sentinel. The call path is:
`GlassProvider.registerRegion()` → `renderer.addRegion()` → `GlassContext.registerRegion()` → `useGlassRegion` useEffect → `GlassPanel`/`GlassButton` mount.

The error will surface as an unhandled exception during component mount. This is intentional — it is visible in the console with a stack trace pointing to the component that exceeded the limit.

**Buffer math verification:**
- Current: `(16 + 1) * 256 = 4352 bytes`
- New: `(32 + 1) * 256 = 8448 bytes`
- WebGPU buffer creation: `device.createBuffer({ size: 8448, ... })` — well within WebGPU limits
- No WGSL shader changes required — the shader uses dynamic offsets and iterates `this.regions` at draw time

### Recommended Project Structure — New Files for Phase 20

```
src/
├── tokens/
│   └── apple.ts             # APPLE_CONTROL_SIZES, APPLE_SPACING, APPLE_RADII
├── components/
│   ├── GlassEffectContainer.tsx  # New coordination primitive
│   └── [existing unchanged]
└── [existing unchanged]
```

Note: CONTEXT.md line 82 specifies `src/tokens/` directory. ARCHITECTURE.md specifies `src/showcase/tokens.ts`. The CONTEXT.md decision takes precedence as the locked decision — use `src/tokens/apple.ts` so tokens are importable from the library itself (exported from `src/index.ts`), not buried in a showcase subfolder. Design tokens are a public library concern, not showcase-only.

### Pattern 1: GlassEffectContainer — React Context for Morph ID Grouping

**What:** A React component that provides a context value to descendant glass controls. The context carries:
1. A container ID (stable UUID or incrementing ID) that identifies this morph group
2. A shared `defaultGlassProps` for visual coherence of children
3. An optional `AnimatePresence` wrapper for mount/unmount transitions

**When to use:** Whenever multiple glass surfaces are coordinated — an action sheet triggered by a button, a set of controls in the same card, FAB → radial menu expansion.

**Architecture approach (Claude's discretion area):**

```typescript
// src/context/GlassEffectContext.ts
interface GlassEffectContextValue {
  containerId: string;         // stable ID for this group
  defaultProps?: GlassStyleProps; // shared glass defaults for children
}
export const GlassEffectContext = createContext<GlassEffectContextValue | null>(null);

// src/components/GlassEffectContainer.tsx
interface GlassEffectContainerProps {
  children: React.ReactNode;
  id?: string;                    // optional stable ID for layoutId coordination
  defaultGlassProps?: GlassStyleProps; // propagated to child controls
  animate?: boolean;              // wrap children in AnimatePresence (default: true)
  style?: React.CSSProperties;
  className?: string;
}
```

**Key design decisions:**
- The container itself does NOT register a GPU region (it is a logical grouper, not a glass surface)
- Child controls that consume `GlassEffectContext` can prefix their `motion` `layoutId` with `containerId` to ensure layout morphing stays within the container's group
- `animate={true}` wraps children in `<AnimatePresence>` for enter/exit transitions
- The container is a plain `<div>` (or `React.Fragment`) — no GPU involvement at the container level

**Why not share a single GPU region for all children:** The glass shader draws each region independently with its own rect UV. Sharing one region for multiple physically-separated controls would produce incorrect refraction (the glass UV would be wrong for elements outside the sampling rect). The coordination is at the animation/styling layer, not the GPU layer.

### Pattern 2: Design Tokens as TypeScript Const Objects

**What:** `as const` TypeScript objects at `src/tokens/apple.ts`. These are plain numbers — no runtime dependency, fully tree-shakeable, typed via `typeof APPLE_SPACING[keyof typeof APPLE_SPACING]`.

**Token values (LOW confidence — calibrate against iOS Simulator):**

```typescript
// src/tokens/apple.ts
// Source: community reference implementations (confer iOS Simulator before finalizing)
export const APPLE_SPACING = {
  xs:    4,
  sm:    8,
  md:   16,
  lg:   20,
  xl:   24,
  xxl:  32,
  xxxl: 48,
} as const;

export const APPLE_RADII = {
  sm:   8,    // chip, badge
  md:   14,   // button, toggle track
  lg:   20,   // card, sheet header
  xl:   28,   // modal, bottom sheet
  pill: 9999, // full-capsule elements
} as const;

export const APPLE_CONTROL_SIZES = {
  // Toggle / Switch (iOS UISwitch)
  toggleWidth:    51,  // iOS logical pixels at 1x
  toggleHeight:   31,
  toggleThumbSize: 27, // diameter of glass thumb
  toggleThumbInset: 2, // gap from track edge to thumb edge

  // Slider
  sliderTrackHeight:  4,   // track bar height
  sliderThumbSize:   28,   // thumb diameter

  // Segmented Control
  segmentedHeight:   32,   // outer container height
  segmentedPadding:   2,   // inset for glass thumb pill within container

  // Standard tap target minimum (Apple HIG accessibility)
  minTapTarget:      44,   // 44x44 logical px minimum
} as const;
```

**IMPORTANT — Calibration note (LOW confidence on raw numbers):** Apple's HIG portal is JavaScript-gated and exact numerical specs are not publicly accessible. The values above are from community reference implementations (conorluddy/LiquidGlassReference, WWDC25 session screenshots). The iOS Simulator reference app in `ios-reference/` should be the authoritative source for final values. The planner should include a calibration step (run iOS Simulator, measure with Xcode view debugger) before committing token values.

### Pattern 3: Smoke Test Structure

**What:** A React component in `src/components/` (or `src/__tests__/`) that mounts `GlassPanel` with a `motion` spring animation and a `Radix.Switch` primitive. It verifies both libraries load without errors.

**Recommended location:** `src/components/SmokeTest.tsx` as a dev-only component rendered in `App.tsx` behind a `if (import.meta.env.DEV)` guard. Not exported from `src/index.ts`.

**Smoke test must verify:**
1. `motion/react` import resolves without error
2. `<motion.div animate={{ x: 10 }} transition={{ type: 'spring' }}>` renders
3. `@radix-ui/react-switch` import resolves without error
4. `<Switch.Root>` renders inside a GlassProvider (verifies no context conflicts)
5. `npm run build:lib` exits 0 (no TypeScript or bundle errors from new deps)

### Anti-Patterns to Avoid

- **Adding `motion` to `peerDependencies`:** The package.json currently declares `react` and `react-dom` as peer deps but all devtools as devDependencies. Since `motion` is consumed by exported components (Phase 21+), it must be a direct production dependency — consumers cannot be expected to install it separately.
- **Placing tokens in `src/showcase/tokens.ts`:** The showcase folder is not exported from `src/index.ts`. Design tokens are public library API and must be at `src/tokens/apple.ts` and exported from `src/index.ts`.
- **Changing `UNIFORM_STRIDE`:** The 256-byte stride is `minUniformBufferOffsetAlignment` from the WebGPU spec — it is NOT a configurable choice. Do not change it. Only `MAX_GLASS_REGIONS` changes.
- **Calling `renderer.addRegion()` directly from GlassEffectContainer:** The container should not register GPU regions. Let child GlassPanel/GlassButton components handle their own region registration as they always have.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Spring physics animation | Custom CSS keyframe calculator | `motion` `useSpring`, `animate` | Damped spring overshoot cannot be approximated with CSS `cubic-bezier` — requires per-frame integration |
| WAI-ARIA switch behavior | `onKeyDown` + `role="switch"` + `aria-checked` | `@radix-ui/react-switch` | ARIA switch pattern requires Space key toggle, correct `aria-checked` updates, label association — easy to get wrong in edge cases |
| Focus trap for dialogs | Manual tabbable element detection | `@radix-ui/react-dialog` | Focus trap is a known footgun: detecting all focusable elements, handling `inert`, restoring focus on close — 200+ lines of correctness-critical code |
| Layout morph animation | FLIP calculations + CSS transforms | `motion` `layoutId` | FLIP requires manual getBoundingClientRect diffs pre/post layout; `layoutId` handles this automatically including nested layout contexts |
| Anchor-relative positioning | Manual `getBoundingClientRect` + scroll offset math | `@radix-ui/react-popover` (Phase 24) | Radix handles flip/collision detection when popover would overflow viewport — complex edge cases |

**Key insight:** Accessibility primitives that handle keyboard patterns, focus management, and ARIA attributes look simple but have significant hidden complexity. The cost of incorrect ARIA is user harm for screen reader users, not just visual regression.

---

## Common Pitfalls

### Pitfall 1: Uniform Buffer Size Not Updated at Runtime

**What goes wrong:** Changing `MAX_GLASS_REGIONS` constant at the top of `GlassRenderer.ts` is necessary but not sufficient if the buffer allocation logic is somehow bypassed or cached.

**Why it happens:** `GlassRenderer.init()` is called once at startup. If the renderer is instantiated without re-init (e.g., hot module reload in Vite), the old buffer size may persist in memory.

**How to avoid:** After changing the constant, verify `(MAX_GLASS_REGIONS + 1) * UNIFORM_STRIDE` is the expression used in `device.createBuffer({ size: ... })` at line 128. The constant feeds the expression — no hardcoded byte count anywhere. Hard-restart the dev server after the change; do not rely on HMR for GPU resource changes.

**Warning signs:** `addRegion()` succeeds past index 16, but GPU reports a validation error about buffer offset out of bounds on draw.

### Pitfall 2: Overflow Guard in addRegion() vs. regions Map Size

**What goes wrong:** The guard checks `this.nextId` instead of `this.regions.size`, which would fail when regions have been removed (the nextId increments monotonically, so removed regions leave gaps).

**Why it happens:** Confusion between "how many IDs have been issued" and "how many regions are currently active."

**How to avoid:** Guard must check `this.regions.size >= MAX_GLASS_REGIONS`, not `this.nextId > MAX_GLASS_REGIONS`. The `regions` Map only contains currently-active regions (removeRegion deletes from it). This allows mounting and unmounting controls freely as long as the simultaneous count stays within budget.

**Correct guard:**
```typescript
addRegion(element: HTMLElement, initialUniforms?: Partial<GlassUniforms>): number {
  if (this.regions.size >= MAX_GLASS_REGIONS) {
    throw new Error(
      `GlassRenderer: MAX_GLASS_REGIONS (${MAX_GLASS_REGIONS}) exceeded. ` +
      `Currently ${this.regions.size} active regions. ` +
      `Unmount off-screen glass components or increase MAX_GLASS_REGIONS.`
    );
  }
  // ... rest of existing code
}
```

### Pitfall 3: motion Package Import Path

**What goes wrong:** Importing from `framer-motion` instead of `motion/react`.

**Why it happens:** `framer-motion` is the old package name. Many online tutorials and AI suggestions still use it. The API is identical but the package name changed.

**How to avoid:** Import from `motion/react`:
```typescript
import { motion, AnimatePresence, useSpring } from 'motion/react';
// NOT: import { motion } from 'framer-motion';
```

**Warning signs:** `Cannot find module 'framer-motion'` — install `motion`, not `framer-motion`.

### Pitfall 4: Radix Packages Requiring React Peer Dep Conflicts

**What goes wrong:** Radix packages declare React 16/17/18 peer deps; React 19 may produce peer dep warnings during install.

**Why it happens:** Some Radix packages have not updated their `peerDependencies` declaration to include React 19 even though they are runtime compatible.

**How to avoid:** Use `npm install --legacy-peer-deps` if peer dep conflicts arise. The Radix packages are fully compatible with React 19 at runtime. Add a note in package.json comments if `--legacy-peer-deps` was required.

**Verification:** After install, `npm ls react` should show only one copy of React (no deduplication issues).

### Pitfall 5: GlassEffectContainer Registering a GPU Region

**What goes wrong:** Wrapping GlassEffectContainer's inner div with `useGlassRegion` so the container itself has a glass effect.

**Why it happens:** It seems natural to make the container "glassy" since it groups glass children.

**How to avoid:** The container is a logical grouper only. It uses a plain `<div>` (or `<motion.div>` for entry animation). Its children are glass surfaces. Adding a GPU region to the container would consume one region slot plus create a glass-on-glass sampling artifact (the container would sample the same background as its children, but the children's glass surfaces would occlude the container's glass region in unpredictable ways).

### Pitfall 6: Token File Location Mismatch

**What goes wrong:** Placing `apple.ts` in `src/showcase/tokens.ts` per older architecture docs, which means it is not exported from `src/index.ts` and is not accessible to library consumers.

**Why it happens:** The ARCHITECTURE.md (pre-CONTEXT.md) suggested `src/showcase/tokens.ts`. The CONTEXT.md locked decision says the tokens are library primitives.

**How to avoid:** Use `src/tokens/apple.ts`. Export from `src/index.ts`:
```typescript
export { APPLE_SPACING, APPLE_RADII, APPLE_CONTROL_SIZES } from './tokens/apple';
```

---

## Code Examples

Verified patterns from the existing codebase:

### Existing Region Registration Pattern (useGlassRegion)
```typescript
// Source: src/hooks/useGlassRegion.ts lines 39-50
useEffect(() => {
  if (!ctx.ready || !elementRef.current) return;
  const handle = ctx.registerRegion(elementRef.current);
  handleRef.current = handle;
  return () => {
    if (handle) {
      handle.remove();
      ctx.unregisterRegion(handle.id);
    }
    handleRef.current = null;
  };
}, [ctx.ready, ctx, elementRef]);
```

### Existing addRegion() Method (Before Guard)
```typescript
// Source: src/renderer/GlassRenderer.ts lines 171-188
addRegion(element: HTMLElement, initialUniforms?: Partial<GlassUniforms>): number {
  const id = this.nextId++;
  const uniforms: GlassUniforms = {
    ...DEFAULT_GLASS_UNIFORMS,
    ...initialUniforms,
    tint: { ...DEFAULT_GLASS_UNIFORMS.tint, ...(initialUniforms?.tint ?? {}) },
    rect: { ...DEFAULT_GLASS_UNIFORMS.rect, ...(initialUniforms?.rect ?? {}) },
    resolution: { ...DEFAULT_GLASS_UNIFORMS.resolution, ...(initialUniforms?.resolution ?? {}) },
  };
  const region: GlassRegionState = {
    id,
    element,
    current: { ...uniforms, ... },
    target: { ...uniforms, ... },
    morphSpeed: 8,
  };
  this.regions.set(id, region);
  return id;
}
```

### Uniform Buffer Allocation (Line 127-129)
```typescript
// Source: src/renderer/GlassRenderer.ts lines 126-130
this.uniformBuffer = device.createBuffer({
  label: 'GlassRenderer uniforms',
  size: (MAX_GLASS_REGIONS + 1) * UNIFORM_STRIDE,  // recalculates from constant
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
```

### motion/react Import Pattern (Official Docs)
```typescript
// Source: motion.dev/docs/react
import { motion, AnimatePresence } from 'motion/react';

// Spring animation example (for smoke test):
<motion.div
  animate={{ x: 10 }}
  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
/>
```

### Radix Switch Composition Pattern
```typescript
// Source: radix-ui.com/primitives/docs/components/switch
import * as Switch from '@radix-ui/react-switch';

// asChild pattern — wraps GlassPanel as the accessible element
<Switch.Root asChild checked={checked} onCheckedChange={onChange}>
  <GlassPanel cornerRadius={16} style={{ width: 51, height: 31 }}>
    <Switch.Thumb asChild>
      <GlassButton cornerRadius={14} style={{ ... }} />
    </Switch.Thumb>
  </GlassPanel>
</Switch.Root>
```

### GlassContext Access Pattern (for GlassEffectContainer)
```typescript
// Source: src/components/GlassPanel.tsx lines 1-6
import { useGlassEngine } from '../hooks/useGlassEngine';
// ...
const { preferences } = useGlassEngine();
// GlassEffectContainer should similarly read preferences to pass default glass props
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `framer-motion` package | `motion` package (import from `motion/react`) | Motion v11 (2024) | Same API; must use new package name |
| `MAX_GLASS_REGIONS = 16` | `MAX_GLASS_REGIONS = 32` after this phase | Phase 20 | 2x region budget; 8448 byte uniform buffer |
| No overflow guard | Throw error on overflow | Phase 20 | Developer sees clear error instead of silent corruption |
| No design tokens | `APPLE_CONTROL_SIZES`, `APPLE_SPACING`, `APPLE_RADII` | Phase 20 | Controls use token values instead of hardcoded pixels |

**Deprecated/outdated:**
- `framer-motion`: Package name deprecated; replaced by `motion`. Import path is `motion/react` not `framer-motion`.

---

## Open Questions

1. **Exact iOS control dimensions**
   - What we know: Community implementations cite toggle 51×31px, slider track 4px, segmented height 32px
   - What's unclear: These are not from official Apple numerical spec (HIG is JS-gated)
   - Recommendation: Planner should include a calibration sub-task — open Xcode with the ios-reference app, use the view debugger to measure control frames at 1x logical resolution, then hard-code verified values into `APPLE_CONTROL_SIZES`

2. **motion as direct dependency vs. peer dependency**
   - What we know: Current package.json has React as peer dep. `motion` is consumed by exported components.
   - What's unclear: Whether this library intends consumers to install `motion` themselves
   - Recommendation: Add `motion` as a direct dependency (not peer). The library ships animated behavior as part of its value proposition — requiring consumers to separately install `motion` at a compatible version introduces unnecessary friction and version mismatch risk. This is Claude's discretion per CONTEXT.md.

3. **GlassEffectContainer React context depth**
   - What we know: Needs to provide morph ID namespace + shared default props
   - What's unclear: Whether the context should propagate through nested GlassEffectContainers (nested containers for child-within-child grouping)
   - Recommendation: Use a single flat context. Nested `GlassEffectContainer` elements create a new context scope (inner value wins), which is correct React behavior with `createContext`. No special nesting logic needed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.1 |
| Config file | `/Users/asekar/code/glass-react/vitest.config.ts` |
| Quick run command | `npx vitest run src/renderer/__tests__/ --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FND-02 | `addRegion()` throws when `regions.size >= 32` | unit | `npx vitest run src/renderer/__tests__/region-setters.test.ts -x` | ✅ (extend existing) |
| FND-02 | `MAX_GLASS_REGIONS` constant equals 32 | unit | `npx vitest run src/renderer/__tests__/uniforms.test.ts -x` | ✅ (extend existing) |
| FND-02 | Uniform buffer size is `(32+1)*256 = 8448` bytes | unit | `npx vitest run src/renderer/__tests__/uniforms.test.ts -x` | ✅ (extend existing) |
| FND-03 | `APPLE_CONTROL_SIZES.toggleWidth` equals 51 | unit | `npx vitest run src/tokens/__tests__/apple.test.ts -x` | ❌ Wave 0 |
| FND-03 | `APPLE_SPACING.md` equals 16 | unit | `npx vitest run src/tokens/__tests__/apple.test.ts -x` | ❌ Wave 0 |
| FND-01 | GlassEffectContainer renders children without error | unit | `npx vitest run src/components/__tests__/GlassEffectContainer.test.ts -x` | ❌ Wave 0 |
| FND-01 | GlassEffectContext value is accessible via useGlassEffect hook | unit | `npx vitest run src/components/__tests__/GlassEffectContainer.test.ts -x` | ❌ Wave 0 |
| FND-01,02,03 | Build passes with zero TypeScript errors | smoke | `npm run build:lib` | ✅ (existing CI) |
| All deps | motion + all Radix packages import without error | smoke | `npm run build:lib` | ✅ (after install) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/renderer/__tests__/ --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose && npm run build:lib`
- **Phase gate:** Full suite green + `npm run build:lib` exits 0 before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/tokens/__tests__/apple.test.ts` — covers FND-03 (token value assertions)
- [ ] `src/components/__tests__/GlassEffectContainer.test.ts` — covers FND-01 (render + context value)
- [ ] `src/renderer/__tests__/region-setters.test.ts` — extend with overflow guard test (check `throw` when size >= 32)

Note: The existing `src/renderer/__tests__/uniforms.test.ts` and `region-setters.test.ts` files exist and cover the GlassRenderer. New overflow guard test extends `region-setters.test.ts`. Token tests and GlassEffectContainer tests are new files. Vitest environment is `node` (see vitest.config.ts) — GlassEffectContainer tests will need to mock the `GlassContext` since WebGPU is unavailable in node environment.

---

## Sources

### Primary (HIGH confidence)
- Live codebase: `src/renderer/GlassRenderer.ts` — exact line numbers for MAX_GLASS_REGIONS (10), buffer allocation (127-130), addRegion() (171-188)
- Live codebase: `src/hooks/useGlassRegion.ts` — region registration and cleanup pattern
- Live codebase: `src/context/GlassContext.ts` — GlassContextValue interface, registerRegion signature
- Live codebase: `src/components/GlassProvider.tsx` — registerRegion implementation, buffer lifecycle
- Live codebase: `src/renderer/GlassRegionState.ts` — GlassUniforms struct, morphLerp, DEFAULT_GLASS_UNIFORMS
- Live codebase: `package.json` — existing dep structure (peer deps vs devDeps)
- Live codebase: `vitest.config.ts` — test framework config, environment: node, include pattern
- `.planning/phases/20-foundation-safety-rails/20-CONTEXT.md` — locked decisions
- `.planning/research/STACK.md` — verified npm versions (2026-03-25), motion/react import path, Radix version table
- `.planning/research/ARCHITECTURE.md` — component layer diagram, region topology per control

### Secondary (MEDIUM confidence)
- motion.dev/docs/react — `motion/react` import path, AnimatePresence API
- radix-ui.com/primitives/docs — Switch, Slider, Dialog, Popover asChild composition
- `.planning/research/SUMMARY.md` — executive summary, pitfall catalog

### Tertiary (LOW confidence)
- Apple HIG control dimensions (51×31 toggle, 4px slider, 32px segmented) — community reference implementations only; official spec is JS-gated. **Requires iOS Simulator calibration before finalizing.**

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all package versions npm-verified 2026-03-25 per STACK.md; `motion/react` import path confirmed from official docs
- Architecture: HIGH — all edit locations derived from direct codebase read; exact line numbers verified
- Pitfalls: HIGH (GPU/buffer), MEDIUM (token dimensions) — GPU pitfalls from source analysis; token values from community sources pending iOS Simulator calibration
- GlassEffectContainer design: MEDIUM — architecturally novel in this project; no established web precedent for SwiftUI GlassEffectContainer equivalent; design is sound but untested against Phase 24 morph requirements

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable deps; motion and Radix change slowly)

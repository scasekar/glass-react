# Phase 22: Core Discrete Controls - Research

**Researched:** 2026-03-25
**Domain:** React glass control components — chip, stepper, input — composing GlassPanel/GlassButton primitives with WAI-ARIA accessibility
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CTRL-04 | GlassChip renders as a selectable tag/filter pill with glass background | GlassButton composition pattern; toggle-group ARIA role; pressed/selected state via `aria-pressed`; APPLE_RADII.pill for capsule shape |
| CTRL-05 | GlassStepper renders +/- increment control with glass button surfaces, min/max clamping | Two GlassButton instances + GlassPanel display; native number constraints via `clamp()`; `role="group"` + `aria-label`; `aria-live="polite"` for value announcements |
| CTRL-06 | GlassInput renders text field with glass border and focus state (focus ring + glass intensity change) | GlassPanel wrapping native `<input>`; focus state drives `specular`/`rim` prop change; focus ring via CSS `outline`; no Radix dependency needed |
</phase_requirements>

---

## Summary

Phase 22 delivers three controls — GlassChip, GlassStepper, and GlassInput — that complete the core discrete control palette. All three are Layer 1 controls (no inter-control dependencies) that compose existing `GlassPanel` and `GlassButton` primitives. None require spring animations from `motion` as their primary behavior; the interaction patterns are simpler than Phase 21's toggle/slider/segmented controls.

The critical insight for this phase: none of the three Phase 22 controls have dedicated Radix UI primitives installed. GlassChip maps most naturally to a toggle button pattern (`aria-pressed`). GlassStepper is a numeric spinner group — WAI-ARIA has a `spinbutton` role but it is implemented directly on a native `<input type="number">` or on the stepper's value display. GlassInput wraps a native `<input>` element inside a GlassPanel, relying on HTML's built-in input semantics — no Radix needed.

The GPU region budget is the key constraint. GlassStepper uses 3 regions (minus GlassButton + display GlassPanel + plus GlassButton). A showcase section with multiple steppers and chips can approach the limit quickly. Glass mask stability during focus transitions (GlassInput) requires that only the outer GlassPanel is a registered region — the native `<input>` inside must not get its own region.

**Primary recommendation:** Build all three controls as thin functional wrappers over GlassPanel/GlassButton, following the exact GlassButton hover/active state pattern for interactive glass parameter updates. Use native HTML semantics first (native `<input>`, `aria-pressed`, `role="spinbutton"`) rather than adding Radix dependencies that aren't installed.

---

## Standard Stack

### Core (all already installed and verified in package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `motion` | ^12.38.0 | Optional press animation on GlassChip | Already installed; used for GlassButton spring press if desired; LOW priority for chip |
| React 19 | (project dependency) | Component model, hooks | Project standard |
| TypeScript strict | (project tsconfig) | Type safety | Project standard |
| Inline styles | (project convention) | Glass parameter prop-driven styling | Required for glass parameterization |
| `APPLE_RADII`, `APPLE_SPACING`, `APPLE_CONTROL_SIZES` | `src/tokens/apple.ts` | Design tokens | Already defined in Phase 20 |

### No New Dependencies Required

All three Phase 22 controls can be built without installing any new packages:

| Control | Why No New Dep Needed |
|---------|----------------------|
| GlassChip | Native `<button>` with `aria-pressed`; toggle button semantics are simple HTML |
| GlassStepper | Native `<input type="number">` hidden or GlassPanel display + two GlassButton; `role="spinbutton"` on value display |
| GlassInput | Native `<input>` inside GlassPanel; HTML input already has all ARIA semantics |

**Explicitly NOT needed for Phase 22:**
- `@radix-ui/react-toggle` — GlassChip's toggle-button semantics are trivial with native `aria-pressed`
- `@radix-ui/react-toggle-group` — Not needed unless building a chip group with roving tabindex (out of scope for CTRL-04 single chip)
- Any new npm package install

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `aria-pressed` on `<button>` | `@radix-ui/react-toggle` | Radix adds focus management edge cases beyond single toggle; native is sufficient for a single chip |
| Native `<input type="number">` (hidden) | Build custom value display + aria-spinbutton | Either approach works; hiding native input behind the GlassPanel display is simpler and gives free keyboard behavior |
| Native `<input>` inside GlassPanel | `@radix-ui/react-label` | Plain `<label htmlFor>` association works without Radix |

---

## Architecture Patterns

### Recommended Project Structure

```
src/components/controls/
├── GlassChip.tsx          # NEW: selectable pill — GlassButton variant with aria-pressed
├── GlassStepper.tsx       # NEW: +/- counter — two GlassButton + GlassPanel display
├── GlassInput.tsx         # NEW: text field — GlassPanel wrapping native <input>
└── index.ts               # barrel export (create in this phase if not from Phase 21)
```

Controls are exported from `src/index.ts` alongside existing primitives.

### GPU Region Budget for Phase 22

| Control | Regions Used | Notes |
|---------|-------------|-------|
| GlassChip | 1 (GlassButton) | Lowest budget cost of all v4.0 controls |
| GlassStepper | 3 (minus GlassButton + value GlassPanel + plus GlassButton) | Same budget as GlassSlider |
| GlassInput | 1 (outer GlassPanel only) | Native `<input>` inside does NOT get its own region |

MAX_GLASS_REGIONS was raised to 32 in Phase 20 (FND-02 complete). Budget is not a concern for a modest showcase section with a few instances of each.

### Pattern 1: GlassChip — GlassButton Variant with Toggle State

**What:** GlassChip is a styled GlassButton that maintains selected/unselected state. When selected, it increases `opacity` and `specular` to appear more prominent. It uses `aria-pressed` to communicate toggle state to screen readers. The glass parameters shift on selection to give visible feedback beyond color alone.

**When to use:** Selectable filter tags, category pills, multi-select option chips.

**Key implementation notes:**
- Use `APPLE_RADII.pill` (9999) for capsule shape
- Use `APPLE_SPACING.sm` (8) for horizontal padding, `APPLE_SPACING.xs` (4) for vertical
- Minimum height: `APPLE_CONTROL_SIZES.minTapTarget` (44px) per Apple HIG accessibility guidelines — OR make the tap target 44px with padding while the visual chip is shorter
- Selected state: increase `opacity` to ~0.18 (from default ~0.08 dark mode), increase `specular` to ~0.2 (from default ~0.08), optionally add a subtle tint matching the app accent color
- Unselected state: standard GlassButton defaults
- `aria-pressed={selected}` on the button element
- Does not need `role` attribute — it renders as a `<button>` which has implicit button role

**Example:**
```typescript
// Source: GlassButton pattern (src/components/GlassButton.tsx) + CTRL-04 requirement
export function GlassChip({ label, selected, onToggle, disabled }: GlassChipProps) {
  const [hovered, setHovered] = useState(false);

  const effectiveOpacity = selected ? 0.18 : undefined;          // override default ~0.08
  const effectiveSpecular = selected ? 0.2 : (hovered ? 0.16 : undefined);
  const effectiveRim = selected ? 0.2 : undefined;

  return (
    <GlassButton
      cornerRadius={APPLE_RADII.pill}
      opacity={effectiveOpacity}
      specular={effectiveSpecular}
      rim={effectiveRim}
      aria-pressed={selected}
      onClick={() => onToggle(!selected)}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        paddingInline: APPLE_SPACING.sm,
        paddingBlock: APPLE_SPACING.xs,
        minHeight: APPLE_CONTROL_SIZES.minTapTarget,
        fontSize: 14,
        fontWeight: 500,
      }}
    >
      {label}
    </GlassButton>
  );
}
```

### Pattern 2: GlassStepper — Two GlassButtons + GlassPanel Display

**What:** GlassStepper groups three elements: a decrement GlassButton, a read-only value GlassPanel (or plain styled div), and an increment GlassButton. The outer container uses `role="group"` with `aria-label`. The value is clamped between `min` and `max`. Buttons are disabled at their respective limits and use `aria-disabled` accordingly.

**When to use:** Quantity selectors, numeric input with bounded range.

**Key implementation notes:**
- Outer `<div>` with `role="group"` and `aria-label` (e.g., "Quantity stepper")
- Decrement button: GlassButton with "−" or a minus SVG icon; `aria-label="Decrease"`, `disabled={value <= min}`
- Value display: GlassPanel or plain `<output>` element; use `<output>` for semantic correctness (it is an ARIA live region by default); set `aria-atomic="true"`
- Increment button: GlassButton with "+" or plus SVG icon; `aria-label="Increase"`, `disabled={value >= max}`
- Value change: `Math.min(max, Math.max(min, value + step))` — clamp on every update
- Keyboard: Tab focuses each button independently; buttons respond to Space/Enter normally
- Screen reader announcement: `<output>` reads value on change; add `aria-label` to output for context (e.g., "Current value: 3")
- No spring animation needed — value display is a number, not a visual morphing element

**Example:**
```typescript
// Source: Architecture pattern from ARCHITECTURE.md + WAI-ARIA spinbutton/group best practices
export function GlassStepper({
  value, onChange, min = 0, max = 10, step = 1, label
}: GlassStepperProps) {
  const decrement = () => onChange(Math.max(min, value - step));
  const increment = () => onChange(Math.min(max, value + step));

  return (
    <div role="group" aria-label={label ?? 'Stepper'} style={{ display: 'flex', alignItems: 'center', gap: APPLE_SPACING.xs }}>
      <GlassButton
        cornerRadius={APPLE_RADII.pill}
        aria-label="Decrease"
        disabled={value <= min}
        onClick={decrement}
        style={{ width: 36, height: 36 }}
      >
        −
      </GlassButton>
      <output aria-label={`${label ?? 'Value'}: ${value}`} aria-atomic="true">
        <GlassPanel cornerRadius={APPLE_RADII.sm} style={{ minWidth: 40, textAlign: 'center', padding: `${APPLE_SPACING.xs}px ${APPLE_SPACING.sm}px` }}>
          {value}
        </GlassPanel>
      </output>
      <GlassButton
        cornerRadius={APPLE_RADII.pill}
        aria-label="Increase"
        disabled={value >= max}
        onClick={increment}
        style={{ width: 36, height: 36 }}
      >
        +
      </GlassButton>
    </div>
  );
}
```

### Pattern 3: GlassInput — GlassPanel Wrapping Native Input

**What:** GlassInput renders a GlassPanel as a container and places a native `<input>` inside it. Focus state is tracked with React state and drives changes to the GlassPanel's `specular` and `rim` props, which flow through `useGlassRegion`'s sync effect, causing the glass renderer to update the region's appearance. A visible CSS `outline` or `box-shadow` provides the focus ring for keyboard users.

**Key implementation notes:**
- The GlassPanel is the registered GPU region — not the native `<input>`. The native input has `background: transparent` and no border.
- Focus detection: `onFocus`/`onBlur` on the native `<input>` drives a `focused` boolean in React state
- On focus: increase GlassPanel's `specular` (e.g., 0.08 → 0.2) and `rim` (e.g., 0.15 → 0.25) by passing new prop values; the GlassPanel's `useGlassRegion` sync effect updates the renderer automatically
- Focus ring: add CSS `outline: 2px solid rgba(255,255,255,0.6)` on the GlassPanel's `style` when focused, OR use a separate CSS `box-shadow` layer — do NOT rely on the WebGPU rim lighting alone for focus visibility (accessibility requirement: 3:1 contrast ratio minimum for focus indicator per WCAG 2.1 SC 1.4.11)
- `<label>` association: require a `label` prop; render a `<label htmlFor={inputId}>` outside the GlassPanel, or pass `aria-label` directly to the input
- Placeholder: use the native `placeholder` attribute — no custom implementation needed
- `type` prop: pass through to native input for email/password/search variants
- Glass mask stability: the GlassPanel's CSS layout must not resize when the input receives focus (avoid padding/border changes that shift DOM geometry). Only change glass shader parameters, not box dimensions.

**Example:**
```typescript
// Source: GlassPanel composition pattern (src/components/GlassPanel.tsx) + WCAG 2.1 focus requirements
export function GlassInput({ label, value, onChange, placeholder, type = 'text', id }: GlassInputProps) {
  const inputId = id ?? useId();
  const [focused, setFocused] = useState(false);

  // Glass parameter shift on focus — flows through useGlassRegion sync effect
  const glassSpecular = focused ? 0.22 : undefined;   // defaults to ~0.08
  const glassRim      = focused ? 0.28 : undefined;   // defaults to ~0.15

  return (
    <div>
      {label && <label htmlFor={inputId} style={{ display: 'block', marginBottom: APPLE_SPACING.xs }}>{label}</label>}
      <GlassPanel
        cornerRadius={APPLE_RADII.md}
        specular={glassSpecular}
        rim={glassRim}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: `${APPLE_SPACING.xs}px ${APPLE_SPACING.sm}px`,
          // Visible focus ring via CSS — required for WCAG SC 1.4.11
          outline: focused ? '2px solid rgba(255,255,255,0.65)' : '2px solid transparent',
          outlineOffset: 2,
          transition: 'outline-color 0.15s',
        }}
      >
        <input
          id={inputId}
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            width: '100%',
            color: 'inherit',
            fontSize: 16,
          }}
        />
      </GlassPanel>
    </div>
  );
}
```

### Anti-Patterns to Avoid

- **Giving the native `<input>` inside GlassInput its own glass region:** The input is a 0px-border transparent element inside the GlassPanel. Wrapping it in a second GlassPanel wastes a region and causes mask overlap artifacts.
- **Changing the GlassPanel dimensions on focus:** If the GlassPanel's padding or size changes on focus, the glass mask moves one rAF behind the visual layout. Keep dimensions stable; change only shader parameters (specular, rim) on focus.
- **Using `role="spinbutton"` on a div for GlassStepper without an accessible value:** `role="spinbutton"` requires `aria-valuenow`, `aria-valuemin`, `aria-valuemax`. Using the `<output>` + `role="group"` pattern is simpler and avoids needing to manage these attributes manually.
- **Calling `useGlassRegion` directly inside GlassChip/GlassStepper/GlassInput instead of composing GlassPanel/GlassButton:** Duplicates the accessibility override logic (reducedTransparency guard) and default values. Always compose primitives.
- **Hardcoding pixel values instead of using APPLE_RADII, APPLE_SPACING, APPLE_CONTROL_SIZES:** The tokens are already defined in `src/tokens/apple.ts` (Phase 20 complete). All dimension values MUST reference these tokens.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Glass region registration and sync | Custom `useEffect` calling `GlassRenderer.addRegion()` | `GlassPanel` or `GlassButton` (which call `useGlassRegion` internally) | Duplicates reducedTransparency guard, dark/light defaults, morph speed, all future primitive changes |
| Focus ring visibility | Custom SVG ring or shader-only rim lighting | CSS `outline` on the GlassPanel's style | WCAG SC 1.4.11 requires 3:1 contrast; CSS outline is the only reliable cross-browser mechanism |
| Value announcement | `aria-live="polite"` div with manual text injection | Native `<output>` element | `<output>` is an implicit ARIA live region; screen readers announce its content changes automatically |
| ARIA toggle button state | Custom data attributes | `aria-pressed` on native `<button>` | `aria-pressed` is the W3C standard for toggle buttons; VoiceOver and NVDA both honor it without additional work |
| Min/max clamping | Custom range validation logic | `Math.min(max, Math.max(min, newValue))` | One line; no library needed |

**Key insight:** All three Phase 22 controls are "thin wrapper" controls. The glass rendering is already handled by primitives. The interaction model is simpler than Phase 21 (no dragging, no spring physics required). The implementation cost per control is LOW. The accessibility work is the main area requiring care.

---

## Common Pitfalls

### Pitfall 1: Glass Mask Lag on GlassInput Focus

**What goes wrong:** When the GlassInput's outer GlassPanel changes size or position on focus (e.g., a padding change, a focus ring that shifts layout), the glass mask updates one rAF frame later. At 60FPS this produces a one-frame misalignment where the glass effect is visible in the old position while the DOM has already moved.

**Why it happens:** `getBoundingClientRect()` in the render loop reads the new position, but the uniform buffer write happens at the same rAF frame as the DOM change, causing a single-frame misalignment.

**How to avoid:** Never change the GlassPanel's dimensions or layout-affecting properties on focus. Use CSS `outline` (which does not affect layout flow) for the focus ring. Change only shader parameters (`specular`, `rim`) via props — these update asynchronously through the morph lerp without any geometry change.

**Warning signs:** Visible "glass ghost" that appears one frame out of position when the input gains focus.

### Pitfall 2: GlassStepper Region Count Exceeds Budget in Dense Sections

**What goes wrong:** Each GlassStepper uses 3 GPU regions. A showcase section with four steppers = 12 regions. Combined with chips and inputs in the same mounted section, this can approach the MAX_GLASS_REGIONS = 32 limit faster than expected.

**Why it happens:** The showcase section is mounted when scrolled into view. If multiple control-heavy sections are simultaneously near the viewport, their combined region counts accumulate.

**How to avoid:** COUNT regions per section during planning. A FormSection with 3 chips (3) + 2 steppers (6) + 2 inputs (2) = 11 regions — well within budget for a single section. The IntersectionObserver virtualization from Phase 20's architecture ensures off-screen sections don't hold regions.

**Warning signs:** Some glass controls appear without the glass refraction effect (they render as transparent divs) — this is the symptom of silently dropped regions.

### Pitfall 3: GlassChip aria-pressed Not Announced by Screen Readers

**What goes wrong:** Screen reader announces "button" but not the toggle state, so users don't know whether the chip is selected.

**Why it happens:** Forgetting to add `aria-pressed={selected}` — or adding it as a string `"true"` instead of a boolean `true`.

**How to avoid:** `aria-pressed` must be a boolean value (`true` | `false`) not a string. When `aria-pressed={false}` VoiceOver says "toggle button, unselected"; when `true` it says "toggle button, selected". Test with VoiceOver (macOS) or NVDA (Windows) after implementation.

**Warning signs:** Screen reader announces just "button" with no state information.

### Pitfall 4: GlassInput Color Inheritance Fails

**What goes wrong:** The native `<input>` inside the GlassPanel renders with the browser's default input color (black text on white background) instead of inheriting the GlassPanel's glass text styles.

**Why it happens:** `input` elements do not inherit `color` from parent by default in some browsers without `color: inherit` explicitly set.

**How to avoid:** Always set `color: inherit` and `font: inherit` on the native `<input>`'s inline style. The GlassPanel already applies dark/light mode text colors via `textStyles` computed from `useGlassEngine()` preferences — the native input must inherit these.

**Warning signs:** Input text appears in wrong color (browser default) on initial render.

### Pitfall 5: Accessibility Contract Broken by Direct GlassRegionHandle Calls

**What goes wrong:** If interaction state is connected directly to `handle.updateSpecular()` calls instead of going through props → `useGlassRegion` sync effect, the `reducedTransparency` guard is bypassed. Users with "Reduce Transparency" enabled see full specular highlights.

**Why it happens:** Temptation to call `handle.updateSpecular(0.2)` from `onFocus` directly (appears simpler) rather than setting `focused` state and passing `specular={focused ? 0.2 : undefined}` as a prop to GlassPanel.

**How to avoid:** ALL glass parameter changes must flow through React props → `useGlassRegion`'s sync `useEffect`. This is the explicit accessibility contract established in GlassButton.tsx. Follow it exactly: compute effective values in the component body from state, pass as props to the primitive.

---

## Code Examples

Verified patterns from project source code:

### GlassButton hover/active glass parameter pattern (from src/components/GlassButton.tsx)
```typescript
// Source: src/components/GlassButton.tsx — lines 54-62
// Pattern: compute effective glass params from state, pass as props to useGlassRegion
const effectiveBlur     = pressed ? (blur ?? 0.5) * 0.3 : hovered ? (blur ?? 0.5) * 0.8 : blur;
const effectiveSpecular = hovered ? (specular ?? 0.2) * 1.8 : specular;
const effectiveRim      = hovered ? (rim ?? 0.15) * 2.0 : rim;
const effectiveAberration = hovered ? (aberration ?? 3) * 1.5 : aberration;
// These are then passed as props to useGlassRegion — never called on handle directly
useGlassRegion(internalRef, { blur: effectiveBlur, specular: effectiveSpecular, ... });
```

### useGlassRegion reducedTransparency guard (from src/hooks/useGlassRegion.ts)
```typescript
// Source: src/hooks/useGlassRegion.ts — lines 63-88
// reducedTransparency guard: zeroes ALL visual effects when set
if (prefs.reducedTransparency) {
  handle.updateAberration(0);
  handle.updateSpecular(0);
  handle.updateRim(0);
  // ... etc — this only fires if props flow through useGlassRegion correctly
}
```

### GlassPanel accepts all GlassStyleProps (from src/components/GlassPanel.tsx)
```typescript
// Source: src/components/GlassPanel.tsx
// GlassPanel passes all GlassStyleProps through to useGlassRegion
// Controls can pass specular/rim/opacity to change glass appearance reactively
<GlassPanel specular={focused ? 0.22 : undefined} rim={focused ? 0.28 : undefined} ... />
```

### Design tokens available (from src/tokens/apple.ts)
```typescript
// Source: src/tokens/apple.ts (Phase 20 complete)
APPLE_RADII.pill    // 9999 — capsule/chip shape
APPLE_RADII.md      // 14 — button, toggle track, input
APPLE_RADII.sm      // 8 — chip/badge
APPLE_SPACING.xs    // 4 — tight padding
APPLE_SPACING.sm    // 8 — standard padding
APPLE_CONTROL_SIZES.minTapTarget  // 44 — minimum touch target per Apple HIG
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom glass region hooks in each control | Compose GlassPanel/GlassButton (which call useGlassRegion internally) | v3.0 architecture (shipped) | Controls never call useGlassRegion directly; reducedTransparency guard is automatic |
| MAX_GLASS_REGIONS = 16 | MAX_GLASS_REGIONS = 32 with addRegion() guard | Phase 20 (FND-02, complete) | Phase 22 controls can mount without budget concerns in typical showcase sections |
| No design tokens | APPLE_RADII, APPLE_SPACING, APPLE_CONTROL_SIZES in src/tokens/apple.ts | Phase 20 (FND-03, complete) | All dimension values reference tokens, not magic numbers |
| No GlassEffectContainer | GlassEffectContainer with morph ID context | Phase 20 (FND-01, complete) | Phase 22 controls can be wrapped in GlassEffectContainer for coordinated animations if needed |

**Note on FEATURES.md classification:** The FEATURES.md (v4.0 research) classifies GlassStepper as P3/v5+ ("low visual impact relative to implementation cost"). However, CTRL-05 is a hard v4.0 requirement in REQUIREMENTS.md and Phase 22 is confirmed in ROADMAP.md. The research document's prioritization matrix predates the finalized roadmap. CTRL-04/05/06 MUST be implemented in Phase 22 regardless of the P3 classification.

---

## Open Questions

1. **GlassChip: single-select vs multi-select group behavior**
   - What we know: CTRL-04 describes a single chip that "toggles selected/unselected state on click" — controlled component
   - What's unclear: Whether Phase 22 needs a `GlassChipGroup` with roving tabindex (a11y for multi-chip sets), or just the individual chip is sufficient
   - Recommendation: Build only the individual `GlassChip` component for Phase 22. Document that multiple chips should be wrapped in a `<div role="group">` by the consuming code. A `GlassChipGroup` can be added as a v4.x follow-on if showcase needs it.

2. **GlassStepper: native hidden input vs custom display**
   - What we know: Two approaches work — hide a native `<input type="number">` and render custom GlassPanel display, or use a completely custom display with `<output>` element
   - What's unclear: Native `<input type="number">` in iOS/Safari has browser-controlled up/down arrows that may not render correctly inside a GlassPanel layout
   - Recommendation: Use the custom `<output>` + two GlassButton approach. More control over appearance, no browser-native spinner interference. Wrap in `role="group"`. This is cleaner for a showcase control.

3. **GlassInput: single-line only vs multi-line textarea**
   - What we know: CTRL-06 says "text field" — iOS/Apple uses single-line `UITextField` as the base
   - What's unclear: Whether the showcase FormSection needs a multi-line textarea variant
   - Recommendation: Build single-line `<input>` only for Phase 22 (matches CTRL-06 "text field"). A `GlassTextarea` variant can be added later; the architecture is identical.

4. **Radix primitives not installed for chip/stepper semantics**
   - What we know: No `@radix-ui/react-toggle` or `@radix-ui/react-number-input` is installed. The installed Radix packages are dialog, popover, select, slider, switch, toggle-group, tooltip.
   - What's unclear: Whether adding `@radix-ui/react-toggle` would provide meaningful accessibility improvements for GlassChip
   - Recommendation: Native `aria-pressed` on a `<button>` is sufficient for a single toggle button. Do NOT add a new Radix package for this.

---

## Validation Architecture

> `workflow.nyquist_validation` is absent from `.planning/config.json` — treating as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (configured in `vitest.config.ts`) |
| Config file | `/Users/asekar/code/glass-react/vitest.config.ts` |
| Test environment | `jsdom` (per `@vitest-environment jsdom` docblock in test files) |
| Quick run command | `npx vitest run --reporter=verbose src/components/__tests__/` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CTRL-04 | GlassChip renders with glass background | unit | `npx vitest run src/components/__tests__/GlassChip.test.tsx` | Wave 0 |
| CTRL-04 | GlassChip toggles selected/unselected on click | unit | `npx vitest run src/components/__tests__/GlassChip.test.tsx` | Wave 0 |
| CTRL-04 | GlassChip has aria-pressed reflecting selected state | unit | `npx vitest run src/components/__tests__/GlassChip.test.tsx` | Wave 0 |
| CTRL-05 | GlassStepper renders +/- buttons | unit | `npx vitest run src/components/__tests__/GlassStepper.test.tsx` | Wave 0 |
| CTRL-05 | GlassStepper increments and decrements value | unit | `npx vitest run src/components/__tests__/GlassStepper.test.tsx` | Wave 0 |
| CTRL-05 | GlassStepper clamps at min and max | unit | `npx vitest run src/components/__tests__/GlassStepper.test.tsx` | Wave 0 |
| CTRL-05 | GlassStepper disables appropriate button at limits | unit | `npx vitest run src/components/__tests__/GlassStepper.test.tsx` | Wave 0 |
| CTRL-06 | GlassInput renders a text input | unit | `npx vitest run src/components/__tests__/GlassInput.test.tsx` | Wave 0 |
| CTRL-06 | GlassInput updates value via onChange | unit | `npx vitest run src/components/__tests__/GlassInput.test.tsx` | Wave 0 |
| CTRL-06 | GlassInput applies visible focus indicator on focus | unit | `npx vitest run src/components/__tests__/GlassInput.test.tsx` | Wave 0 |
| CTRL-04/05/06 | All controls announce state to screen readers | manual | VoiceOver or NVDA keyboard walkthrough | N/A (manual-only) |

**Note on glass shader parameter tests:** Unit tests in jsdom cannot verify that `useGlassRegion` calls the actual WebGPU pipeline (WebGPU is not available in jsdom). Tests verify React behavior: rendering, click handling, state updates, ARIA attributes, prop passing. Visual glass effect correctness is validated via Playwright screenshot tests (existing infrastructure in `tests/` — add a screenshot test per control if needed).

### Sampling Rate

- **Per task commit:** `npx vitest run src/components/__tests__/Glass{Chip,Stepper,Input}.test.tsx`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/components/__tests__/GlassChip.test.tsx` — covers CTRL-04 (render, toggle, aria-pressed)
- [ ] `src/components/__tests__/GlassStepper.test.tsx` — covers CTRL-05 (render, increment, decrement, clamp, disabled states)
- [ ] `src/components/__tests__/GlassInput.test.tsx` — covers CTRL-06 (render, value binding, focus state)
- [ ] `src/components/controls/index.ts` — barrel export file (create in Wave 0 if Phase 21 hasn't created it)

**Existing test pattern to follow:** `src/components/__tests__/GlassEffectContainer.test.tsx` — uses `@vitest-environment jsdom` docblock, `@testing-library/react`, mocks `motion/react` where needed, tests React behavior not WebGPU rendering.

---

## Sources

### Primary (HIGH confidence)

- Project source: `src/components/GlassButton.tsx` — hover/active glass parameter pattern; must be followed exactly for all interactive glass components
- Project source: `src/hooks/useGlassRegion.ts` — reducedTransparency guard, dark/light defaults, sync pattern
- Project source: `src/components/GlassPanel.tsx` — composition target; all GlassStyleProps flow through
- Project source: `src/tokens/apple.ts` — APPLE_RADII, APPLE_SPACING, APPLE_CONTROL_SIZES (Phase 20 complete)
- Project source: `src/components/GlassEffectContainer.tsx` — GlassEffectContainer available; not required for Phase 22 controls but available
- Project source: `src/components/__tests__/GlassEffectContainer.test.tsx` — test pattern to follow for Wave 0 test files
- Project source: `.planning/REQUIREMENTS.md` — CTRL-04/05/06 requirements verbatim
- Project source: `.planning/ROADMAP.md` — Phase 22 success criteria verbatim
- Project source: `vitest.config.ts` — test framework configuration
- Project source: `package.json` — confirmed installed dependencies; no new packages needed for Phase 22

### Secondary (MEDIUM confidence)

- `.planning/research/ARCHITECTURE.md` — Layer 1 control build order, GPU region counts per control, composition patterns
- `.planning/research/FEATURES.md` — Apple HIG specifications; note that FEATURES.md classifies Stepper as P3 but REQUIREMENTS.md overrides this
- `.planning/research/SUMMARY.md` — pitfall catalogue, accessibility contract, section-based region budget analysis

### Tertiary (LOW confidence)

- WAI-ARIA Authoring Practices Guide — `aria-pressed` for toggle buttons, `role="group"`, `<output>` element semantics — standard W3C specs, not verified against a specific external URL but well-established browser-supported attributes

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified in package.json; no new packages required
- Architecture: HIGH — composition pattern derived directly from GlassButton.tsx and GlassPanel.tsx source; region counts confirmed from ARCHITECTURE.md
- Pitfalls: HIGH (GPU/React) — glass mask lag and region budget from source analysis; MEDIUM (accessibility) — aria-pressed and output element from W3C specs without live verification
- Token/dimension values: LOW — APPLE_RADII/SPACING/CONTROL_SIZES defined in Phase 20 but marked LOW confidence pending iOS Simulator calibration (see apple.ts header comment)

**Research date:** 2026-03-25
**Valid until:** 2026-04-24 (stable dependencies, 30-day window)

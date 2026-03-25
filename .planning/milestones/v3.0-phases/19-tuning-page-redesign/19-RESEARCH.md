# Phase 19: Tuning Page Redesign - Research

**Researched:** 2026-03-24
**Domain:** React dev tooling UI — polished parameter-inspection sidebar
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PAGE-01 | Dev tuning page redesigned using frontend-design + ui-ux-pro-max skills | Architecture patterns, CSS design system, component structure documented below |
| PAGE-02 | All existing tuning features preserved (sliders, presets, JSON import/export, URL params) | Full feature inventory of current ControlPanel and presets.ts — exact APIs mapped |
</phase_requirements>

---

## Summary

The current tuning page is a functional but visually basic sidebar: 280px wide, plain `rgba` background, `<input type="range">` native sliders with browser-default thumb styling (overridden only via `accentColor`), no section collapsing, and no hover/focus visual feedback beyond the cursor change. All logic is sound — the `presets.ts` module owns URL-param parsing, JSON import/export, preset switching, section-keyed resets, and the `GlassParams` type. None of that logic needs to change; only the visual layer needs replacing.

The project has no CSS framework installed (no Tailwind, no CSS Modules, no shadcn/ui). The entire stack is raw inline styles. This is intentional for a library repo — the demo cannot pull in a heavy framework that would pollute the library bundle. The correct approach for this phase is: a curated design token object (CSS custom properties or a TS `tokens` object), purpose-built component primitives (`Slider`, `ColorPicker`, `Select`, `SectionAccordion`, `PresetChip`, `ActionButton`), all using inline styles or a `<style>` tag injected into the demo's `index.html`. No new npm packages are required.

The reference quality bar is a professional macOS-native dev inspector panel — think Xcode's Attributes Inspector or Figma's right panel: tight grid, monospaced value readouts, subtle hover/active states, animated section expand/collapse, a clear visual hierarchy between preset controls and parameter tuning controls. The existing 280px panel width is slightly narrow for comfort; 300–320px gives breathing room without crowding the preview area.

**Primary recommendation:** Replace all inline style objects in `ControlPanel.tsx`, `SliderControl.tsx`, `ColorControl.tsx`, `SelectControl.tsx` with a typed token system and polished component primitives. Move CSS custom properties to `demo/index.html`. Keep every function in `presets.ts` unchanged.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 (installed) | Component rendering | Already in project |
| TypeScript | 5.7 (installed) | Type safety | Already in project |
| Vite | 6.1 (installed) | Demo build/dev server | Already configured in `vite.demo.config.ts` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| No new packages | — | All UI built with inline styles + CSS custom properties | This is a demo-only UI in a library repo; zero new runtime dependencies |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline styles + tokens | Tailwind CSS | Tailwind would require a devDependency and PostCSS config; adds ~300KB to dev bundle; overkill for 5 components |
| Inline styles + tokens | shadcn/ui | Requires Tailwind + Radix; the demo needs none of the accessible primitives (it's a dev-only tool, not a public UI) |
| Inline styles + tokens | CSS Modules | Requires Vite CSS Modules config change; extra `.module.css` files for a self-contained demo; inline styles are already the pattern |
| Custom `<input type="range">` | rc-slider | `rc-slider` adds a runtime dependency and needs CSS import from node_modules; not worth it for a dev tool |

**Installation:** None required. Zero new packages.

---

## Architecture Patterns

### Recommended Project Structure
```
demo/
├── index.html              # Add CSS custom properties here
├── App.tsx                 # Unchanged (layout + URL param parsing)
├── GlassRendererHarness.tsx # Unchanged
├── main.tsx                # Unchanged
└── controls/
    ├── tokens.ts           # NEW: design token constants
    ├── presets.ts          # UNCHANGED: all logic stays here
    ├── ControlPanel.tsx    # REWRITE: layout + visual polish
    ├── SliderControl.tsx   # REWRITE: polished range input
    ├── ColorControl.tsx    # REWRITE: polished RGB channels
    └── SelectControl.tsx   # REWRITE: polished dropdown
```

### Pattern 1: Design Token Object
**What:** A single `tokens.ts` file exporting a typed constant with all color, spacing, typography, and radius values.
**When to use:** Applied by every component primitive via `tokens.color.label`, `tokens.space.sm`, etc. No magic numbers in component files.
**Example:**
```typescript
// demo/controls/tokens.ts
export const tokens = {
  color: {
    panelBg:       'rgba(18, 18, 22, 0.92)',
    panelBorder:   'rgba(255, 255, 255, 0.07)',
    sectionBorder: 'rgba(255, 255, 255, 0.06)',
    trackBg:       'rgba(255, 255, 255, 0.12)',
    trackFill:     '#5ba3f5',
    thumbBg:       '#ffffff',
    thumbShadow:   '0 1px 4px rgba(0,0,0,0.6)',
    labelPrimary:  'rgba(255, 255, 255, 0.78)',
    labelMuted:    'rgba(255, 255, 255, 0.38)',
    valueText:     'rgba(255, 255, 255, 0.55)',
    sectionTitle:  'rgba(255, 255, 255, 0.35)',
    presetChipBg:  'rgba(255, 255, 255, 0.06)',
    presetChipBgActive: 'rgba(91, 163, 245, 0.18)',
    presetChipBorder:   'rgba(255, 255, 255, 0.12)',
    presetChipBorderActive: 'rgba(91, 163, 245, 0.5)',
    errorText:     '#f06a6a',
    accentBlue:    '#5ba3f5',
  },
  space: {
    panelPad: '16px 14px',
    sectionGap: 16,
    controlGap: 10,
    chipGap: 5,
  },
  radius: {
    panel: 0,        // full-height sidebar, no radius
    chip: 5,
    control: 6,
    thumb: '50%',
  },
  font: {
    sectionTitle: '0.68rem',
    label:  '0.8rem',
    value:  '0.73rem',
    chip:   '0.7rem',
    header: '0.88rem',
  },
  transition: {
    fast: 'all 0.12s ease',
    panel: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
  },
} as const;
```

### Pattern 2: Polished Slider via CSS Custom Properties
**What:** Inject slider thumb/track styles into `index.html` so they apply globally to all `<input type="range">` elements in the demo. This avoids per-element style repetition and gives crisp, non-browser-default thumb rendering.
**When to use:** Apply once in `demo/index.html` `<style>` block. This is the standard technique for range inputs in no-framework React projects.
**Example:**
```css
/* demo/index.html <style> block */
input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 3px;
  background: transparent;
  outline: none;
  cursor: pointer;
}
input[type="range"]::-webkit-slider-runnable-track {
  height: 3px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 2px;
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
  margin-top: -5px;
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}
input[type="range"]:active::-webkit-slider-thumb {
  transform: scale(1.2);
  box-shadow: 0 2px 8px rgba(91, 163, 245, 0.5);
}
input[type="range"]::-moz-range-track {
  height: 3px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 2px;
}
input[type="range"]::-moz-range-thumb {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: #ffffff;
  border: none;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
}
```

### Pattern 3: Track Fill via CSS Custom Property + linear-gradient
**What:** Drive the filled portion of a slider track with a CSS custom property (`--pct`) set inline. This gives the "filled left, empty right" visual without JavaScript painting.
**When to use:** In `SliderControl.tsx`, compute `const pct = ((value - min) / (max - min)) * 100` and set `style={{ '--pct': `${pct}%` } as React.CSSProperties}` on the input.
**Example:**
```typescript
// SliderControl.tsx - track fill via CSS custom property
const pct = ((value - min) / (max - min)) * 100;

<input
  type="range"
  ...
  style={{
    '--pct': `${pct}%`,
  } as React.CSSProperties}
/>
```
```css
/* index.html */
input[type="range"]::-webkit-slider-runnable-track {
  background: linear-gradient(
    to right,
    #5ba3f5 0%,
    #5ba3f5 var(--pct, 0%),
    rgba(255,255,255,0.12) var(--pct, 0%),
    rgba(255,255,255,0.12) 100%
  );
}
```

### Pattern 4: Collapsible Section via useState
**What:** Each Section component tracks `open` state and toggles max-height with a CSS transition for smooth expand/collapse.
**When to use:** Sections with 3+ controls benefit from collapsibility. Collapsed by default for less frequently used sections (Advanced, Animation).
**Example:**
```typescript
// SectionAccordion component
function SectionAccordion({ title, defaultOpen = true, onReset, children }: { ... }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 14 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', width: '100%', justifyContent: 'space-between',
          alignItems: 'center', background: 'none', border: 'none',
          cursor: 'pointer', padding: '3px 0 5px',
          borderBottom: `1px solid ${tokens.color.sectionBorder}`,
        }}
      >
        <span style={{ fontSize: tokens.font.sectionTitle, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          color: tokens.color.sectionTitle }}>
          {title}
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={(e) => { e.stopPropagation(); onReset(); }}
            style={{ fontSize: '0.65rem', color: tokens.color.labelMuted,
              background: 'none', border: 'none', cursor: 'pointer' }}>
            Reset
          </button>
          <span style={{ color: tokens.color.labelMuted, fontSize: '0.7rem',
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.15s ease', display: 'inline-block' }}>
            ▾
          </span>
        </div>
      </button>
      {open && <div style={{ paddingTop: 8 }}>{children}</div>}
    </div>
  );
}
```

### Pattern 5: Preset Chips (active-state visual feedback)
**What:** Preset buttons styled as small chips with a distinct active/selected state showing which preset is currently active.
**When to use:** Replace the flat toolbar buttons with chip-style controls that reflect current selection.
**Example:**
```typescript
// In ControlPanel — detect active preset
const activePreset = Object.entries(PRESETS).find(([, p]) =>
  Object.keys(p).every(k => p[k as keyof GlassParams] === params[k as keyof GlassParams])
)?.[0] ?? null;

// Chip rendering
<button
  key={name}
  onClick={() => onChange(PRESETS[name])}
  style={{
    fontSize: tokens.font.chip,
    padding: '4px 10px',
    borderRadius: tokens.radius.chip,
    background: activePreset === name
      ? tokens.color.presetChipBgActive
      : tokens.color.presetChipBg,
    border: `1px solid ${activePreset === name
      ? tokens.color.presetChipBorderActive
      : tokens.color.presetChipBorder}`,
    color: activePreset === name
      ? tokens.color.accentBlue
      : tokens.color.labelPrimary,
    cursor: 'pointer',
    transition: tokens.transition.fast,
    fontWeight: activePreset === name ? 600 : 400,
  }}
>
  {name}
</button>
```

### Pattern 6: Monospace Value Readout with Contextual Formatting
**What:** Show values right-aligned in monospace. For integers show 0 decimal places; for 0-1 normalized values show 2 places; for angles show 1 place with degree symbol.
**When to use:** In `SliderControl.tsx` — derive format from the `step` and `max` props rather than hardcoding `toFixed(2)` everywhere.
**Example:**
```typescript
function formatValue(value: number, step: number, max: number): string {
  if (step >= 1) return value.toFixed(0);
  if (max <= 1) return value.toFixed(2);
  return value.toFixed(1);
}
```

### Anti-Patterns to Avoid
- **New npm packages for UI:** Don't add Tailwind, shadcn, rc-slider, or any other runtime dependency. The demo is not the library; zero bundle impact required.
- **Touching presets.ts logic:** All `GlassParams`, `PRESETS`, `SECTION_KEYS`, `exportParams`, `importParams`, `validateParams` stay byte-for-byte identical. The phase is pure visual redesign.
- **Touching App.tsx layout:** The main content area, URL param parsing, background mode toggle, and capture mode are out of scope. Only `ControlPanel` and its sub-components change.
- **Touching the URL param format:** The `?blur=0.3&opacity=0.17` format is used by the automated tuning pipeline (`tune.ts`). Breaking the URL param format would break automated tuning.
- **animation via JS requestAnimationFrame:** Section expand/collapse should use CSS transitions (height or opacity), not JS-driven animation. The panel is already in the same renderer as the WebGPU canvas; minimize JS work in the panel.
- **CSS-in-JS libraries:** styled-components, emotion — no; they add runtime overhead and are incompatible with the no-framework stance of the rest of the codebase.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Range thumb cross-browser styling | Custom `<canvas>`-drawn slider | CSS `::webkit-slider-thumb` + `::moz-range-thumb` pseudo-elements | Full cross-browser coverage; zero JavaScript; already the pattern React devs use |
| Color preview swatch | `<canvas>` pixel painting | `backgroundColor: previewColor` CSS on a `<div>` | Already works in current `ColorControl`; keep it |
| Smooth panel slide | JS-driven `requestAnimationFrame` | CSS `transform: translateX` + `transition` | Already works; keep exact mechanism |
| Section collapse animation | height animation via JS | `display` toggle or `max-height` transition | CSS `max-height` transition is the standard; `display: none` is simpler and fine for this use case |
| Tooltip showing parameter description | Third-party tooltip library | HTML `title` attribute | Dev tool, not a public UI; native tooltips are acceptable |

**Key insight:** Every interactive primitive needed here (`input[type="range"]`, `select`, `button`, `<div>`) is a native HTML element. The work is entirely CSS + token polish, not new component logic.

---

## Common Pitfalls

### Pitfall 1: Breaking the capture mode URL branch
**What goes wrong:** `App.tsx` has an `isCapture` branch (`?capture` URL param) that renders a single full-screen `GlassButton` without the `ControlPanel`. If any ControlPanel change accidentally re-exports something `App.tsx` relies on with a different type, the capture mode render breaks.
**Why it happens:** `ControlPanel.tsx` re-exports `GlassParams` — `export type { GlassParams } from './presets'`. If you restructure the re-export incorrectly TypeScript catches it, but a runtime import shape change could silently break the capture harness used by `diff.ts` / `tune.ts`.
**How to avoid:** Keep `export type { GlassParams } from './presets'` in `ControlPanel.tsx` verbatim. Do not change `presets.ts` at all.
**Warning signs:** `npm run diff` fails to find the glass button element at the expected position.

### Pitfall 2: CSS custom property (`--pct`) not recognized by TypeScript
**What goes wrong:** Setting `style={{ '--pct': `${pct}%` }}` on a JSX element causes a TypeScript error: `Property '--pct' does not exist on type 'CSSProperties'`.
**Why it happens:** React's `CSSProperties` type does not index CSS custom properties by default.
**How to avoid:** Cast the style object: `style={{ '--pct': `${pct}%` } as React.CSSProperties}`. This is the standard approach — React does forward unknown CSS properties to the DOM.
**Warning signs:** TypeScript compilation error in `SliderControl.tsx`.

### Pitfall 3: Slider track fill broken in Firefox
**What goes wrong:** The `linear-gradient` track fill using `--pct` works in WebKit but not in Firefox because Firefox uses `::moz-range-progress` instead of the runnable-track background approach.
**Why it happens:** Firefox has its own pseudo-element (`::moz-range-progress`) for the filled portion; it does not respect the background gradient on the track.
**How to avoid:** Either accept that Firefox shows a flat track (acceptable for a dev tool; Chrome is the primary target for WebGPU), or add a `::moz-range-progress` rule. Since WebGPU itself requires Chrome/Edge on most platforms, Chrome parity is sufficient.
**Warning signs:** Track fill missing in Firefox.

### Pitfall 4: Panel width breaks the main content layout padding
**What goes wrong:** `App.tsx` hardcodes `paddingRight: 328` to account for the 280px control panel. If you change the panel width, the main content shifts incorrectly.
**Why it happens:** The panel is `position: fixed` so it does not participate in normal flow; the padding must match manually.
**How to avoid:** If you change panel width from 280px to e.g. 300px, update `paddingRight` in `App.tsx` to `paddingRight: 320` (300 + 20px gutter). Document this coupling as a comment in both files.
**Warning signs:** Preview glass components overlap with or leave excessive gap before the control panel.

### Pitfall 5: Vitest test path exclusion
**What goes wrong:** Vitest is configured with `include: ['src/**/__tests__/**/*.test.ts']` — it only picks up tests under `src/`. Demo files under `demo/` are never included. Writing tests for demo components in `demo/controls/__tests__/` would be silently ignored.
**Why it happens:** `vitest.config.ts` explicitly scopes to `src/`.
**How to avoid:** For this phase, validation is visual (dev server inspection) and behavioral (import/export/preset switch works). No unit test files need to be written for demo-only components.

---

## Code Examples

Verified patterns from the current codebase:

### Current ControlPanel dimensions (to keep in sync)
```typescript
// App.tsx line 107 — MUST stay in sync with panel width
paddingRight: 328,  // 280px panel + 48px main padding

// ControlPanel.tsx — panel container
width: 280,
height: '100vh',
```

### Current toggle button position (to keep in sync)
```typescript
// ControlPanel.tsx — toggle button
right: open ? 296 : 16,  // 280px panel + 16px gutter
```
If panel width changes to W, these become: `right: open ? (W + 16) : 16` and `paddingRight: W + 48`.

### URL param persistence — DO NOT CHANGE
```typescript
// App.tsx — getParamsFromURL
for (const [key, value] of url.searchParams) {
  if (key in DEFAULTS) { ... }  // key names match GlassParams field names exactly
}
```
The param names (`blur`, `opacity`, etc.) must remain identical to `GlassParams` field names.

### Export/Import — DO NOT CHANGE
```typescript
// presets.ts
export function exportParams(params: GlassParams): void { ... }
export function importParams(onLoad, onError): void { ... }
```
These are pure logic functions; the redesigned ControlPanel calls them identically.

### Re-export GlassParams — KEEP VERBATIM
```typescript
// ControlPanel.tsx line 13
export type { GlassParams } from './presets';
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Leva (third-party) | Custom inline-style controls | Phase ~7-8 | Eliminated runtime dep; enables full visual control |
| accentColor on `<input>` | CSS pseudo-element thumb styling | This phase | Full cross-browser visual control of thumb shape/size/shadow |
| Section divider as static `<div>` | Collapsible SectionAccordion | This phase | Reduces visual density; keeps advanced params discoverable |

**Deprecated/outdated in this context:**
- `accentColor: '#6cb4ee'` on each range input: replaced by the global CSS rule in `index.html`; remove the per-input `accentColor` style after the global rule is in place.
- Magic `rgba()` numbers scattered across component files: replaced by `tokens.ts` imports.

---

## Open Questions

1. **Panel width: keep 280px or expand to 300-320px?**
   - What we know: 280px is tight; 16px padding leaves only 248px for controls. The `cornerRadius` slider label "Corner Radius" truncates visually at very small viewports.
   - What's unclear: User's display resolution — on a 1440px-wide display, 300px is fine; on a 1280px display it's borderline.
   - Recommendation: Expand to 300px. Update `paddingRight` in App.tsx to 348 (300 + 48). This is a safe tradeoff. Document the coupling.

2. **Default collapsed sections?**
   - What we know: "Geometry" (1 slider) and "Animation" (1 slider) are rarely tuned. "Lighting" has 6 sliders, making the panel very long.
   - What's unclear: Which sections a first-time user wants open.
   - Recommendation: Open by default: "Blur & Opacity", "Refraction", "Lighting", "Color Adjustment". Collapsed by default: "Geometry", "Animation".

3. **Copy current URL to clipboard button?**
   - What we know: URL params are the machine-readable form for the tuning pipeline. Developers frequently copy URLs to share preset states.
   - What's unclear: Whether this feature was intentionally omitted or just not yet added.
   - Recommendation: Add a "Copy URL" button in the toolbar row. Uses `navigator.clipboard.writeText(window.location.href)`. Fits the dev-tool context well. Low implementation cost (5 lines).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.ts` (scoped to `src/**/__tests__/**/*.test.ts`) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAGE-01 | Tuning page renders without errors | manual-only | Dev server visual inspection: `npm run dev:demo` | N/A |
| PAGE-02 | Preset switching updates params | manual-only | Click each preset chip, verify glass updates | N/A |
| PAGE-02 | Slider adjusts parameter value | manual-only | Drag slider, verify numeric readout and glass update | N/A |
| PAGE-02 | JSON export downloads a file | manual-only | Click Export JSON, verify download | N/A |
| PAGE-02 | JSON import loads a valid file | manual-only | Click Import JSON, select file, verify params load | N/A |
| PAGE-02 | URL params survive page reload | manual-only | Adjust params, reload URL, verify params persist | N/A |

**Justification for manual-only:** All PAGE-01 and PAGE-02 requirements are pure UI behavior — visual correctness, browser file download API, and user interaction flows. Vitest runs in Node (`environment: 'node'`), has no DOM renderer, and the demo directory is excluded from its `include` glob. There is no e2e framework configured that covers the demo page (Playwright tests in `tests/` target the main app at `/`, not the demo at port 5174). Testing these features automatically would require adding Playwright routes for the demo server, which is out of scope for this phase.

### Wave 0 Gaps
None — no new test infrastructure is needed. Visual/behavioral validation is via `npm run dev:demo` manual inspection.

---

## Sources

### Primary (HIGH confidence)
- Live codebase: `demo/controls/ControlPanel.tsx`, `demo/controls/SliderControl.tsx`, `demo/controls/ColorControl.tsx`, `demo/controls/SelectControl.tsx`, `demo/controls/presets.ts`, `demo/App.tsx` — complete feature inventory derived from direct file reads
- Live codebase: `demo/index.html`, `vite.demo.config.ts`, `package.json` — confirmed: no CSS framework, no new package headroom
- Live codebase: `vitest.config.ts` — confirms `demo/` is excluded from test coverage
- MDN: CSS `::webkit-slider-thumb`, `::webkit-slider-runnable-track`, `::moz-range-thumb` — standard cross-browser slider styling technique

### Secondary (MEDIUM confidence)
- React docs / community: `style={{ '--custom-prop': value } as React.CSSProperties}` cast pattern — standard workaround for CSS custom properties in JSX inline styles; well-established in React ecosystem

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Current UI inventory: HIGH — derived from direct file reads of all 5 demo control files
- Standard stack (no new packages): HIGH — confirmed by `package.json` and project conventions; library repo cannot add runtime deps to demo
- Architecture patterns (tokens + CSS pseudo-elements): HIGH — standard React/CSS patterns, no library APIs needed
- Pitfalls: HIGH — most are derived from direct code analysis (App.tsx coupling, TS type assertion, vitest exclusion)

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable domain — no moving parts)

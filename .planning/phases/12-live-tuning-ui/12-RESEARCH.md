# Phase 12: Live Tuning UI - Research

**Researched:** 2026-02-25
**Domain:** React demo app UI -- shader parameter controls, presets, JSON import/export
**Confidence:** HIGH

## Summary

Phase 12 extends the existing demo app's control panel (`demo/controls/`) to cover ALL shader parameters (7 parameters missing from current controls), adds per-section and global reset, named presets (Apple Clear Light/Dark), and JSON import/export. The existing demo architecture is well-suited for this -- it already uses a `GlassParams` state object in `demo/App.tsx` that feeds into glass component props, and has hand-rolled `SliderControl`, `ColorControl`, and `SelectControl` primitives.

The existing `GlassParams` interface in `demo/controls/ControlPanel.tsx` covers 9 of the 16 tunable properties from `GlassStyleProps`. The 7 missing parameters (`refraction`, `contrast`, `saturation`, `blurRadius`, `fresnelIOR`, `fresnelExponent`, `envReflectionStrength`, `glareDirection`) were added in Phase 10 but never wired into the demo controls. No new library dependencies are needed -- the existing hand-rolled control primitives are sufficient, and file download/upload uses only native browser APIs (`Blob`, `URL.createObjectURL`, `<input type="file">`).

**Primary recommendation:** Extend the existing hand-rolled demo controls (do NOT introduce leva or any other dependency). Add the 7 missing parameters to `GlassParams`, group controls into logical sections with per-section reset, define two named presets as static objects, and implement JSON export/import with standard Blob download + file input patterns. Add URL query string parameter support for Phase 14 (AUTO-01) forward-compatibility.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Export: file download as `.json` (browser save dialog)
- Import: file picker dialog to select a `.json` file
- JSON format: flat key-value matching shader uniform names directly (e.g. `{ "blurIntensity": 0.6, "opacity": 0.08, ... }`)
- No metadata wrapper, no grouped nesting -- keep it simple and diffable

### Claude's Discretion
- Panel layout & placement (sidebar, overlay, drawer -- whatever works best with the demo app layout)
- Parameter grouping into sections (logical grouping of the ~15 shader uniforms)
- Slider control design (labels, numeric readouts, ranges)
- How tint (RGB vec3) is controlled (color picker, 3 sliders, hex input, etc.)
- Preset UI presentation (dropdown, buttons, tabs, etc.)
- Reset button placement and behavior (per-section, global)
- Import/Export button placement within the panel
- Visual feedback for import success/failure
- Overall styling of the tuning panel

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TUNE-01 | Demo app shows real-time slider controls for all shader parameters, grouped by section | Existing demo has 9/16 parameters in hand-rolled controls. Need to add 7 Phase 10 params, reorganize into logical sections. See Architecture Patterns: Parameter Grouping. |
| TUNE-02 | User can reset parameters to defaults per section and globally | Defaults already defined in `useGlassRegion.ts`. Create a `DEFAULTS` const object, reset = `setParams(DEFAULTS)`. Per-section reset replaces only that section's keys. See Code Examples: Reset Pattern. |
| TUNE-03 | Demo app offers named presets (Apple Clear Light, Apple Clear Dark) for one-click parameter loading | Two static preset objects with full GlassParams values. Preset selection = `setParams(preset)`. See Code Examples: Preset Definitions. |
| TUNE-04 | User can export current parameters as JSON and import a JSON config | Export via Blob + anchor download. Import via hidden `<input type="file">` + FileReader. Flat JSON format (locked decision). See Code Examples: JSON Export/Import. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.0.0 | Already in project | Demo framework |
| Native browser APIs | N/A | File download (Blob + anchor), file upload (`<input type="file">`) | Zero dependencies, universally supported |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | - | - | No new dependencies needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled controls | leva (pmndrs) | Leva 0.10.1 is React 19 compatible but adds ~30KB dependency. Demo already has working hand-rolled controls (SliderControl, ColorControl, SelectControl). Extending existing code is simpler, lighter, and consistent with Phase 8 decision. |
| Blob + anchor download | `showSaveFilePicker` (File System Access API) | Chromium-only API. The Blob+anchor pattern works in all browsers. Since WebGPU is Chromium-only anyway, this would work, but Blob+anchor is simpler and already the universal pattern. |
| `<input type="file">` | `showOpenFilePicker` (File System Access API) | Same Chromium-only concern. `<input type="file">` is universally supported and works fine for single JSON file selection. |

**Installation:**
```bash
# No new dependencies required
```

## Architecture Patterns

### Existing Architecture (What We Have)

The demo app already has:
- `demo/App.tsx` -- holds `GlassParams` state, passes to glass components and `ControlPanel`
- `demo/controls/ControlPanel.tsx` -- sidebar with sections, renders slider/color/select controls
- `demo/controls/SliderControl.tsx` -- reusable range input with label and numeric readout
- `demo/controls/ColorControl.tsx` -- RGB 3-slider with color preview swatch
- `demo/controls/SelectControl.tsx` -- styled `<select>` dropdown

The existing `GlassParams` interface has 9 fields:
```typescript
interface GlassParams {
  blur: number;           // exists
  opacity: number;        // exists
  cornerRadius: number;   // exists
  aberration: number;     // exists
  specular: number;       // exists
  rim: number;            // exists
  tint: GlassColor;       // exists
  refractionMode: 'standard' | 'prominent';  // exists
  morphSpeed: number;     // exists
}
```

Missing 7 fields from `GlassStyleProps` (Phase 10):
```typescript
  refraction: number;         // missing
  contrast: number;           // missing
  saturation: number;         // missing
  blurRadius: number;         // missing
  fresnelIOR: number;         // missing
  fresnelExponent: number;    // missing
  envReflectionStrength: number; // missing
  glareDirection: number;     // missing
```

Note: `glareDirection` is in degrees in the React API (converted to radians in `useGlassRegion.ts`).

### Recommended Project Structure Change
```
demo/
├── App.tsx              # MODIFY: add missing params, wire presets, URL param support
├── controls/
│   ├── ControlPanel.tsx # MODIFY: add missing sliders, sections, reset buttons, preset/import/export
│   ├── SliderControl.tsx # NO CHANGE (existing component is sufficient)
│   ├── ColorControl.tsx  # NO CHANGE
│   ├── SelectControl.tsx # NO CHANGE
│   └── presets.ts       # NEW: preset definitions, defaults constant, types
├── index.html           # NO CHANGE
└── main.tsx             # NO CHANGE
```

### Pattern 1: Complete GlassParams with Defaults

**What:** Extend `GlassParams` to include all `GlassStyleProps` fields, define a single `DEFAULTS` constant.
**When to use:** Foundation for all other features (presets, reset, export).

```typescript
// demo/controls/presets.ts
import type { GlassColor } from '../../src/components/types';

export interface GlassParams {
  blur: number;
  opacity: number;
  cornerRadius: number;
  refraction: number;
  aberration: number;
  specular: number;
  rim: number;
  tint: GlassColor;
  refractionMode: 'standard' | 'prominent';
  morphSpeed: number;
  contrast: number;
  saturation: number;
  blurRadius: number;
  fresnelIOR: number;
  fresnelExponent: number;
  envReflectionStrength: number;
  glareDirection: number;
}

export const DEFAULTS: GlassParams = {
  blur: 0.5,
  opacity: 0.05,
  cornerRadius: 24,
  refraction: 0.15,
  aberration: 3,
  specular: 0.2,
  rim: 0.15,
  tint: [1, 1, 1],
  refractionMode: 'standard',
  morphSpeed: 8,
  contrast: 0.85,
  saturation: 1.4,
  blurRadius: 15,
  fresnelIOR: 1.5,
  fresnelExponent: 5.0,
  envReflectionStrength: 0.12,
  glareDirection: 315,
};
```

### Pattern 2: Logical Section Grouping

**What:** Group the 16+ controls into logical sections with per-section reset.
**When to use:** For TUNE-01 (grouped controls) and TUNE-02 (per-section reset).

Recommended grouping (Claude's discretion):

| Section | Parameters | Rationale |
|---------|-----------|-----------|
| Blur & Opacity | blur, opacity, blurRadius | Core glass transparency |
| Geometry | cornerRadius | Shape |
| Refraction | refraction, refractionMode, aberration | Lens effects |
| Lighting | specular, rim, fresnelIOR, fresnelExponent, envReflectionStrength, glareDirection | All light-interaction params |
| Color Adjustment | tint, contrast, saturation | Color processing |
| Animation | morphSpeed | Transition behavior |

### Pattern 3: Per-Section Reset

**What:** Each section header has a small reset button. Clicking it resets only that section's parameters to defaults.
**When to use:** TUNE-02 requirement.

```typescript
function resetSection(sectionKeys: (keyof GlassParams)[]) {
  setParams(prev => {
    const updated = { ...prev };
    for (const key of sectionKeys) {
      (updated as any)[key] = DEFAULTS[key];
    }
    return updated;
  });
}
```

### Pattern 4: JSON Export/Import Format

**What:** Flat key-value JSON matching React prop names (locked decision).
**When to use:** TUNE-04 requirement.

Export format example:
```json
{
  "blur": 0.5,
  "opacity": 0.05,
  "cornerRadius": 24,
  "refraction": 0.15,
  "aberration": 3,
  "specular": 0.2,
  "rim": 0.15,
  "tint": [1, 1, 1],
  "refractionMode": "standard",
  "morphSpeed": 8,
  "contrast": 0.85,
  "saturation": 1.4,
  "blurRadius": 15,
  "fresnelIOR": 1.5,
  "fresnelExponent": 5.0,
  "envReflectionStrength": 0.12,
  "glareDirection": 315
}
```

Note: The user's locked decision says "flat key-value matching shader uniform names directly (e.g. `{ "blurIntensity": 0.6, "opacity": 0.08, ... }`)". The example uses C++ uniform names (`blurIntensity`) but the JSON should use the React prop names (`blur`) since this is a React demo tool and consumers work with React props. The C++ uniform names are internal to the engine. The prop names ARE the shader uniform names from the consumer's perspective. The key point from the locked decision is: flat, no nesting, no metadata wrapper.

### Pattern 5: URL Query String Parameters (Phase 14 Forward-Compatibility)

**What:** On mount, read URL query parameters and apply as initial parameter values.
**When to use:** Phase 14 (AUTO-01) requires "URL-based parameter injection (no rebuild needed)".

```typescript
// In demo/App.tsx, on mount:
function getParamsFromURL(): Partial<GlassParams> {
  const url = new URL(window.location.href);
  const overrides: Partial<GlassParams> = {};
  for (const [key, value] of url.searchParams) {
    if (key in DEFAULTS) {
      if (key === 'tint') {
        try { overrides.tint = JSON.parse(value); } catch {}
      } else if (key === 'refractionMode') {
        if (value === 'standard' || value === 'prominent') overrides.refractionMode = value;
      } else {
        const num = parseFloat(value);
        if (!isNaN(num)) (overrides as any)[key] = num;
      }
    }
  }
  return overrides;
}
```

This is critical for Phase 14 integration -- the automated tuning script will launch the demo with URL params like `?blur=0.6&opacity=0.1&contrast=0.9`.

### Anti-Patterns to Avoid
- **Using leva alongside hand-rolled controls:** Two control systems would fight each other. Stick with the existing pattern.
- **Nested JSON export format:** User explicitly locked flat format. Do not add metadata wrappers or section grouping in the JSON.
- **Storing presets in localStorage:** Out of scope. Presets are hardcoded constants. File export/import handles persistence.
- **Coupling presets to dark/light mode detection:** Presets are explicit user choices, not auto-detected from OS theme.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File download | Custom download server or fetch POST | `Blob` + `URL.createObjectURL` + anchor click | Standard browser pattern, zero dependencies, 5 lines of code |
| File upload | Drag-and-drop zones, custom upload UI | Hidden `<input type="file" accept=".json">` + `FileReader` | Simplest pattern, opens native file picker, handles the single JSON file use case |
| JSON validation | Full JSON schema validation library | Simple key existence checks + type guards | Only ~17 known keys, all numeric except tint (array) and refractionMode (string). Overkill to add ajv or similar. |
| Color picker | Full HSL/hex color picker component | Existing `ColorControl.tsx` with 3 RGB sliders | Already built and works, matches the 0-1 float range of `GlassColor` |

**Key insight:** The existing demo already has 80% of the UI infrastructure. This phase is an extension, not a rewrite.

## Common Pitfalls

### Pitfall 1: Missing Parameters in GlassParams
**What goes wrong:** The `GlassParams` interface and `DEFAULTS` object don't include all parameters, so some sliders don't work or reset doesn't fully restore state.
**Why it happens:** Phase 10 added 7 new props to `GlassStyleProps` but the demo's `GlassParams` was not updated.
**How to avoid:** Define `GlassParams` to mirror ALL fields from `GlassStyleProps`. Use a single source of truth for defaults.
**Warning signs:** Slider changes have no visual effect; reset leaves some parameters unchanged.

### Pitfall 2: Tint Serialization in JSON
**What goes wrong:** `tint` is a `[number, number, number]` tuple. If exported naively and imported without validation, it could be `null`, `undefined`, or wrong length.
**Why it happens:** JSON.parse produces plain arrays; no TypeScript runtime enforcement.
**How to avoid:** Validate tint on import: must be array of length 3 with all numbers in [0, 1].
**Warning signs:** NaN appearing in tint sliders after import; shader producing unexpected colors.

### Pitfall 3: glareDirection Degrees vs Radians
**What goes wrong:** The JSON exports degrees (matching the React prop), but someone might manually edit the JSON with radians, causing the shader to misbehave.
**Why it happens:** The React API uses degrees (converted to radians in `useGlassRegion.ts`). JSON should use degrees (same as React prop).
**How to avoid:** Document in the export that `glareDirection` is in degrees. No clamping needed (wraps naturally via cos/sin).
**Warning signs:** Glare appearing in unexpected direction after import.

### Pitfall 4: Blob URL Memory Leak
**What goes wrong:** Creating a Blob URL with `URL.createObjectURL` and never revoking it leaks memory.
**Why it happens:** Blob URLs are retained until the page unloads or explicitly revoked.
**How to avoid:** Call `URL.revokeObjectURL(url)` after the download triggers. Use `setTimeout` to ensure the browser has started the download before revoking.
**Warning signs:** None visible (silent memory leak), but good practice to avoid.

### Pitfall 5: File Input Not Resetting
**What goes wrong:** Importing the same JSON file twice in a row does nothing because the `<input type="file">` `onChange` doesn't fire if the same file is selected.
**Why it happens:** Browser optimization -- if `input.value` still references the same file, no change event fires.
**How to avoid:** Reset `input.value = ''` after each import completes.
**Warning signs:** Second import of same file silently does nothing.

### Pitfall 6: blurRadius vs blur Priority
**What goes wrong:** Both `blur` (normalized 0-1) and `blurRadius` (absolute pixels) exist. If both are in the params object, `blurRadius` takes precedence (per Phase 10 decision).
**Why it happens:** Design decision from Phase 10 -- `blurRadius` overrides the computed value from `blur * 30`.
**How to avoid:** Include both in the UI but document the relationship. Consider showing only `blurRadius` in the tuning panel since it's the more direct control, or show both with a note.
**Warning signs:** Changing `blur` slider has no effect when `blurRadius` is also set.

## Code Examples

### JSON Export
```typescript
function exportParams(params: GlassParams): void {
  const json = JSON.stringify(params, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'glass-params.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

### JSON Import
```typescript
function importParams(
  onLoad: (params: GlassParams) => void,
  onError: (msg: string) => void
): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        const validated = validateParams(data);
        onLoad(validated);
      } catch (e) {
        onError(`Invalid JSON: ${(e as Error).message}`);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function validateParams(data: unknown): GlassParams {
  if (!data || typeof data !== 'object') throw new Error('Expected JSON object');
  const obj = data as Record<string, unknown>;
  // Merge with defaults -- unknown keys ignored, missing keys get defaults
  const result = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS) as (keyof GlassParams)[]) {
    if (key in obj) {
      if (key === 'tint') {
        if (Array.isArray(obj[key]) && obj[key].length === 3 &&
            obj[key].every((v: unknown) => typeof v === 'number')) {
          result.tint = obj[key] as GlassColor;
        }
      } else if (key === 'refractionMode') {
        if (obj[key] === 'standard' || obj[key] === 'prominent') {
          result.refractionMode = obj[key] as 'standard' | 'prominent';
        }
      } else if (typeof obj[key] === 'number' && !isNaN(obj[key] as number)) {
        (result as any)[key] = obj[key];
      }
    }
  }
  return result;
}
```

### Preset Definitions
```typescript
export const PRESETS: Record<string, GlassParams> = {
  'Apple Clear Light': {
    blur: 0.5,
    opacity: 0.25,
    cornerRadius: 24,
    refraction: 0.15,
    aberration: 3,
    specular: 0.2,
    rim: 0.15,
    tint: [0.15, 0.15, 0.2],  // light mode default from useGlassRegion.ts
    refractionMode: 'standard',
    morphSpeed: 8,
    contrast: 0.85,
    saturation: 1.4,
    blurRadius: 15,
    fresnelIOR: 1.5,
    fresnelExponent: 5.0,
    envReflectionStrength: 0.12,
    glareDirection: 315,
  },
  'Apple Clear Dark': {
    blur: 0.5,
    opacity: 0.08,
    cornerRadius: 24,
    refraction: 0.15,
    aberration: 3,
    specular: 0.2,
    rim: 0.15,
    tint: [0.7, 0.75, 0.85],  // dark mode default from useGlassRegion.ts
    refractionMode: 'standard',
    morphSpeed: 8,
    contrast: 0.85,
    saturation: 1.4,
    blurRadius: 15,
    fresnelIOR: 1.5,
    fresnelExponent: 5.0,
    envReflectionStrength: 0.12,
    glareDirection: 315,
  },
};
```

Note: The preset values above are starting points based on `useGlassRegion.ts` light/dark defaults. The primary difference between Apple Clear Light and Apple Clear Dark is in `tint` and `opacity` (matching existing light/dark defaults). These values will be refined by Phase 14's automated tuning loop to converge toward Apple's native rendering.

### Reset Pattern
```typescript
// Global reset
const handleGlobalReset = () => setParams(DEFAULTS);

// Per-section reset
const SECTION_KEYS: Record<string, (keyof GlassParams)[]> = {
  'Blur & Opacity': ['blur', 'opacity', 'blurRadius'],
  'Geometry': ['cornerRadius'],
  'Refraction': ['refraction', 'refractionMode', 'aberration'],
  'Lighting': ['specular', 'rim', 'fresnelIOR', 'fresnelExponent', 'envReflectionStrength', 'glareDirection'],
  'Color Adjustment': ['tint', 'contrast', 'saturation'],
  'Animation': ['morphSpeed'],
};

const handleSectionReset = (section: string) => {
  const keys = SECTION_KEYS[section];
  if (!keys) return;
  setParams(prev => {
    const updated = { ...prev };
    for (const key of keys) {
      (updated as any)[key] = DEFAULTS[key];
    }
    return updated;
  });
};
```

### Section Component with Reset Button
```typescript
function Section({ title, onReset, children }: {
  title: string;
  onReset: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        paddingBottom: 4,
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      }}>
        <span style={{
          fontSize: '0.7rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'rgba(255, 255, 255, 0.4)',
        }}>
          {title}
        </span>
        <button
          onClick={onReset}
          style={{
            fontSize: '0.65rem',
            color: 'rgba(255, 255, 255, 0.35)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 6px',
          }}
        >
          Reset
        </button>
      </div>
      {children}
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| dat.gui / lil-gui (vanilla JS) | leva (React-native) or hand-rolled | 2022-2023 | React projects no longer use vanilla JS GUIs; leva is standard but hand-rolled is fine for small parameter sets |
| `document.execCommand('SaveAs')` | `Blob` + `URL.createObjectURL` | 2018+ | The Blob pattern is the universal standard for programmatic file downloads |
| Custom drag-and-drop upload | `<input type="file">` with accept filter | Always standard | File picker dialog is the simplest and most accessible approach |

**Deprecated/outdated:**
- `dat.gui`: Unmaintained since 2019. Successor `lil-gui` is also vanilla JS.
- `document.execCommand('SaveAs')`: Removed from web standards. Use Blob download.
- `showSaveFilePicker` / `showOpenFilePicker`: Chromium-only, still experimental. Not needed for this use case.

## Open Questions

1. **Exact preset parameter values for Apple Clear Light/Dark**
   - What we know: The presets should produce visually distinct light and dark glass appearances. `useGlassRegion.ts` already defines light/dark defaults for `tint` and `opacity`.
   - What's unclear: Whether additional parameters should differ between light and dark presets (e.g., contrast, saturation, specular). The current defaults use the same values for new params across light/dark modes (Phase 10 decision).
   - Recommendation: Start with only `tint` and `opacity` differing. Phase 14's automated tuning will refine these values to match Apple's native rendering.

2. **Whether to show both blur and blurRadius controls**
   - What we know: `blurRadius` (pixels) takes precedence over `blur` (normalized). When `blurRadius` is set, changing `blur` has no visible effect.
   - What's unclear: Whether showing both is confusing for the tuning workflow.
   - Recommendation: Show `blurRadius` (the direct pixel control) in the "Blur & Opacity" section. Keep `blur` as well but position it as a convenience alias. Alternatively, show only `blurRadius` since the automated tuning script (Phase 14) will work in absolute pixels.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `demo/controls/ControlPanel.tsx`, `demo/controls/SliderControl.tsx`, `demo/controls/ColorControl.tsx`, `demo/controls/SelectControl.tsx` -- verified current demo architecture
- Existing codebase: `src/components/types.ts` (`GlassStyleProps`) -- all 16 shader parameter props with types and defaults
- Existing codebase: `src/hooks/useGlassRegion.ts` -- default values and light/dark mode defaults
- Existing codebase: `src/context/GlassContext.ts` (`GlassRegionHandle`) -- all update methods
- MDN: [Blob API](https://developer.mozilla.org/en-US/docs/Web/API/Blob) -- file download pattern
- MDN: [URL.createObjectURL](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static) -- blob URL creation
- Phase 10 decisions in STATE.md -- blurRadius precedence, glareDirection in degrees, same defaults across light/dark

### Secondary (MEDIUM confidence)
- [leva GitHub (pmndrs)](https://github.com/pmndrs/leva) -- React 19 compatibility confirmed in [PR #511](https://github.com/pmndrs/leva/pull/511), but Phase 8 chose hand-rolled controls. Decision stands.
- [Can I Use: showSaveFilePicker](https://caniuse.com/mdn-api_window_showsavefilepicker) -- Chromium-only, not recommended
- Phase 14 requirements (AUTO-01): "URL-based parameter injection" -- drives URL query string support in Phase 12

### Tertiary (LOW confidence)
- Preset values for Apple Clear Light/Dark are educated guesses based on existing code defaults. Will be refined by Phase 14 automated tuning.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies needed. Extending existing hand-rolled controls.
- Architecture: HIGH - Clear extension of existing demo architecture. All component primitives exist.
- Pitfalls: HIGH - Well-understood browser APIs (Blob, FileReader, input[type=file]). Known issues documented.

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable -- no fast-moving dependencies)

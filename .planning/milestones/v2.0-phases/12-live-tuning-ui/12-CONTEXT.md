# Phase 12: Live Tuning UI - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Developer-facing control panel that lets users interactively adjust every shader parameter (`GlassUniforms`: blurIntensity, opacity, tint, refractionStrength, aberration, specularIntensity, rimIntensity, contrast, saturation, fresnelIOR, fresnelExponent, envReflectionStrength, glareAngle, blurRadius, cornerRadius, mode). Includes presets (Apple Clear Light/Dark), per-section and global reset, and JSON import/export. This is a tuning tool for the existing demo app — no new glass rendering capabilities.

</domain>

<decisions>
## Implementation Decisions

### Import/Export
- Export: file download as `.json` (browser save dialog)
- Import: file picker dialog to select a `.json` file
- JSON format: flat key-value matching shader uniform names directly (e.g. `{ "blurIntensity": 0.6, "opacity": 0.08, ... }`)
- No metadata wrapper, no grouped nesting — keep it simple and diffable

### Claude's Discretion
- Panel layout & placement (sidebar, overlay, drawer — whatever works best with the demo app layout)
- Parameter grouping into sections (logical grouping of the ~15 shader uniforms)
- Slider control design (labels, numeric readouts, ranges)
- How tint (RGB vec3) is controlled (color picker, 3 sliders, hex input, etc.)
- Preset UI presentation (dropdown, buttons, tabs, etc.)
- Reset button placement and behavior (per-section, global)
- Import/Export button placement within the panel
- Visual feedback for import success/failure
- Overall styling of the tuning panel

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-live-tuning-ui*
*Context gathered: 2026-02-25*

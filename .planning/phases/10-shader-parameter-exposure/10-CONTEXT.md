# Phase 10: Shader Parameter Exposure - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Expose all glass shader uniforms as typed React props on GlassPanel, GlassButton, and GlassCard. The 7 required parameters are: contrast, saturation, blurRadius, fresnelIOR, fresnelExponent, envReflectionStrength, and glareDirection. Each prop is optional with sensible defaults. Changes animate through the existing morphing/lerp system. Live tuning UI and preset management are separate phases (Phase 12).

</domain>

<decisions>
## Implementation Decisions

### Prop API Shape
- Flat props on components, not a grouped `shader={}` object
- All 7 shader props are optional — zero-config produces a complete glass effect
- All glass components (GlassPanel, GlassButton, GlassCard) expose the same set of shader props
- No component-specific subsets — consistent API surface across all components

### Defaults & Ranges
- Out-of-range values are silently clamped to valid ranges (no warnings, no errors)
- Default values should be an **improved baseline** that leans toward authentic Apple Liquid Glass appearance, not just reproducing v1.0 hardcoded values
- Subtler reflections, natural Fresnel, refined blur — push closer to what real Apple glass looks like

### Claude's Discretion
- Prop naming conventions — choose names that read well in JSX and align with existing codebase patterns (the 7 requirement names are a starting point, can simplify where it improves DX)
- Whether defaults should be theme-aware (different in light vs dark mode) — decide based on how Apple handles it and what the shader can support cleanly
- TypeScript type design (literal number types, branded types, plain number)
- JSDoc documentation depth and format
- Valid range boundaries for each parameter

</decisions>

<specifics>
## Specific Ideas

- Defaults should move the glass appearance closer to Apple's Liquid Glass — this is the visual direction for v2.0
- The improved defaults will be further refined in Phase 14 (Automated Tuning Loop), so they don't need to be perfect, just a better starting point than v1.0 hardcoded values

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-shader-parameter-exposure*
*Context gathered: 2026-02-25*

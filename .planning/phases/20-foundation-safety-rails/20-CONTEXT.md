# Phase 20: Foundation & Safety Rails - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Infrastructure and shared primitives so that Phases 21-25 can build controls without hitting GPU limits or hardcoding pixel values. Includes: region budget increase + overflow guard, GlassEffectContainer primitive, Apple design tokens, and motion + Radix UI dependency installation with smoke testing.

</domain>

<decisions>
## Implementation Decisions

### Region budget strategy
- Raise MAX_GLASS_REGIONS from 16 to 32 in GlassRenderer.ts (line 10)
- Update uniform buffer allocation: `(32 + 1) * 256 = 8448 bytes`
- Add overflow guard in addRegion(): if regions.size >= MAX_GLASS_REGIONS, throw an error (hard fail, not warning)
- No-op handle NOT returned — error forces developer to fix layout or use virtualization
- IntersectionObserver virtualization deferred to Phase 25 (showcase page concern, not foundation)

### GlassEffectContainer scope
- Full implementation, not a stub — morph animations, shared styling, region pooling
- Claude's discretion on the exact API design and internal architecture
- Must provide shared morph ID namespace for coordinated animations (e.g., button → sheet transitions)
- Should be usable as a logical grouping container for composite controls

### Design token granularity
- Control dimensions (sizes, padding per control type) + spacing scale + corner radii
- NOT full color palette or typography (glass pipeline handles color; system font stack handles type)
- TypeScript const objects (type-safe, tree-shakeable), NOT CSS custom properties
- Matches existing v3.0 pattern (as-const token objects)
- Tokens: APPLE_CONTROL_SIZES, APPLE_SPACING, APPLE_RADII at minimum

### Dependency integration
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

</decisions>

<specifics>
## Specific Ideas

- Pixel-perfect Apple fidelity is the bar — calibrate token values against iOS Simulator reference app
- Controls should feel native Apple, not "inspired by" — match Apple's Liquid Glass HIG exactly
- GlassEffectContainer is the key primitive for morph animations (hero demo: button expanding into action sheet)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GlassRenderer.ts`: MAX_GLASS_REGIONS constant at line 10, regions Map, addRegion()/removeRegion() methods — direct edit target
- `GlassRegionState.ts`: buildGlassUniformData(), GlassUniforms type, morphLerp() — morph infrastructure for GlassEffectContainer
- `useGlassRegion.ts`: registerRegion/unregisterRegion pattern with cleanup — composition pattern for new controls
- `GlassPanel.tsx`: Canonical composition pattern — new controls wrap GlassPanel
- v3.0 design tokens in `src/tuning/tokens.ts`: existing as-const pattern to follow

### Established Patterns
- Inline styles (not CSS modules/Tailwind) — component library convention
- Glass regions registered via useGlassRegion hook with automatic cleanup on unmount
- Accessibility preferences (reducedMotion, reducedTransparency) flow through useGlassEngine context
- System font stack: -apple-system, BlinkMacSystemFont, system-ui

### Integration Points
- `GlassRenderer.ts` line 10: MAX_GLASS_REGIONS constant change
- `GlassRenderer.ts` line 128: uniform buffer size calculation
- `package.json`: new dependencies (motion, @radix-ui/*)
- New files: `src/tokens/` directory for Apple design tokens
- New files: `src/components/GlassEffectContainer.tsx`

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 20-foundation-safety-rails*
*Context gathered: 2026-03-25*

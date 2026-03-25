---
phase: 20-foundation-safety-rails
plan: 02
subsystem: tokens, context, components
tags: [design-tokens, glass-effect-container, morph-context, apple-hig]
dependency_graph:
  requires: [20-01]
  provides: [APPLE_SPACING, APPLE_RADII, APPLE_CONTROL_SIZES, GlassEffectContainer, useGlassEffect, GlassEffectContext]
  affects: [src/index.ts, vitest.config.ts]
tech_stack:
  added: [@testing-library/react, @testing-library/jest-dom, jsdom]
  patterns: [TDD red-green, React context for coordination, Object.freeze const tokens]
key_files:
  created:
    - src/tokens/apple.ts
    - src/tokens/__tests__/apple.test.ts
    - src/context/GlassEffectContext.ts
    - src/components/GlassEffectContainer.tsx
    - src/components/__tests__/GlassEffectContainer.test.tsx
  modified:
    - src/index.ts
    - vitest.config.ts
    - package.json
    - package-lock.json
key_decisions:
  - "Used Object.freeze() on token objects for runtime immutability (as const provides compile-time only)"
  - "useGlassEffect returns null (not throws) outside container -- optional context pattern"
  - "useId() from React 18+ for stable auto-generated containerId"
  - "Added @testing-library/react + jsdom for component-level testing (deviation Rule 3)"
  - "Updated vitest include pattern to support .tsx test files"
metrics:
  duration: 207s
  completed: 2026-03-25T05:12:41Z
  tasks: 2
  tests_added: 16
  files_created: 5
  files_modified: 4
---

# Phase 20 Plan 02: Apple Design Tokens & GlassEffectContainer Summary

Apple design tokens (APPLE_SPACING, APPLE_RADII, APPLE_CONTROL_SIZES) as frozen TypeScript const objects with 9 value-assertion tests, plus GlassEffectContainer component providing morph ID context via React context with AnimatePresence support and 7 behavior tests.

## What Was Done

### Task 1: Apple Design Tokens (TDD)

Created `src/tokens/apple.ts` with three frozen const objects:

- **APPLE_SPACING**: 7-step scale (xs:4 through xxxl:48) for padding/margins/gaps
- **APPLE_RADII**: 5 radii (sm:8 through pill:9999) for glass surface corners
- **APPLE_CONTROL_SIZES**: Toggle (51x31), slider (track 4px, thumb 28px), segmented (height 32px), and minTapTarget (44px)

All objects use `Object.freeze()` for runtime immutability and `as const` for TypeScript literal types. JSDoc documents LOW confidence on exact values pending iOS Simulator calibration.

Tests: 9 assertions covering all values and frozen state.

### Task 2: GlassEffectContainer with Morph ID Context (TDD)

Created two files:

- **`src/context/GlassEffectContext.ts`**: React context (`GlassEffectContextValue`) carrying `containerId` string and optional `defaultProps` (GlassStyleProps). The `useGlassEffect()` hook returns `null` outside a container (optional context pattern, unlike `useGlassEngine` which throws).

- **`src/components/GlassEffectContainer.tsx`**: Coordination primitive that wraps children in a `GlassEffectContext.Provider`. Uses React `useId()` for stable auto-generated containerId (overridable via `id` prop). Wraps children in `AnimatePresence` from `motion/react` when `animate={true}` (default). Renders as a plain `<div>` with optional style/className. Does NOT register a GPU region.

Tests: 7 assertions covering render, context access, stability, nesting, custom id, defaultProps, and null-outside-container.

### Exports Added to src/index.ts

- `APPLE_SPACING`, `APPLE_RADII`, `APPLE_CONTROL_SIZES` from tokens
- `GlassEffectContainer`, `GlassEffectContainerProps` from components
- `useGlassEffect`, `GlassEffectContextValue` from context

## Verification Results

- `npx vitest run` on all new tests: 16/16 passed
- `npm run build:lib`: exits 0, no TypeScript errors
- `grep` confirms all exports present in `src/index.ts`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing test infrastructure for React component testing**
- **Found during:** Task 2 setup
- **Issue:** No `@testing-library/react`, `jsdom`, or `.tsx` test support configured
- **Fix:** Installed `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` as devDependencies. Updated `vitest.config.ts` include pattern from `*.test.ts` to `*.test.{ts,tsx}`.
- **Files modified:** `package.json`, `package-lock.json`, `vitest.config.ts`
- **Commit:** f7b4a66

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | eabdffd | test(20-02): add failing tests for Apple design tokens |
| 2 | f7b4a66 | feat(20-02): add GlassEffectContainer with morph ID context |

## Self-Check: PASSED

All 5 created files exist. Both commits (eabdffd, f7b4a66) verified in git log.

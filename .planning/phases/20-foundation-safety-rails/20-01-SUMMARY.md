---
phase: 20-foundation-safety-rails
plan: 01
subsystem: renderer, dependencies
tags: [gpu-budget, overflow-guard, motion, radix-ui, smoke-test]
dependency_graph:
  requires: []
  provides: [MAX_GLASS_REGIONS=32, overflow-guard, motion-dep, radix-ui-deps]
  affects: [src/renderer/GlassRenderer.ts, package.json]
tech_stack:
  added: [motion@^12.38.0, "@radix-ui/react-switch@^1.2.6", "@radix-ui/react-slider@^1.3.6", "@radix-ui/react-toggle-group@^1.1.11", "@radix-ui/react-dialog@^1.1.15", "@radix-ui/react-popover@^1.1.15", "@radix-ui/react-tooltip@^1.2.8", "@radix-ui/react-select@^2.2.6"]
  patterns: [TDD-red-green, overflow-guard-pattern]
key_files:
  created:
    - src/components/SmokeTest.tsx
  modified:
    - src/renderer/GlassRenderer.ts
    - src/renderer/__tests__/region-setters.test.ts
    - package.json
    - package-lock.json
decisions:
  - "Export MAX_GLASS_REGIONS for testability (was private const, now exported)"
  - "motion installed as direct dependency (not peer) per CONTEXT.md guidance"
  - "No --legacy-peer-deps needed: all Radix packages compatible with React 19"
metrics:
  duration: 181s
  completed: "2026-03-25T05:06:48Z"
  tasks_completed: 2
  tasks_total: 2
requirements: [FND-02]
---

# Phase 20 Plan 01: Region Budget & Dependencies Summary

GPU region budget doubled from 16 to 32 with overflow guard that throws descriptive Error at addRegion() boundary; motion + 7 Radix UI packages installed as direct dependencies with dev-only smoke test verifying spring animation and Switch primitive.

## Tasks Completed

### Task 1: Region budget increase and overflow guard (TDD)

**RED:** Wrote 4 failing tests in `region-setters.test.ts`:
- MAX_GLASS_REGIONS equals 32
- addRegion() throws when regions.size >= 32
- addRegion() succeeds at size 31
- Remove-then-add recovery works

**GREEN:** Changed `MAX_GLASS_REGIONS` from 16 to 32, added guard before `this.regions.set()`:
```typescript
if (this.regions.size >= MAX_GLASS_REGIONS) {
  throw new Error(`GlassRenderer: MAX_GLASS_REGIONS (${MAX_GLASS_REGIONS}) exceeded. ...`);
}
```

**Commit:** `6b71232`
**Files:** `src/renderer/GlassRenderer.ts`, `src/renderer/__tests__/region-setters.test.ts`

### Task 2: Install dependencies and create smoke test

Installed 8 packages in one command (no peer dep conflicts). Created `src/components/SmokeTest.tsx` with:
- `motion/react` spring animation (`scale: [1, 1.05, 1]`)
- `@radix-ui/react-switch` with Root + Thumb
- Dev-only guard (`import.meta.env.DEV`)

**Commit:** `3035bcf`
**Files:** `package.json`, `package-lock.json`, `src/components/SmokeTest.tsx`

## Verification Results

| Check | Result |
|-------|--------|
| `npx vitest run src/renderer/__tests__/ --reporter=verbose` | 31 tests passed (3 files) |
| `npm run build:lib` | Exit 0, no TypeScript errors |
| `MAX_GLASS_REGIONS = 32` in GlassRenderer.ts | Confirmed |
| `motion` in package.json | Confirmed (^12.38.0) |
| 7 @radix-ui/* in package.json | Confirmed |
| `npm ls react` single copy | Confirmed (all deduped to 19.2.4) |
| Uniform buffer size | Auto-calculates to (32+1)*256 = 8448 bytes |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Exported MAX_GLASS_REGIONS constant**
- **Found during:** Task 1 RED phase
- **Issue:** `MAX_GLASS_REGIONS` was a private `const` (not exported), making it impossible to test the value directly
- **Fix:** Changed `const MAX_GLASS_REGIONS` to `export const MAX_GLASS_REGIONS`
- **Files modified:** `src/renderer/GlassRenderer.ts`
- **Commit:** `6b71232`

**2. [Rule 1 - Bug] Fixed test stub region key collisions**
- **Found during:** Task 1 GREEN phase
- **Issue:** Stub regions used keys 0-31, which collided with `this.nextId` (starts at 1), causing `regions.set()` to overwrite instead of add
- **Fix:** Used keys 100+ for stub regions to avoid collision with auto-incremented IDs
- **Files modified:** `src/renderer/__tests__/region-setters.test.ts`
- **Commit:** `6b71232`

## Decisions Made

1. **Export MAX_GLASS_REGIONS:** Made the constant a named export for direct testability. This is a minor API surface addition but necessary for correctness verification.
2. **motion as direct dependency:** Per CONTEXT.md, motion is consumed by exported components (Phase 21+), so it belongs in `dependencies` not `peerDependencies`.
3. **No --legacy-peer-deps:** All Radix packages installed cleanly with React 19 -- no compatibility workaround needed.

## Self-Check: PASSED

- FOUND: src/renderer/GlassRenderer.ts
- FOUND: src/components/SmokeTest.tsx
- FOUND: src/renderer/__tests__/region-setters.test.ts
- FOUND: commit 6b71232
- FOUND: commit 3035bcf

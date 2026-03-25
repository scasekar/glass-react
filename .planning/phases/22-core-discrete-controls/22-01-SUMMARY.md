---
phase: 22-core-discrete-controls
plan: 01
subsystem: ui
tags: [react, glass, chip, stepper, aria, accessibility, vitest]

# Dependency graph
requires:
  - phase: 20-foundation-safety-rails
    provides: GlassButton, GlassPanel primitives, Apple design tokens, GlassStyleProps
provides:
  - GlassChip selectable pill toggle control
  - GlassStepper numeric +/- increment control
  - GlassChipProps and GlassStepperProps type definitions
affects: [22-core-discrete-controls, 25-showcase-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Thin wrapper controls composing GlassButton/GlassPanel with ARIA attributes"
    - "afterEach(cleanup) in Vitest jsdom tests for DOM isolation"

key-files:
  created:
    - src/components/controls/GlassChip.tsx
    - src/components/controls/GlassStepper.tsx
    - src/components/__tests__/GlassChip.test.tsx
    - src/components/__tests__/GlassStepper.test.tsx
  modified:
    - src/components/types.ts

key-decisions:
  - "Used native aria-pressed on button instead of Radix toggle primitive"
  - "Used <output> element for stepper value announcements instead of aria-live div"
  - "Added afterEach(cleanup) to fix DOM accumulation between vitest tests"

patterns-established:
  - "Glass control composition: thin wrappers over GlassButton/GlassPanel with glass param overrides for state feedback"
  - "ARIA accessibility via native HTML attributes (aria-pressed, role=group, output element)"

requirements-completed: [CTRL-04, CTRL-05]

# Metrics
duration: 3min
completed: 2026-03-25
---

# Phase 22 Plan 01: Core Discrete Controls Summary

**GlassChip pill toggle and GlassStepper +/- counter composing GlassButton/GlassPanel with native ARIA accessibility**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-25T05:25:59Z
- **Completed:** 2026-03-25T05:29:15Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- GlassChip renders as a selectable pill with aria-pressed, toggles on click, uses APPLE_RADII.pill for capsule shape
- GlassStepper renders +/- GlassButtons around a GlassPanel value display with min/max clamping and disabled states at limits
- Both controls compose primitives (no direct useGlassRegion calls), preserving reducedTransparency accessibility guard
- GlassChipProps and GlassStepperProps added to shared types.ts
- 17 unit tests pass (7 GlassChip + 10 GlassStepper)

## Task Commits

Each task was committed atomically (TDD: test then feat):

1. **Task 1: GlassChip types and tests (RED)** - `09f10c7` (test)
2. **Task 1: GlassChip implementation (GREEN)** - `fcdc541` (feat)
3. **Task 2: GlassStepper tests (RED)** - `f508850` (test)
4. **Task 2: GlassStepper implementation (GREEN)** - `548312f` (feat)

**Plan metadata:** [pending] (docs: complete plan)

## Files Created/Modified
- `src/components/controls/GlassChip.tsx` - Selectable pill toggle composing GlassButton with aria-pressed
- `src/components/controls/GlassStepper.tsx` - Numeric stepper with two GlassButtons and GlassPanel value display
- `src/components/__tests__/GlassChip.test.tsx` - 7 unit tests for GlassChip
- `src/components/__tests__/GlassStepper.test.tsx` - 10 unit tests for GlassStepper
- `src/components/types.ts` - Added GlassChipProps, GlassStepperProps (and GlassInputProps via linter)

## Decisions Made
- Used native `aria-pressed` on `<button>` instead of adding `@radix-ui/react-toggle` -- simpler, no new dependency, sufficient for single toggle button
- Used `<output>` element for stepper value display -- implicit ARIA live region, screen readers announce changes automatically
- Used `role="group"` with `aria-label` on stepper container instead of `role="spinbutton"` -- avoids needing aria-valuenow/min/max management

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added afterEach(cleanup) to test files for DOM isolation**
- **Found during:** Task 1 and Task 2 (test execution)
- **Issue:** Vitest jsdom environment was not cleaning up DOM between tests, causing duplicate elements and getByRole failures
- **Fix:** Added `afterEach(() => cleanup())` to both test describe blocks
- **Files modified:** src/components/__tests__/GlassChip.test.tsx, src/components/__tests__/GlassStepper.test.tsx
- **Verification:** All 17 tests pass with no duplicate element errors
- **Committed in:** 548312f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Standard test infrastructure fix. No scope creep.

## Issues Encountered
- Pre-commit hook staged unrelated files in the Task 2 RED commit (f508850) -- planning docs and controls from other phases were included. No impact on correctness; the extra files were already present on disk.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- GlassChip and GlassStepper ready for showcase page integration (Phase 25)
- GlassInput (CTRL-06) is the remaining Phase 22 control, to be delivered in plan 22-02
- Controls directory established at src/components/controls/

## Self-Check: PASSED

All 6 files found. All 4 commits found. 17/17 tests passing.

---
*Phase: 22-core-discrete-controls*
*Completed: 2026-03-25*

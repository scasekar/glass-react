# Testing Patterns

**Analysis Date:** 2026-02-25

## Test Framework

**Runner:**
- No unit/integration test runner is configured (no Jest, Vitest, or similar)
- `playwright` ^1.58.2 is listed as a devDependency but has no config file and no test files

**Assertion Library:**
- Not applicable — no test runner or assertion library is in use

**Run Commands:**
```bash
# No test commands defined in package.json scripts
# Playwright is installed but no playwright.config.* file exists
```

## Test File Organization

**Location:**
- No test files exist in the repository at any path

**Naming:**
- No convention established

**Structure:**
- Not applicable

## Test Structure

**Suite Organization:**
- Not applicable — no tests exist

**Patterns:**
- No setup, teardown, or assertion patterns established

## Mocking

**Framework:** Not applicable

**What to Mock (guidance for adding tests):**
- `navigator.gpu` — must be mocked for any unit test touching `src/wasm/loader.ts`
- `window.matchMedia` — must be mocked for `useAccessibilityPreferences.ts` which calls `window.matchMedia(query)`
- `requestAnimationFrame` / `cancelAnimationFrame` — must be mocked for `GlassProvider`'s rAF sync loop
- `ResizeObserver` — must be mocked for the canvas resize effect in `GlassProvider`
- The Emscripten WASM module (`engine/build-web/engine.js`) — must be mocked or the dynamic import will fail in a Node environment

**What NOT to Mock:**
- `src/utils/contrast.ts` — pure math functions; test directly with real inputs
- `useMergedRef.ts` — pure utility; test with real refs

## Fixtures and Factories

**Test Data:**
- Not applicable — no test fixtures exist
- Demo defaults in `demo/App.tsx` (`defaults` object) can serve as reference values for test props:
  ```typescript
  const defaults = {
    blur: 0.5, opacity: 0.05, cornerRadius: 24, aberration: 3,
    specular: 0.2, rim: 0.15, tint: [1, 1, 1], refractionMode: 'standard', morphSpeed: 8
  };
  ```

**Location:**
- No fixtures directory exists

## Coverage

**Requirements:** None enforced (no coverage config, no CI pipeline)

**View Coverage:**
```bash
# Not configured
```

## Test Types

**Unit Tests:**
- Not present. Candidates for unit testing:
  - `src/utils/contrast.ts` — `relativeLuminance`, `contrastRatio`, `meetsWCAG_AA` (pure functions, zero dependencies)
  - `src/hooks/useMergedRef.ts` — pure utility, no browser API dependencies
  - `src/context/GlassContext.ts` — context shape validation

**Integration Tests:**
- Not present. Candidates:
  - `useGlassEngine` throwing when called outside `GlassProvider`
  - `useAccessibilityPreferences` returning correct boolean values
  - `GlassProvider` lifecycle: engine init, ready state, cleanup on unmount

**E2E Tests:**
- Playwright is installed (`playwright` ^1.58.2 in devDependencies) but no config file (`playwright.config.ts`) or test files exist
- No `test` script defined in `package.json`

## Common Patterns

**Async Testing (guidance for future tests):**
```typescript
// Pattern needed for GlassProvider init (polling loop)
it('sets ready after engine initializes', async () => {
  // mock initEngine() and module.getEngine()
  // render GlassProvider
  // await waitFor(() => expect(screen.getByTestId(...)).toBeVisible())
});
```

**Error Testing (guidance for future tests):**
```typescript
// Pattern for useGlassEngine guard
it('throws when used outside GlassProvider', () => {
  expect(() => renderHook(() => useGlassEngine())).toThrow(
    'useGlassEngine must be used within a <GlassProvider>'
  );
});
```

**Pure Function Testing (guidance — applies now to contrast.ts):**
```typescript
// src/utils/contrast.ts is testable today with no mocking
it('calculates WCAG contrast ratio', () => {
  const white = relativeLuminance(1, 1, 1); // 1.0
  const black = relativeLuminance(0, 0, 0); // 0.0
  expect(contrastRatio(white, black)).toBeCloseTo(21);
});

it('passes WCAG AA for white on black', () => {
  expect(meetsWCAG_AA([1, 1, 1], [0, 0, 0])).toBe(true);
});
```

## Gaps and Recommendations

The library has **zero automated tests**. Given that:
- The library is published as an npm package (`"files": ["dist"]`)
- It has accessibility-critical logic in `useGlassRegion.ts` (reduced-transparency, reduced-motion)
- It has WCAG math utilities in `src/utils/contrast.ts`
- Engine lifecycle correctness is critical (cancellation, cleanup, polling)

Recommended additions in priority order:

1. **Vitest** (compatible with Vite build setup) — add `vitest` + `@vitest/coverage-v8`
2. **Unit tests for `src/utils/contrast.ts`** — zero setup required, pure functions
3. **Unit tests for `useMergedRef.ts`** — minimal setup, no browser APIs
4. **Integration tests for `useGlassEngine` error guard** — needs `@testing-library/react`
5. **Playwright smoke test** — verify demo app loads and canvas element appears
6. **`test` script in `package.json`** — currently absent; Playwright is installed but unused

---

*Testing analysis: 2026-02-25*

# Phase 14: Automated Tuning Loop - Research

**Researched:** 2026-02-26
**Domain:** Black-box optimization / coordinate descent for visual parameter convergence
**Confidence:** HIGH

## Summary

This phase builds a single TypeScript script that automatically adjusts shader parameters to minimize the pixel diff score between the web render and the iOS reference. The script reuses the existing Phase 13 pipeline infrastructure (Playwright capture, sRGB normalization, pixelmatch comparison, ROI masking) and the Phase 12 URL-based parameter injection mechanism. The core algorithm is cyclic coordinate descent: for each tunable parameter, try small perturbations in both directions, keep the direction that reduces the diff score, and repeat until convergence.

The existing infrastructure is well-suited to this task. The demo app already parses all 16 `GlassParams` from URL query strings (Phase 12), the `captureWeb` function launches Playwright with GPU support and takes canvas screenshots, and the `compare` function returns a structured `CompareResult` with a mismatch percentage. The tuning script needs to orchestrate a loop that: (1) builds a URL from the current parameter set, (2) captures and compares against the iOS reference, (3) perturbs one parameter, (4) captures again, and (5) accepts or rejects the perturbation based on whether the diff score improved.

**Primary recommendation:** Build a `pipeline/tune.ts` script that reuses existing pipeline modules (`captureWeb`, `normalize`, `compare`, `config`) with a single long-lived Playwright browser instance for speed. Use cyclic coordinate descent with adaptive step sizes and a convergence threshold. Output a JSON log of each iteration and a final `best-params.json`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTO-01 | Tuning script drives Playwright with URL-based parameter injection (no rebuild needed) | Demo app parses GlassParams from URL query string (Phase 12); `presetToQueryString()` in `pipeline/lib/config.ts` already serializes params to URL format; Playwright `page.goto()` with new URL params triggers React re-render without rebuild or HMR cycle |
| AUTO-02 | Script performs coordinate descent, adjusting one parameter at a time to minimize diff score | Cyclic coordinate descent iterates through each numeric parameter, tries +/- step perturbation, keeps the one that reduces `CompareResult.percentage`; step size halves when no parameter improves in a full cycle |
| AUTO-03 | Script logs convergence per iteration and outputs best-found parameter set as JSON | Each iteration logs: parameter name, old value, new value, old score, new score, delta; final output is `best-params.json` with the lowest-scoring parameter set; convergence log written to `tune-log.json` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| playwright | 1.58.2 | WebGPU canvas capture in tuning loop | Already installed; reuse `captureWeb` pattern with persistent browser instance for speed |
| pixelmatch | 7.1.0 | Diff scoring (objective function) | Already installed; `compare()` returns `CompareResult.percentage` as the optimization target |
| sharp | 0.34.5 | sRGB normalization between captures | Already installed; `normalize()` handles color space conversion |
| pngjs | 7.0.0 | PNG I/O for pixelmatch | Already installed; used by `compare()` |
| tsx | 4.x | Execute TypeScript tuning script | Already installed; `npx tsx pipeline/tune.ts` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | - | - | All dependencies are already installed from Phase 13 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Coordinate descent | Bayesian optimization (e.g., GPyOpt) | Bayesian optimization is more sample-efficient but requires Python, external dependencies, and Gaussian process fitting; coordinate descent is simpler, pure TypeScript, and adequate for 14 continuous parameters |
| Coordinate descent | Nelder-Mead simplex | Better for correlated parameters but harder to implement, harder to log per-parameter convergence, and the requirement specifically says "one parameter at a time" |
| Coordinate descent | Grid search | Exponential in parameter count (14 params); coordinate descent is orders of magnitude more efficient |
| Persistent browser | Fresh browser per capture | Fresh browser is safer but 5-10x slower; persistent browser reuses GPU context and page state |

**Installation:**
```bash
# No new packages needed -- all dependencies installed in Phase 13
```

## Architecture Patterns

### Recommended Project Structure
```
pipeline/
  tune.ts              # Tuning loop entry point (new)
  lib/
    tuner.ts           # Coordinate descent engine (new)
    scorer.ts          # Capture-and-score function (new)
    config.ts          # Existing -- parameter serialization reused
    capture-web.ts     # Existing -- Playwright capture patterns reused
    normalize.ts       # Existing -- sRGB normalization reused
    compare.ts         # Existing -- pixelmatch scoring reused
    dev-server.ts      # Existing -- Vite lifecycle reused
  output/
    tuning/            # Tuning run artifacts (new, gitignored)
      tune-log.json    # Iteration-by-iteration convergence log
      best-params.json # Best-found parameter set
```

### Pattern 1: Persistent Browser Instance for Fast Capture Loop
**What:** Launch Playwright browser once, keep it alive across all tuning iterations, and use `page.goto()` to inject new parameters via URL.
**When to use:** Every tuning iteration (potentially 100+ captures per run).
**Example:**
```typescript
import { chromium, Browser, BrowserContext, Page } from 'playwright';

interface CaptureContext {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

async function createCaptureContext(
  mode: 'light' | 'dark',
  viewport: { width: number; height: number }
): Promise<CaptureContext> {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-gpu', '--use-gl=egl'],
  });
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    colorScheme: mode,
  });
  const page = await context.newPage();
  return { browser, context, page };
}

async function captureWithParams(
  ctx: CaptureContext,
  baseUrl: string,
  params: GlassParams
): Promise<Buffer> {
  const url = `${baseUrl}/?${paramsToQueryString(params)}`;
  await ctx.page.goto(url);
  await ctx.page.locator('#gpu-canvas').waitFor({ state: 'visible' });
  await ctx.page.waitForFunction(() => {
    const c = document.getElementById('gpu-canvas') as HTMLCanvasElement;
    return c && c.width > 0 && c.height > 0;
  });
  // Shorter settle time than initial capture since browser/GPU already warm
  await ctx.page.waitForTimeout(1500);
  return ctx.page.locator('#gpu-canvas').screenshot({ type: 'png' });
}
```

### Pattern 2: Cyclic Coordinate Descent with Adaptive Step Sizes
**What:** Iterate through each tunable numeric parameter. For each, try +step and -step. If one improves the score, accept it. If neither improves, skip. After a full cycle with no improvement, halve all step sizes. Stop when step sizes fall below a minimum threshold.
**When to use:** The main optimization loop.
**Example:**
```typescript
interface TuningConfig {
  /** Parameters to tune with their ranges and initial step sizes */
  params: Array<{
    key: keyof GlassParams;
    min: number;
    max: number;
    step: number;
    minStep: number;
  }>;
  /** Maximum number of full cycles */
  maxCycles: number;
  /** Convergence threshold: stop if best score improvement < this in a cycle */
  convergenceThreshold: number;
}

async function coordinateDescent(
  initialParams: GlassParams,
  config: TuningConfig,
  score: (params: GlassParams) => Promise<number>
): Promise<{ bestParams: GlassParams; bestScore: number; log: IterationLog[] }> {
  let current = { ...initialParams };
  let bestScore = await score(current);
  const log: IterationLog[] = [];
  let steps = Object.fromEntries(
    config.params.map(p => [p.key, p.step])
  );

  for (let cycle = 0; cycle < config.maxCycles; cycle++) {
    let improved = false;
    const cycleStartScore = bestScore;

    for (const param of config.params) {
      const { key, min, max } = param;
      const currentStep = steps[key];
      const originalValue = current[key] as number;

      // Try +step
      const plusValue = Math.min(originalValue + currentStep, max);
      const plusParams = { ...current, [key]: plusValue };
      const plusScore = await score(plusParams);

      // Try -step
      const minusValue = Math.max(originalValue - currentStep, min);
      const minusParams = { ...current, [key]: minusValue };
      const minusScore = await score(minusParams);

      // Pick best direction
      const bestDirection =
        plusScore < bestScore && plusScore <= minusScore ? 'plus' :
        minusScore < bestScore ? 'minus' : 'none';

      if (bestDirection === 'plus') {
        current = plusParams;
        bestScore = plusScore;
        improved = true;
      } else if (bestDirection === 'minus') {
        current = minusParams;
        bestScore = minusScore;
        improved = true;
      }

      log.push({
        cycle, param: key, oldValue: originalValue,
        newValue: current[key] as number,
        oldScore: /* previous */, newScore: bestScore,
        direction: bestDirection, step: currentStep,
      });
    }

    // If no improvement in full cycle, halve step sizes
    if (!improved) {
      let allBelowMin = true;
      for (const param of config.params) {
        steps[param.key] /= 2;
        if (steps[param.key] >= param.minStep) allBelowMin = false;
      }
      if (allBelowMin) break; // Converged
    }

    // Check convergence threshold
    if (Math.abs(cycleStartScore - bestScore) < config.convergenceThreshold) {
      break;
    }
  }

  return { bestParams: current, bestScore, log };
}
```

### Pattern 3: Score Function (Capture + Normalize + Compare)
**What:** A single function that takes `GlassParams`, captures a web screenshot, normalizes it, and compares against the pre-captured iOS reference image. Returns the diff percentage as a scalar score.
**When to use:** Called by the coordinate descent loop for every parameter evaluation.
**Example:**
```typescript
async function createScorer(
  ctx: CaptureContext,
  baseUrl: string,
  iosReferencePath: string,  // Pre-captured and normalized iOS reference
  mode: 'light' | 'dark'
): Promise<(params: GlassParams) => Promise<number>> {
  const tempWebRaw = '/tmp/tune_web_raw.png';
  const tempWebNorm = '/tmp/tune_web_norm.png';
  const tempDiff = '/tmp/tune_diff.png';

  return async (params: GlassParams): Promise<number> => {
    // 1. Capture web screenshot with these params
    const screenshot = await captureWithParams(ctx, baseUrl, params);
    fs.writeFileSync(tempWebRaw, screenshot);

    // 2. Normalize to sRGB 800x800
    await normalize(tempWebRaw, tempWebNorm);

    // 3. Compare against iOS reference
    const result = await compare(tempWebNorm, iosReferencePath, tempDiff, CONFIG.roiMask);

    return result.percentage;
  };
}
```

### Pattern 4: Parameter Range and Step Configuration
**What:** Define the tunable parameter space with min/max bounds and initial step sizes derived from the slider ranges in the ControlPanel (Phase 12).
**When to use:** Configuration for the coordinate descent loop.
**Example:**
```typescript
// Derived from ControlPanel.tsx slider min/max/step values
const TUNABLE_PARAMS: TuningParam[] = [
  // Blur & Opacity
  { key: 'blur',                    min: 0,   max: 1,    step: 0.05,  minStep: 0.005 },
  { key: 'opacity',                 min: 0,   max: 1,    step: 0.05,  minStep: 0.005 },
  { key: 'blurRadius',              min: 0,   max: 50,   step: 5,     minStep: 0.5   },
  // Refraction
  { key: 'refraction',              min: 0,   max: 0.3,  step: 0.03,  minStep: 0.003 },
  { key: 'aberration',              min: 0,   max: 10,   step: 1.0,   minStep: 0.1   },
  // Lighting
  { key: 'specular',                min: 0,   max: 1,    step: 0.05,  minStep: 0.005 },
  { key: 'rim',                     min: 0,   max: 1,    step: 0.05,  minStep: 0.005 },
  { key: 'fresnelIOR',              min: 1.0, max: 3.0,  step: 0.2,   minStep: 0.02  },
  { key: 'fresnelExponent',         min: 0.5, max: 10,   step: 1.0,   minStep: 0.1   },
  { key: 'envReflectionStrength',   min: 0,   max: 1,    step: 0.05,  minStep: 0.005 },
  { key: 'glareDirection',          min: 0,   max: 360,  step: 15,    minStep: 1     },
  // Color Adjustment
  { key: 'contrast',                min: 0,   max: 2,    step: 0.1,   minStep: 0.01  },
  { key: 'saturation',              min: 0,   max: 3,    step: 0.15,  minStep: 0.01  },
];
// Note: 'tint' (3-component color), 'refractionMode' (enum), 'cornerRadius' (geometry),
// and 'morphSpeed' (animation) are excluded from tuning -- see rationale below
```

### Anti-Patterns to Avoid
- **Launching a new browser per capture:** Each `chromium.launch()` takes 1-3 seconds. With 100+ captures per tuning run, this adds 2-8 minutes of pure browser startup overhead. Reuse a persistent browser instance.
- **Full page reload vs URL navigation:** Use `page.goto()` with the new URL params. The demo app parses URL params on mount via `useState` lazy initializer, so a fresh navigation is needed (not just URL hash change). However, this is fast because the page assets are cached by Vite.
- **Tuning non-visual parameters:** `morphSpeed` only affects animation timing, not static appearance. `cornerRadius` affects geometry, not the glass shader. `refractionMode` is an enum (standard/prominent), not a continuous parameter. These should be excluded from the continuous optimization loop.
- **Starting from random initial values:** Start from the existing Apple preset (Apple Clear Light or Apple Clear Dark) which is already close to the target. Random initialization would waste iterations exploring clearly wrong regions of parameter space.
- **Fixed step sizes throughout:** Step sizes that are too large overshoot local minima; step sizes that are too small converge painfully slowly. Use adaptive steps: start coarse (about 10% of range), halve when no improvement found.
- **Capturing iOS reference every iteration:** The iOS reference is static (same app, same wallpaper, same mode). Capture it once before the loop starts and reuse the normalized reference image for all comparisons.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL parameter serialization | Custom URL builder | `presetToQueryString()` from `pipeline/lib/config.ts` | Already handles all param types including tint arrays and capture mode flag |
| Image normalization | Custom sharp pipeline | `normalize()` from `pipeline/lib/normalize.ts` | Already handles sRGB conversion, exact 800x800 resize, alpha strip |
| Pixel comparison scoring | Custom diff algorithm | `compare()` from `pipeline/lib/compare.ts` | Already has ROI mask, threshold config, structured CompareResult |
| Dev server lifecycle | Custom Vite management | `startDevServer()`/`stopDevServer()` from `pipeline/lib/dev-server.ts` | Already handles auto-detect, auto-start, graceful shutdown |
| Parameter validation | Loose JSON handling | `validateParams()` from `demo/controls/presets.ts` | Already validates types, clamps ranges, handles missing keys |

**Key insight:** Phase 14 is primarily an orchestration layer. All capture, normalization, comparison, and parameter handling infrastructure already exists from Phases 12-13. The new code is the optimization loop and logging -- approximately 200-300 lines of new TypeScript.

## Common Pitfalls

### Pitfall 1: Stale WebGPU Renders Due to Insufficient Settle Time
**What goes wrong:** The tuning loop captures screenshots before the WebGPU engine has finished rendering the new parameter values, resulting in diff scores that don't reflect the actual parameters.
**Why it happens:** After `page.goto()`, React re-renders and the WASM engine needs to process new uniform values and draw a frame. With morphSpeed=0 (capture mode), the transition is instant, but the GPU pipeline still needs one or two frames.
**How to avoid:** Wait for the canvas to be visible, then use `waitForFunction` to verify canvas dimensions, then add a settle timeout of at least 1500ms. In capture mode, `morphSpeed=0` ensures no animation interpolation delay.
**Warning signs:** Diff scores oscillate wildly between iterations for the same parameter values. Same params produce different scores on consecutive evaluations.

### Pitfall 2: Coordinate Descent Gets Stuck in Local Minimum
**What goes wrong:** The algorithm converges quickly to a score that's still far from the global minimum, then stops improving.
**Why it happens:** Coordinate descent only explores axis-aligned directions. If two parameters interact (e.g., blur and blurRadius, or tint and contrast), the algorithm cannot descend along diagonal directions in parameter space.
**How to avoid:** This is a known limitation. Mitigation strategies: (1) Start from the Apple preset which is already near the target. (2) Run multiple passes from slightly different starting points if the first result is unsatisfactory. (3) Accept that coordinate descent finds a reasonable local minimum, not the global one. The requirement says "diff score decreases across iterations" -- not "reaches zero."
**Warning signs:** Score plateaus early with large remaining mismatch (>30%). All parameters show "none" direction in the log.

### Pitfall 3: Tint Parameter is 3-Component (Not Scalar)
**What goes wrong:** Attempting to tune tint as a single scalar fails because it's a `GlassColor` = `[number, number, number]`.
**Why it happens:** The coordinate descent loop assumes all parameters are single numbers. Tint is an RGB triple.
**How to avoid:** Either (a) treat each tint component as a separate tunable parameter (`tint_r`, `tint_g`, `tint_b`) and map them back to the tint array, or (b) exclude tint from the initial automated loop and tune it manually. Option (a) is recommended since it maintains the "one parameter at a time" approach -- the tint array just becomes 3 separate coordinate axes.
**Warning signs:** TypeScript compiler error when trying to assign `number` to `GlassColor`.

### Pitfall 4: Too Many Captures Per Run (Time Exhaustion)
**What goes wrong:** A tuning run takes over an hour because each cycle evaluates 14+ parameters x 2 directions = 28+ captures, each taking 3-5 seconds.
**Why it happens:** With 3s settle time per capture, 28 captures = ~84 seconds per cycle. With 10 cycles of coarse steps + 10 cycles of fine steps, that's ~28 minutes minimum.
**How to avoid:** (1) Reduce settle time to 1.5s for the persistent browser (GPU context is warm). (2) Limit max cycles to a reasonable number (10-15). (3) Only evaluate directions that are likely to help -- skip parameters that showed "none" improvement in the previous cycle. (4) Consider running only light mode tuning first (halves capture count).
**Warning signs:** Script has been running for 30+ minutes with no sign of convergence.

### Pitfall 5: iOS Reference Screenshot Drift
**What goes wrong:** The iOS reference screenshot changes between tuning runs because the Simulator state changed (different wallpaper, different appearance, app not launched).
**Why it happens:** The reference is captured by `captureIOS()` which depends on Simulator state.
**How to avoid:** Capture the iOS reference once at the start of the tuning run and save it. Verify the reference hasn't changed by comparing against a known-good reference hash. Better yet, use a pre-captured iOS reference that was validated in Phase 13, so the tuning loop doesn't need to interact with the iOS Simulator at all.
**Warning signs:** Baseline diff score changes between tuning runs even with identical web parameters.

## Code Examples

### Parameter-to-URL Serialization (Reuse from config.ts)
```typescript
// Reuse existing pattern from pipeline/lib/config.ts
import { PRESETS, type GlassParams } from '../../demo/controls/presets.js';

function paramsToQueryString(params: GlassParams): string {
  const qs = new URLSearchParams();
  qs.set('capture', 'true');  // Hide UI, morphSpeed=0
  for (const [key, value] of Object.entries(params)) {
    if (key === 'tint') {
      qs.set(key, JSON.stringify(value));
    } else {
      qs.set(key, String(value));
    }
  }
  return qs.toString();
}
```

### Iteration Log Entry Structure
```typescript
interface IterationEntry {
  cycle: number;
  paramIndex: number;
  param: string;
  direction: 'plus' | 'minus' | 'none';
  step: number;
  oldValue: number;
  newValue: number;
  oldScore: number;
  newScore: number;
  delta: number;         // newScore - oldScore (negative = improved)
  bestScore: number;     // Running best
  timestamp: string;     // ISO 8601
}

interface TuningResult {
  mode: 'light' | 'dark';
  startingPreset: string;
  initialScore: number;
  finalScore: number;
  improvement: number;  // initialScore - finalScore
  cycles: number;
  totalEvaluations: number;
  elapsed: string;       // HH:MM:SS
  bestParams: GlassParams;
  log: IterationEntry[];
}
```

### Convergence Summary Output
```typescript
// Final console output format
function printSummary(result: TuningResult): void {
  console.log(`\n=== Tuning Complete: ${result.mode} mode ===`);
  console.log(`  Preset: ${result.startingPreset}`);
  console.log(`  Initial score: ${result.initialScore.toFixed(2)}%`);
  console.log(`  Final score:   ${result.finalScore.toFixed(2)}%`);
  console.log(`  Improvement:   ${result.improvement.toFixed(2)}% (${((result.improvement / result.initialScore) * 100).toFixed(1)}% relative)`);
  console.log(`  Cycles:        ${result.cycles}`);
  console.log(`  Evaluations:   ${result.totalEvaluations}`);
  console.log(`  Elapsed:       ${result.elapsed}`);
  console.log(`  Best params:   pipeline/output/tuning/best-params-${result.mode}.json`);
  console.log(`  Full log:      pipeline/output/tuning/tune-log-${result.mode}.json`);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Grid search for shader params | Coordinate descent with adaptive step | Standard practice | Scales linearly (not exponentially) with parameter count |
| Manual visual tuning | Automated diff-driven tuning | Enabled by Phase 12+13 infrastructure | Removes human subjectivity from parameter selection |
| Full browser restart per evaluation | Persistent browser with page.goto() | Playwright best practice | 5-10x faster per evaluation |
| Fixed step sizes | Adaptive step halving | Standard optimization practice | Faster convergence near minima without overshooting |

**Deprecated/outdated:**
- Random search: Less sample-efficient than coordinate descent for smooth parameter spaces
- Gradient-based optimization: Not applicable here because the objective function (pixelmatch score) is not differentiable

## Open Questions

1. **Tint parameter handling**
   - What we know: Tint is `[r, g, b]` -- a 3-component color. All other tunable params are scalars.
   - What's unclear: Whether to treat it as 3 independent parameters (tint_r, tint_g, tint_b) or exclude it.
   - Recommendation: Include as 3 separate axes in the coordinate descent. This adds 3 capture-pairs per cycle but tint is one of the most impactful visual parameters. Map `tint_r`, `tint_g`, `tint_b` back to the tint array before building the URL.

2. **Single mode vs both modes**
   - What we know: The diff pipeline runs both light and dark. The presets are different for each.
   - What's unclear: Whether to tune light and dark independently (separate runs, separate best-params) or jointly (minimize sum of both scores).
   - Recommendation: Tune independently. Light and dark modes use different base presets (Apple Clear Light vs Apple Clear Dark) and the optimal parameters may differ. Run the tuner for one mode, save results, then run for the other mode. This also halves per-run time.

3. **Settle time calibration for persistent browser**
   - What we know: Phase 13 uses 3s settle time. With a persistent browser, the GPU context is warm.
   - What's unclear: The minimum reliable settle time for the persistent browser pattern.
   - Recommendation: Start with 2s, verify stability (same params produce consistent scores within 0.5%), then optionally reduce to 1.5s if stable. Add a `--settle` CLI flag to override.

4. **How to handle refractionMode (discrete parameter)**
   - What we know: `refractionMode` is `'standard' | 'prominent'` -- not a continuous parameter.
   - What's unclear: Whether coordinate descent should toggle it.
   - Recommendation: Exclude from the continuous loop. The Apple reference uses a specific variant. Lock it to the value from the starting preset and don't modify it. If both modes need testing, run the tuner twice with different locked values.

## Sources

### Primary (HIGH confidence)
- Existing project code: `pipeline/lib/config.ts` (presetToQueryString), `pipeline/lib/capture-web.ts` (Playwright capture), `pipeline/lib/compare.ts` (pixelmatch scoring), `pipeline/lib/normalize.ts` (sRGB normalization)
- Existing project code: `demo/App.tsx` (URL parameter parsing, capture mode), `demo/controls/presets.ts` (GlassParams interface, DEFAULTS, PRESETS)
- Existing project code: `demo/controls/ControlPanel.tsx` (slider min/max/step ranges for all 16 parameters)
- [Playwright Page API](https://playwright.dev/docs/api/class-page) - page.goto() for URL navigation without browser restart
- [Coordinate Descent - Advanced Statistical Computing](https://bookdown.org/rdpeng/advstatcomp/coordinate-descent.html) - algorithm properties, convergence conditions, implementation patterns

### Secondary (MEDIUM confidence)
- [Coordinate Descent - Wikipedia](https://en.wikipedia.org/wiki/Coordinate_descent) - algorithm pseudocode, step size strategies, convergence properties for non-convex functions
- [Zero-order Coordinate Search and Descent](https://kenndanielso.github.io/mlrefined/blog_posts/5_Zero_order_methods/5_5_Coordinate_search_and_descent.html) - gradient-free variant suitable for black-box objective functions
- [Playwright Performance - BrowserStack](https://www.browserstack.com/guide/playwright-goto) - page.goto() optimization, waitUntil options for faster navigation
- [Hyperparameter Optimization in Black-box Image Processing](https://www.cs.princeton.edu/~fheide/proxyopt) - automated parameter optimization for imaging pipelines

### Tertiary (LOW confidence)
- Exact settle time for persistent Playwright browser with warm GPU context -- needs empirical validation during implementation
- Whether pixelmatch score is smooth enough for coordinate descent to converge reliably -- likely yes for perceptual parameters, but sharp discontinuities around certain thresholds are possible

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Zero new dependencies; all libraries already installed and proven in Phase 13
- Architecture: HIGH - Direct reuse of existing pipeline modules; new code is orchestration (~200-300 LOC)
- Pitfalls: HIGH - Settle time, persistent browser, tint handling, and convergence issues are predictable from existing Phase 13 experience
- Optimization algorithm: MEDIUM - Coordinate descent is well-understood but convergence behavior depends on the smoothness of the pixelmatch objective function, which hasn't been empirically tested

**Research date:** 2026-02-26
**Valid until:** 2026-03-26 (30 days -- stable domain, no fast-moving dependencies)

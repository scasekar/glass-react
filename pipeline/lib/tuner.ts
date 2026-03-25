import type { GlassParams } from '../../demo/controls/presets.js';

/** Configuration for a single tunable parameter. */
export interface TuningParam {
  key: string; // GlassParams key or 'tint_r' | 'tint_g' | 'tint_b'
  min: number;
  max: number;
  step: number;
  minStep: number;
}

/** A named group of coupled parameters tuned together. */
export interface TuningPhase {
  name: string;
  params: TuningParam[];
  maxCycles: number;
}

/** Configuration for the tuning run. */
export interface TuningConfig {
  phases: TuningPhase[];
  convergenceThreshold: number; // Stop phase if improvement < this % per cycle
}

/** A single iteration log entry. */
export interface IterationEntry {
  phase: string;
  cycle: number;
  paramIndex: number;
  param: string;
  direction: 'plus' | 'minus' | 'none';
  step: number;
  oldValue: number;
  newValue: number;
  oldScore: number;
  newScore: number;
  delta: number;       // newScore - oldScore (negative = improved)
  bestScore: number;
  timestamp: string;   // ISO 8601
}

/** Final result of a tuning run. */
export interface TuningResult {
  mode: 'light' | 'dark';
  startingPreset: string;
  initialScore: number;
  finalScore: number;
  improvement: number;
  totalCycles: number;
  totalEvaluations: number;
  elapsed: string;     // HH:MM:SS
  bestParams: GlassParams;
  log: IterationEntry[];
  phaseResults: Array<{ name: string; startScore: number; endScore: number; cycles: number }>;
}

/**
 * Phased tuning groups ordered by visual impact.
 *
 * Phase 1 (Interior): Controls how the background looks through the glass.
 *   blur+contrast+saturation are tightly coupled — blur softens, contrast/saturation compensate.
 *   opacity+tint control the glass tint overlay. Largest pixel area = highest impact.
 *
 * Phase 2 (Edges): Controls the bright border glow that defines iOS glass identity.
 *   specular+rim+envReflection are coupled — all contribute edge brightness.
 *   fresnelExponent controls falloff sharpness. glareDirection sets light angle.
 *
 * Phase 3 (Distortion): Controls lens magnification and chromatic fringing at edges.
 *   Very subtle for iOS .clear — small adjustments only.
 */
export const TUNING_PHASES: TuningPhase[] = [
  {
    name: 'interior',
    params: [
      { key: 'blurRadius',  min: 0,   max: 25,  step: 3,    minStep: 0.5 },
      { key: 'contrast',    min: 0.5, max: 1.3, step: 0.08, minStep: 0.01 },
      { key: 'saturation',  min: 0.5, max: 2.5, step: 0.15, minStep: 0.02 },
      { key: 'opacity',     min: 0,   max: 0.4, step: 0.03, minStep: 0.005 },
      { key: 'tint_r',      min: 0,   max: 1,   step: 0.06, minStep: 0.01 },
      { key: 'tint_g',      min: 0,   max: 1,   step: 0.06, minStep: 0.01 },
      { key: 'tint_b',      min: 0,   max: 1,   step: 0.06, minStep: 0.01 },
    ],
    maxCycles: 10,
  },
  {
    name: 'edges',
    params: [
      { key: 'specular',              min: 0,   max: 0.8, step: 0.05, minStep: 0.005 },
      { key: 'rim',                   min: 0,   max: 0.6, step: 0.05, minStep: 0.005 },
      { key: 'envReflectionStrength', min: 0,   max: 0.5, step: 0.04, minStep: 0.005 },
      { key: 'fresnelExponent',       min: 0.5, max: 10,  step: 1.0,  minStep: 0.1 },
      { key: 'glareDirection',        min: 180, max: 420, step: 15,   minStep: 3 },
    ],
    maxCycles: 8,
  },
  {
    name: 'distortion',
    params: [
      // refraction is LOCKED — pixelmatch penalizes displacement, so tuner would zero it.
      // Set visually via manual comparison with iOS reference.
      // { key: 'refraction',  min: 0,   max: 1.0,  step: 0.1,  minStep: 0.02 },
      { key: 'aberration',  min: 0,   max: 8,    step: 0.8,  minStep: 0.1 },
      { key: 'fresnelIOR',  min: 1.0, max: 2.5,  step: 0.15, minStep: 0.03 },
    ],
    maxCycles: 5,
  },
];

/**
 * Get the numeric value of a parameter from GlassParams.
 * For tint_r/g/b, reads from the tint array components.
 */
function getParamValue(params: GlassParams, key: string): number {
  if (key === 'tint_r') return params.tint[0];
  if (key === 'tint_g') return params.tint[1];
  if (key === 'tint_b') return params.tint[2];
  return params[key as keyof GlassParams] as number;
}

/**
 * Return a new GlassParams with the specified parameter set to the given value.
 * For tint_r/g/b, creates a new tint array with the component updated.
 */
function setParamValue(params: GlassParams, key: string, value: number): GlassParams {
  if (key === 'tint_r') {
    return { ...params, tint: [value, params.tint[1], params.tint[2]] };
  }
  if (key === 'tint_g') {
    return { ...params, tint: [params.tint[0], value, params.tint[2]] };
  }
  if (key === 'tint_b') {
    return { ...params, tint: [params.tint[0], params.tint[1], value] };
  }
  return { ...params, [key]: value };
}

/** Format elapsed milliseconds as HH:MM:SS. */
function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':');
}

/**
 * Greedy line search: once a direction improves the score, keep stepping
 * in that direction until the score stops improving or we hit the bound.
 * Returns the best value found and its score.
 */
async function lineSearch(
  params: GlassParams,
  param: TuningParam,
  direction: 1 | -1,
  step: number,
  initialStepScore: number,
  score: (p: GlassParams) => Promise<number>,
  evalCounter: { count: number },
  maxSteps: number = 8,
): Promise<{ value: number; score: number; steps: number }> {
  const originalValue = getParamValue(params, param.key);

  // The caller already tested i=1 (the initial ±step) and found it improved.
  // Initialize best to that first step's result.
  const firstStepValue = direction === 1
    ? Math.min(originalValue + step, param.max)
    : Math.max(originalValue - step, param.min);
  let bestValue = firstStepValue;
  let bestScore = initialStepScore;
  let stepped = 1;

  // Continue in the same direction: i=2, 3, 4, ...
  for (let i = 2; i <= maxSteps; i++) {
    const nextValue = direction === 1
      ? Math.min(originalValue + step * i, param.max)
      : Math.max(originalValue - step * i, param.min);

    // Stop if we can't move further (hit bound)
    if (nextValue === bestValue) break;

    const nextParams = setParamValue(params, param.key, nextValue);
    const nextScore = await score(nextParams);
    evalCounter.count++;

    if (nextScore < bestScore) {
      bestValue = nextValue;
      bestScore = nextScore;
      stepped = i;
    } else {
      // Score got worse, stop searching in this direction
      break;
    }
  }

  return { value: bestValue, score: bestScore, steps: stepped };
}

/**
 * Phased group descent optimizer for glass shader parameters.
 *
 * Improves on flat coordinate descent by:
 * 1. Tuning coupled parameter groups in order of visual impact
 * 2. Using greedy line search (when a direction helps, keep going)
 * 3. Per-param adaptive step halving (only shrink the stuck param)
 *
 * @param initialParams Starting parameter values
 * @param config Tuning phases and convergence threshold
 * @param mode Light or dark mode
 * @param presetName Name of the starting preset
 * @param score Scoring function: lower = better match to iOS reference
 * @param onIteration Optional callback for real-time logging
 * @returns TuningResult with best params, log, and metrics
 */
export async function phasedDescent(
  initialParams: GlassParams,
  config: TuningConfig,
  mode: 'light' | 'dark',
  presetName: string,
  score: (params: GlassParams) => Promise<number>,
  onIteration?: (entry: IterationEntry) => void,
): Promise<TuningResult> {
  const startTime = Date.now();
  const log: IterationEntry[] = [];
  const evalCounter = { count: 0 };
  const phaseResults: TuningResult['phaseResults'] = [];
  let totalCycles = 0;

  // Score initial params to get baseline
  let bestScore = await score(initialParams);
  evalCounter.count++;
  const initialScore = bestScore;
  let bestParams = { ...initialParams, tint: [...initialParams.tint] as [number, number, number] };

  for (const phase of config.phases) {
    const phaseStartScore = bestScore;
    console.log(`\n  --- Phase: ${phase.name} (${phase.params.map(p => p.key).join(', ')}) ---`);
    console.log(`    Starting score: ${bestScore.toFixed(2)}%`);

    // Per-param mutable step sizes for adaptive halving
    const steps: Record<string, number> = {};
    const frozen: Record<string, boolean> = {};
    for (const p of phase.params) {
      steps[p.key] = p.step;
      frozen[p.key] = false;
    }

    for (let cycle = 0; cycle < phase.maxCycles; cycle++) {
      const cycleStartScore = bestScore;
      let anyImproved = false;

      for (let pi = 0; pi < phase.params.length; pi++) {
        const param = phase.params[pi];
        if (frozen[param.key]) continue;

        const currentValue = getParamValue(bestParams, param.key);
        const currentStep = steps[param.key];
        const scoreBeforeParam = bestScore;

        // Try ±1 step to find the better direction
        const plusValue = Math.min(currentValue + currentStep, param.max);
        const minusValue = Math.max(currentValue - currentStep, param.min);

        const plusParams = setParamValue(bestParams, param.key, plusValue);
        const plusScore = await score(plusParams);
        evalCounter.count++;

        const minusParams = setParamValue(bestParams, param.key, minusValue);
        const minusScore = await score(minusParams);
        evalCounter.count++;

        let direction: 'plus' | 'minus' | 'none' = 'none';
        let newValue = currentValue;
        let newScore = scoreBeforeParam;

        if (plusScore < bestScore && plusScore <= minusScore) {
          // Plus direction wins — line search further
          const ls = await lineSearch(
            bestParams, param, 1, currentStep, plusScore, score, evalCounter,
          );
          direction = 'plus';
          newValue = ls.value;
          newScore = ls.score;
          bestScore = ls.score;
          bestParams = setParamValue(bestParams, param.key, ls.value);
          anyImproved = true;
        } else if (minusScore < bestScore) {
          // Minus direction wins — line search further
          const ls = await lineSearch(
            bestParams, param, -1, currentStep, minusScore, score, evalCounter,
          );
          direction = 'minus';
          newValue = ls.value;
          newScore = ls.score;
          bestScore = ls.score;
          bestParams = setParamValue(bestParams, param.key, ls.value);
          anyImproved = true;
        } else {
          // Neither direction improved — halve this param's step
          steps[param.key] /= 2;
          if (steps[param.key] < param.minStep) {
            frozen[param.key] = true;
          }
        }

        const entry: IterationEntry = {
          phase: phase.name,
          cycle,
          paramIndex: pi,
          param: param.key,
          direction,
          step: currentStep,
          oldValue: currentValue,
          newValue,
          oldScore: scoreBeforeParam,
          newScore,
          delta: newScore - scoreBeforeParam,
          bestScore,
          timestamp: new Date().toISOString(),
        };

        log.push(entry);
        onIteration?.(entry);
      }

      totalCycles++;

      // Check if all params in this phase are frozen
      const allFrozen = phase.params.every(p => frozen[p.key]);
      if (allFrozen) {
        console.log(`    All params frozen after cycle ${cycle + 1}`);
        break;
      }

      // Check convergence within this phase
      if (!anyImproved || Math.abs(cycleStartScore - bestScore) < config.convergenceThreshold) {
        console.log(`    Converged after cycle ${cycle + 1} (Δ=${(cycleStartScore - bestScore).toFixed(3)}%)`);
        break;
      }
    }

    phaseResults.push({
      name: phase.name,
      startScore: phaseStartScore,
      endScore: bestScore,
      cycles: totalCycles,
    });

    console.log(`    Phase ${phase.name} done: ${phaseStartScore.toFixed(2)}% → ${bestScore.toFixed(2)}%`);
  }

  const elapsed = formatElapsed(Date.now() - startTime);

  return {
    mode,
    startingPreset: presetName,
    initialScore,
    finalScore: bestScore,
    improvement: initialScore - bestScore,
    totalCycles,
    totalEvaluations: evalCounter.count,
    elapsed,
    bestParams,
    log,
    phaseResults,
  };
}

// --- Legacy exports for backward compatibility ---

/** @deprecated Use TUNING_PHASES instead */
export const TUNABLE_PARAMS: TuningParam[] = TUNING_PHASES.flatMap(p => p.params);

/** @deprecated Use phasedDescent instead */
export async function coordinateDescent(
  initialParams: GlassParams,
  _config: { params: TuningParam[]; maxCycles: number; convergenceThreshold: number },
  mode: 'light' | 'dark',
  presetName: string,
  score: (params: GlassParams) => Promise<number>,
  onIteration?: (entry: IterationEntry) => void,
): Promise<TuningResult> {
  return phasedDescent(
    initialParams,
    { phases: TUNING_PHASES, convergenceThreshold: _config.convergenceThreshold },
    mode, presetName, score, onIteration,
  );
}

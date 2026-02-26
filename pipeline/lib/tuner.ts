import type { GlassParams } from '../../demo/controls/presets.js';

/** Configuration for a single tunable parameter. */
export interface TuningParam {
  key: string; // GlassParams key or 'tint_r' | 'tint_g' | 'tint_b'
  min: number;
  max: number;
  step: number;
  minStep: number;
}

/** Configuration for the tuning run. */
export interface TuningConfig {
  params: TuningParam[];
  maxCycles: number;            // Default 15
  convergenceThreshold: number; // Default 0.05 (stop if improvement < 0.05% per cycle)
}

/** A single iteration log entry. */
export interface IterationEntry {
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
  cycles: number;
  totalEvaluations: number;
  elapsed: string;     // HH:MM:SS
  bestParams: GlassParams;
  log: IterationEntry[];
}

/**
 * Tunable parameters derived from ControlPanel.tsx slider ranges.
 * Excludes cornerRadius (geometry), morphSpeed (animation), refractionMode (enum).
 * Includes tint as 3 separate axes (tint_r, tint_g, tint_b).
 */
export const TUNABLE_PARAMS: TuningParam[] = [
  { key: 'blur',                  min: 0,    max: 1,    step: 0.05,  minStep: 0.005 },
  { key: 'opacity',               min: 0,    max: 1,    step: 0.05,  minStep: 0.005 },
  { key: 'blurRadius',            min: 0,    max: 50,   step: 5,     minStep: 0.5   },
  { key: 'refraction',            min: 0,    max: 0.3,  step: 0.03,  minStep: 0.003 },
  { key: 'aberration',            min: 0,    max: 10,   step: 1.0,   minStep: 0.1   },
  { key: 'specular',              min: 0,    max: 1,    step: 0.05,  minStep: 0.005 },
  { key: 'rim',                   min: 0,    max: 1,    step: 0.05,  minStep: 0.005 },
  { key: 'fresnelIOR',            min: 1.0,  max: 3.0,  step: 0.2,   minStep: 0.02  },
  { key: 'fresnelExponent',       min: 0.5,  max: 10,   step: 1.0,   minStep: 0.1   },
  { key: 'envReflectionStrength', min: 0,    max: 1,    step: 0.05,  minStep: 0.005 },
  { key: 'glareDirection',        min: 0,    max: 360,  step: 15,    minStep: 1     },
  { key: 'contrast',              min: 0,    max: 2,    step: 0.1,   minStep: 0.01  },
  { key: 'saturation',            min: 0,    max: 3,    step: 0.15,  minStep: 0.01  },
  { key: 'tint_r',                min: 0,    max: 1,    step: 0.05,  minStep: 0.005 },
  { key: 'tint_g',                min: 0,    max: 1,    step: 0.05,  minStep: 0.005 },
  { key: 'tint_b',                min: 0,    max: 1,    step: 0.05,  minStep: 0.005 },
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

/**
 * Format elapsed milliseconds as HH:MM:SS.
 */
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
 * Cyclic coordinate descent optimizer for glass shader parameters.
 *
 * Iterates through each tunable parameter, tries +/- step perturbations,
 * accepts the direction that reduces the diff score. Halves step sizes
 * when a full cycle produces no improvement. Stops when all steps fall
 * below minimum thresholds or convergence is reached.
 *
 * @param initialParams Starting parameter values
 * @param config Tuning configuration (params, maxCycles, convergenceThreshold)
 * @param mode Light or dark mode
 * @param presetName Name of the starting preset
 * @param score Scoring function: lower = better match to iOS reference
 * @param onIteration Optional callback for real-time logging
 * @returns TuningResult with best params, log, and metrics
 */
export async function coordinateDescent(
  initialParams: GlassParams,
  config: TuningConfig,
  mode: 'light' | 'dark',
  presetName: string,
  score: (params: GlassParams) => Promise<number>,
  onIteration?: (entry: IterationEntry) => void,
): Promise<TuningResult> {
  const startTime = Date.now();
  const log: IterationEntry[] = [];
  let totalEvaluations = 0;

  // Score initial params to get baseline
  let bestScore = await score(initialParams);
  totalEvaluations++;
  const initialScore = bestScore;
  let bestParams = { ...initialParams, tint: [...initialParams.tint] as [number, number, number] };

  // Copy step sizes into mutable record for adaptive halving
  const steps: Record<string, number> = {};
  for (const p of config.params) {
    steps[p.key] = p.step;
  }

  let cycles = 0;

  for (let cycle = 0; cycle < config.maxCycles; cycle++) {
    const cycleStartScore = bestScore;
    let anyImproved = false;

    for (let pi = 0; pi < config.params.length; pi++) {
      const param = config.params[pi];
      const currentValue = getParamValue(bestParams, param.key);
      const currentStep = steps[param.key];

      // Record the score before this parameter's perturbation
      const scoreBeforeParam = bestScore;

      // Compute +step (clamped to max)
      const plusValue = Math.min(currentValue + currentStep, param.max);
      const plusParams = setParamValue(bestParams, param.key, plusValue);

      // Compute -step (clamped to min)
      const minusValue = Math.max(currentValue - currentStep, param.min);
      const minusParams = setParamValue(bestParams, param.key, minusValue);

      // Score both perturbations
      const plusScore = await score(plusParams);
      totalEvaluations++;
      const minusScore = await score(minusParams);
      totalEvaluations++;

      let direction: 'plus' | 'minus' | 'none' = 'none';
      let newValue = currentValue;
      let newScore = scoreBeforeParam;

      if (plusScore < bestScore && plusScore <= minusScore) {
        // Plus direction improves and is at least as good as minus
        direction = 'plus';
        newValue = plusValue;
        newScore = plusScore;
        bestScore = plusScore;
        bestParams = plusParams;
        anyImproved = true;
      } else if (minusScore < bestScore) {
        // Minus direction improves
        direction = 'minus';
        newValue = minusValue;
        newScore = minusScore;
        bestScore = minusScore;
        bestParams = minusParams;
        anyImproved = true;
      }

      const entry: IterationEntry = {
        cycle,
        paramIndex: pi,
        param: param.key,
        direction,
        step: currentStep,
        oldValue: currentValue,
        newValue,
        oldScore: scoreBeforeParam,
        newScore,
        delta: newScore - scoreBeforeParam, // negative = improved
        bestScore,
        timestamp: new Date().toISOString(),
      };

      log.push(entry);
      if (onIteration) {
        onIteration(entry);
      }
    }

    cycles = cycle + 1;

    if (!anyImproved) {
      // Halve all step sizes
      let allBelowMin = true;
      for (const param of config.params) {
        steps[param.key] /= 2;
        if (steps[param.key] >= param.minStep) {
          allBelowMin = false;
        }
      }
      // If all steps below minimum thresholds, stop
      if (allBelowMin) {
        break;
      }
    }

    // Check convergence: if improvement in this cycle is below threshold
    if (Math.abs(cycleStartScore - bestScore) < config.convergenceThreshold) {
      break;
    }
  }

  const elapsed = formatElapsed(Date.now() - startTime);

  return {
    mode,
    startingPreset: presetName,
    initialScore,
    finalScore: bestScore,
    improvement: initialScore - bestScore,
    cycles,
    totalEvaluations,
    elapsed,
    bestParams,
    log,
  };
}

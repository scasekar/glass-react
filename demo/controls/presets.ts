import type { GlassColor } from '../../src/components/types';

/**
 * All 16 tunable glass parameters with concrete (required) values.
 * Mirrors GlassStyleProps fields but nothing is optional -- the tuning
 * panel always holds a complete configuration.
 */
export interface GlassParams {
  blur: number;
  opacity: number;
  cornerRadius: number;
  refraction: number;
  aberration: number;
  specular: number;
  rim: number;
  tint: GlassColor;
  refractionMode: 'standard' | 'prominent';
  morphSpeed: number;
  contrast: number;
  saturation: number;
  blurRadius: number;
  fresnelIOR: number;
  fresnelExponent: number;
  envReflectionStrength: number;
  glareDirection: number;
}

/** Default parameter values (tuned to match iOS Clear Light glass). */
export const DEFAULTS: GlassParams = {
  blur: 0.3,
  opacity: 0.17,
  cornerRadius: 24,
  refraction: 0.0,
  aberration: 0.7,
  specular: 0.05,
  rim: 0.40,
  tint: [0.92, 0.93, 0.98],
  refractionMode: 'standard',
  morphSpeed: 8,
  contrast: 1.28,
  saturation: 0.9,
  blurRadius: 3.5,
  fresnelIOR: 1.5,
  fresnelExponent: 0.5,
  envReflectionStrength: 0.02,
  glareDirection: 285,
};

/** Named presets mapping to complete parameter configurations. */
export const PRESETS: Record<string, GlassParams> = {
  'Apple Clear Light': {
    ...DEFAULTS,
    blur: 0.3,
    opacity: 0.17,
    blurRadius: 3.5,
    tint: [0.92, 0.93, 0.98],
    contrast: 1.28,
    saturation: 0.9,
    specular: 0.05,
    rim: 0.40,
    refraction: 0.0,
    aberration: 0.7,
    envReflectionStrength: 0.02,
    fresnelExponent: 0.5,
    fresnelIOR: 1.5,
    glareDirection: 285,
  },
  'Apple Clear Dark': {
    ...DEFAULTS,
    blur: 0.08,
    opacity: 0.10,
    blurRadius: 6,
    tint: [0.15, 0.15, 0.20],
    contrast: 0.90,
    saturation: 1.0,
    specular: 0.07,
    rim: 0.01,
    refraction: 0.0,
    aberration: 0.0,
    envReflectionStrength: 0.10,
    fresnelExponent: 2.0,
    fresnelIOR: 1.5,
    glareDirection: 300,
  },
};

/** Parameter grouping by UI section. */
export const SECTION_KEYS: Record<string, (keyof GlassParams)[]> = {
  'Blur & Opacity': ['blur', 'opacity', 'blurRadius'],
  'Geometry': ['cornerRadius'],
  'Refraction': ['refraction', 'refractionMode', 'aberration'],
  'Lighting': ['specular', 'rim', 'fresnelIOR', 'fresnelExponent', 'envReflectionStrength', 'glareDirection'],
  'Color Adjustment': ['tint', 'contrast', 'saturation'],
  'Animation': ['morphSpeed'],
};

/**
 * Validate and merge parsed JSON data with DEFAULTS.
 * Unknown keys are ignored; missing keys get default values.
 */
export function validateParams(data: unknown): GlassParams {
  if (typeof data !== 'object' || data === null) {
    return { ...DEFAULTS };
  }
  const obj = data as Record<string, unknown>;
  const result = { ...DEFAULTS };

  for (const key of Object.keys(DEFAULTS) as (keyof GlassParams)[]) {
    if (!(key in obj)) continue;

    if (key === 'tint') {
      const val = obj[key];
      if (
        Array.isArray(val) &&
        val.length === 3 &&
        val.every((v) => typeof v === 'number' && !isNaN(v))
      ) {
        result.tint = [val[0], val[1], val[2]];
      }
    } else if (key === 'refractionMode') {
      const val = obj[key];
      if (val === 'standard' || val === 'prominent') {
        result.refractionMode = val;
      }
    } else {
      const val = obj[key];
      if (typeof val === 'number' && !isNaN(val)) {
        // Type-safe assignment for numeric keys
        (result as Record<string, unknown>)[key] = val;
      }
    }
  }

  return result;
}

/**
 * Export current parameters as a flat JSON file download.
 * Uses Blob + anchor download pattern.
 */
export function exportParams(params: GlassParams): void {
  const json = JSON.stringify(params, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'glass-params.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Open a file picker and import JSON parameters.
 * Validates data and merges with defaults for missing keys.
 */
export function importParams(
  onLoad: (params: GlassParams) => void,
  onError: (msg: string) => void,
): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        const params = validateParams(data);
        onLoad(params);
      } catch {
        onError('Invalid JSON file. Could not parse parameters.');
      }
    };
    reader.onerror = () => {
      onError('Failed to read file.');
    };
    reader.readAsText(file);
    input.value = '';
  });

  input.click();
}

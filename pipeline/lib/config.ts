import { PRESETS } from '../../demo/controls/presets.js';

export interface ROIMask {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PipelineConfig {
  /** Standardized capture dimensions (both web and iOS normalized to this) */
  size: number;
  /** Playwright viewport for web capture */
  viewport: { width: number; height: number };
  /** Dev server URL */
  devServerUrl: string;
  /** Dev server port */
  devServerPort: number;
  /** Presets to capture (maps mode to preset name) */
  presets: Record<'light' | 'dark', string>;
  /** URL parameters for each preset (built from PRESETS in presets.ts) */
  presetUrls: Record<'light' | 'dark', string>;
  /** Region-of-interest mask for glass panel area (in 800x800 normalized coords) */
  roiMask: ROIMask;
  /** iOS Simulator crop region (in native 1206x2622 coordinates) */
  iosCropRegion: { left: number; top: number; width: number; height: number };
  /** iOS device name for xcrun simctl */
  iosDevice: string;
  /** Output directories (relative to pipeline/) */
  outputDir: string;
  /** pixelmatch threshold (0-1, lower = stricter) */
  diffThreshold: number;
}

/**
 * Serialize a GlassParams preset into URL query string parameters.
 * Includes capture=true for the capture mode flag.
 */
function presetToQueryString(presetName: string): string {
  const preset = PRESETS[presetName];
  if (!preset) throw new Error(`Unknown preset: ${presetName}`);

  const params = new URLSearchParams();
  params.set('capture', 'true');

  for (const [key, value] of Object.entries(preset)) {
    if (key === 'tint') {
      params.set(key, JSON.stringify(value));
    } else {
      params.set(key, String(value));
    }
  }

  return params.toString();
}

export const CONFIG: PipelineConfig = {
  size: 800,
  viewport: { width: 800, height: 800 },
  devServerUrl: 'http://localhost:5173',
  devServerPort: 5173,

  presets: {
    light: 'Apple Clear Light',
    dark: 'Apple Clear Dark',
  },

  presetUrls: {
    light: presetToQueryString('Apple Clear Light'),
    dark: presetToQueryString('Apple Clear Dark'),
  },

  // ROI mask covering the main glass panel area (centered in 800x800 viewport).
  // NOTE: These coordinates should be adjusted after first pipeline run.
  roiMask: { x: 150, y: 100, width: 500, height: 500 },

  // iOS Simulator crop region (in native 1206x2622 coordinates).
  // NOTE: Calibration needed after first iOS capture.
  iosCropRegion: { left: 203, top: 600, width: 800, height: 800 },

  iosDevice: 'iPhone 17 Pro',
  outputDir: 'output',
  diffThreshold: 0.1,
};

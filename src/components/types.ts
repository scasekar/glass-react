/** OS-level accessibility and theme preferences detected via matchMedia */
export interface AccessibilityPreferences {
  /** true when OS has prefers-reduced-motion: reduce */
  reducedMotion: boolean;
  /** true when OS has prefers-reduced-transparency: reduce (progressive enhancement, ~72% browser support) */
  reducedTransparency: boolean;
  /** true when OS has prefers-color-scheme: dark */
  darkMode: boolean;
}

/** RGB color as a tuple of three numbers in [0, 1] range */
export type GlassColor = [r: number, g: number, b: number];

/** Style props shared by all glass components */
export interface GlassStyleProps {
  /** Blur intensity (0 = sharp refraction, 1 = maximum frosted glass). Default: 0.5 */
  blur?: number;
  /** Opacity of the tint overlay (0 = fully transparent, 1 = fully tinted). Default: 0.05 */
  opacity?: number;
  /** Corner radius in CSS pixels. Default: 24 */
  cornerRadius?: number;
  /** Tint color as [R, G, B] in [0,1] range. Default: [1, 1, 1] (white) */
  tint?: GlassColor;
  /** Refraction strength at glass edges (0 = no lens effect, 0.3 = strong lens). Default: 0.15 */
  refraction?: number;
  /** Chromatic aberration intensity in pixels (0 = none, 10 = extreme). Default: 3 */
  aberration?: number;
  /** Specular highlight intensity (0 = none, 1 = bright). Default: 0.2 */
  specular?: number;
  /** Rim lighting intensity (0 = none, 1 = strong glow). Default: 0.15 */
  rim?: number;
  /** Refraction mode: 'standard' for subtle glass, 'prominent' for enhanced glass with stronger effects. Default: 'standard' */
  refractionMode?: 'standard' | 'prominent';
  /** Morph transition speed (0 = instant snap, 8 = smooth ~0.4s). Default: 8 */
  morphSpeed?: number;
}

/** Props for GlassPanel (<div> wrapper) */
export interface GlassPanelProps extends GlassStyleProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  ref?: React.Ref<HTMLDivElement>;
}

/** Props for GlassButton (<button> wrapper) */
export interface GlassButtonProps extends GlassStyleProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  ref?: React.Ref<HTMLButtonElement>;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

/** Props for GlassCard (<article> wrapper) */
export interface GlassCardProps extends GlassStyleProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  ref?: React.Ref<HTMLElement>;
}

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
  /**
   * Contrast adjustment applied to the background behind the glass (0--2).
   * Matches CSS backdrop-filter: contrast(). 1.0 = no change, <1 = reduce, >1 = increase.
   * Default: 0.85 (Apple Liquid Glass standard).
   */
  contrast?: number;
  /**
   * Saturation boost applied to the background behind the glass (0--3).
   * Matches CSS backdrop-filter: saturate(). 1.0 = no change, >1 = boost.
   * Default: 1.4 (Apple Liquid Glass standard).
   */
  saturation?: number;
  /**
   * Blur radius in CSS pixels applied to the background (0--50).
   * When set, overrides the normalized `blur` prop. Higher = more frosted.
   * Default: 15. If unset, computed from `blur` prop as `blur * 30`.
   */
  blurRadius?: number;
  /**
   * Fresnel index of refraction for edge reflection (1.0--3.0).
   * 1.5 = physical glass. Higher values create more edge reflectivity.
   * Default: 1.5.
   */
  fresnelIOR?: number;
  /**
   * Fresnel exponent controlling edge fall-off curve (0.5--10).
   * Higher = sharper, more concentrated edge reflection.
   * Default: 5.0.
   */
  fresnelExponent?: number;
  /**
   * Environment reflection strength -- intensity of ambient glass reflections (0--1).
   * Default: 0.12 (subtle, matching Apple's light-touch approach).
   */
  envReflectionStrength?: number;
  /**
   * Glare direction angle in degrees (any number, wraps naturally).
   * 0 = right, 90 = down, 180 = left, 270 = up.
   * Default: 315 (upper-left, Apple standard).
   */
  glareDirection?: number;
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

/** Props for GlassChip (selectable pill toggle) */
export interface GlassChipProps {
  /** Text label displayed inside the chip */
  label: string;
  /** Whether the chip is currently selected */
  selected: boolean;
  /** Callback fired with new selected state when chip is toggled */
  onToggle: (selected: boolean) => void;
  /** Whether the chip is disabled */
  disabled?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

/** Props for GlassStepper (numeric +/- control) */
export interface GlassStepperProps {
  /** Current numeric value */
  value: number;
  /** Callback fired with new value on increment/decrement */
  onChange: (value: number) => void;
  /** Minimum allowed value. Default: 0 */
  min?: number;
  /** Maximum allowed value. Default: 10 */
  max?: number;
  /** Increment/decrement step size. Default: 1 */
  step?: number;
  /** Accessible label for the stepper group */
  label?: string;
  /** Whether the stepper is disabled */
  disabled?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

/** Props for GlassInput (glass-bordered text field) */
export interface GlassInputProps {
  /** Label text rendered above the input */
  label?: string;
  /** Controlled input value */
  value: string;
  /** Called with the new value when the user types */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** HTML input type (text, email, password, etc.) */
  type?: string;
  /** HTML id for the input element */
  id?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional CSS class name for the outer wrapper */
  className?: string;
  /** Additional inline styles for the outer wrapper */
  style?: React.CSSProperties;
}

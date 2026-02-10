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

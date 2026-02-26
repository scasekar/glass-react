import { useRef } from 'react';
import { useGlassRegion } from '../hooks/useGlassRegion';
import { useGlassEngine } from '../hooks/useGlassEngine';
import { useMergedRef } from '../hooks/useMergedRef';
import type { GlassPanelProps } from './types';

/**
 * A glass-effect panel component that renders as a `<div>`.
 * Place inside a `<GlassProvider>` to see the glass refraction effect.
 *
 * @example
 * ```tsx
 * <GlassPanel blur={0.6} cornerRadius={28} style={{ width: 320, padding: 32 }}>
 *   <h2>Glass Panel</h2>
 * </GlassPanel>
 * ```
 */
export function GlassPanel({
  children,
  className,
  style,
  ref,
  blur,
  opacity,
  cornerRadius,
  tint,
  refraction,
  aberration,
  specular,
  rim,
  refractionMode,
  morphSpeed,
  contrast,
  saturation,
  blurRadius,
  fresnelIOR,
  fresnelExponent,
  envReflectionStrength,
  glareDirection,
  ...rest
}: GlassPanelProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRef(internalRef, ref);
  const { preferences } = useGlassEngine();

  useGlassRegion(internalRef, {
    blur, opacity, cornerRadius, tint, refraction,
    aberration, specular, rim, refractionMode, morphSpeed,
    contrast, saturation, blurRadius, fresnelIOR, fresnelExponent, envReflectionStrength, glareDirection,
  });

  const textStyles: React.CSSProperties = (preferences?.darkMode ?? true)
    ? {
        color: 'rgba(255, 255, 255, 0.95)',
        textShadow: '0 1px 3px rgba(0, 0, 0, 0.6), 0 0 8px rgba(0, 0, 0, 0.3)',
      }
    : {
        color: 'rgba(0, 0, 0, 0.87)',
        textShadow: '0 1px 2px rgba(255, 255, 255, 0.8), 0 0 6px rgba(255, 255, 255, 0.4)',
      };

  return (
    <div
      ref={mergedRef}
      className={className}
      style={{
        position: 'relative',
        background: 'transparent',
        borderRadius: `${cornerRadius ?? 24}px`,
        ...textStyles,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

import { useRef, useState } from 'react';
import { useGlassRegion } from '../hooks/useGlassRegion';
import { useGlassEngine } from '../hooks/useGlassEngine';
import { useMergedRef } from '../hooks/useMergedRef';
import type { GlassButtonProps } from './types';

/**
 * A glass-effect button component with smooth hover/active morph transitions.
 * Place inside a `<GlassProvider>` to see the glass refraction effect.
 *
 * @example
 * ```tsx
 * <GlassButton blur={0.5} cornerRadius={16} onClick={() => console.log('clicked')}>
 *   Click Me
 * </GlassButton>
 * ```
 */
export function GlassButton({
  children,
  className,
  style,
  ref,
  blur,
  opacity,
  cornerRadius = 16,
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
  onClick,
  disabled,
  type = 'button',
  ...rest
}: GlassButtonProps) {
  const internalRef = useRef<HTMLButtonElement>(null);
  const mergedRef = useMergedRef(internalRef, ref);
  const { preferences } = useGlassEngine();

  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  // Hover: slightly enhance glass effects for visual feedback
  // Active/pressed: reduce blur for a "closer to surface" feel
  const effectiveBlur = pressed ? (blur ?? 0.5) * 0.3
                      : hovered ? (blur ?? 0.5) * 0.8
                      : blur;
  const effectiveSpecular = hovered ? (specular ?? 0.2) * 1.8
                          : specular;
  const effectiveRim = hovered ? (rim ?? 0.15) * 2.0
                     : rim;
  const effectiveAberration = hovered ? (aberration ?? 3) * 1.5
                            : aberration;

  useGlassRegion(internalRef, {
    blur: effectiveBlur,
    opacity,
    cornerRadius,
    tint,
    refraction,
    aberration: effectiveAberration,
    specular: effectiveSpecular,
    rim: effectiveRim,
    refractionMode,
    morphSpeed,
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
    <button
      ref={mergedRef}
      className={className}
      style={{
        position: 'relative',
        background: 'transparent',
        border: 'none',
        borderRadius: `${cornerRadius}px`,
        cursor: disabled ? 'default' : 'pointer',
        ...textStyles,
        ...style,
      }}
      onMouseEnter={() => { if (!disabled) setHovered(true); }}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => { if (!disabled) setPressed(true); }}
      onMouseUp={() => setPressed(false)}
      onClick={onClick}
      disabled={disabled}
      type={type}
      {...rest}
    >
      {children}
    </button>
  );
}

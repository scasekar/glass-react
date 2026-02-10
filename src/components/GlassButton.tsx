import { useRef } from 'react';
import { useGlassRegion } from '../hooks/useGlassRegion';
import { useGlassEngine } from '../hooks/useGlassEngine';
import { useMergedRef } from '../hooks/useMergedRef';
import type { GlassButtonProps } from './types';

/**
 * A glass-effect button component.
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
  onClick,
  disabled,
  type = 'button',
  ...rest
}: GlassButtonProps) {
  const internalRef = useRef<HTMLButtonElement>(null);
  const mergedRef = useMergedRef(internalRef, ref);
  const { preferences } = useGlassEngine();

  useGlassRegion(internalRef, { blur, opacity, cornerRadius, tint, refraction });

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
      onClick={onClick}
      disabled={disabled}
      type={type}
      {...rest}
    >
      {children}
    </button>
  );
}

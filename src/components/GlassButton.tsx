import { useRef } from 'react';
import { useGlassRegion } from '../hooks/useGlassRegion';
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

  useGlassRegion(internalRef, { blur, opacity, cornerRadius, tint, refraction });

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

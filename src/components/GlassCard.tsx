import { useRef } from 'react';
import { useGlassRegion } from '../hooks/useGlassRegion';
import { useMergedRef } from '../hooks/useMergedRef';
import type { GlassCardProps } from './types';

/**
 * A glass-effect card component that renders as an `<article>`.
 * Place inside a `<GlassProvider>` to see the glass refraction effect.
 *
 * @example
 * ```tsx
 * <GlassCard blur={0.7} cornerRadius={20} tint={[0.8, 0.85, 1.0]}>
 *   <h3>Glass Card</h3>
 *   <p>Content here</p>
 * </GlassCard>
 * ```
 */
export function GlassCard({
  children,
  className,
  style,
  ref,
  blur,
  opacity,
  cornerRadius,
  tint,
  refraction,
  ...rest
}: GlassCardProps) {
  const internalRef = useRef<HTMLElement>(null);
  const mergedRef = useMergedRef(internalRef, ref);

  useGlassRegion(internalRef, { blur, opacity, cornerRadius, tint, refraction });

  return (
    <article
      ref={mergedRef}
      className={className}
      style={{
        position: 'relative',
        background: 'transparent',
        borderRadius: `${cornerRadius ?? 24}px`,
        ...style,
      }}
      {...rest}
    >
      {children}
    </article>
  );
}

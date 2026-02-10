import { useRef } from 'react';
import { useGlassRegion } from '../hooks/useGlassRegion';
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
  ...rest
}: GlassPanelProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRef(internalRef, ref);

  useGlassRegion(internalRef, { blur, opacity, cornerRadius, tint, refraction });

  return (
    <div
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
    </div>
  );
}

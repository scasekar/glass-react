import { useEffect, useRef } from 'react';
import { useGlassEngine } from './useGlassEngine';
import type { GlassRegionHandle } from '../context/GlassContext';
import type { GlassStyleProps } from '../components/types';

export function useGlassRegion(
  elementRef: React.RefObject<HTMLElement | null>,
  props: GlassStyleProps
) {
  const ctx = useGlassEngine();
  const handleRef = useRef<GlassRegionHandle | null>(null);

  // Register region when engine is ready and element exists
  useEffect(() => {
    if (!ctx.ready || !elementRef.current) return;
    const handle = ctx.registerRegion(elementRef.current);
    handleRef.current = handle;
    return () => {
      if (handle) {
        handle.remove();
        ctx.unregisterRegion(handle.id);
      }
      handleRef.current = null;
    };
  }, [ctx.ready, ctx, elementRef]);

  // Sync props to engine whenever they change
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    handle.updateParams(
      props.cornerRadius ?? 24,
      props.blur ?? 0.5,
      props.opacity ?? 0.05,
      props.refraction ?? 0.15
    );
    if (props.tint) {
      handle.updateTint(props.tint[0], props.tint[1], props.tint[2]);
    } else {
      handle.updateTint(1, 1, 1); // default white
    }
  }, [props.cornerRadius, props.blur, props.opacity, props.refraction, props.tint]);
}

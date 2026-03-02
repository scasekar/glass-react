import { useEffect, useRef } from 'react';
import { useGlassEngine } from './useGlassEngine';
import type { GlassRegionHandle } from '../context/GlassContext';
import type { GlassStyleProps, GlassColor } from '../components/types';

/** Default tint and opacity for dark mode (cool blue-white, subtle) */
const DARK_DEFAULTS = {
  tint: [0.7, 0.75, 0.85] as GlassColor,
  opacity: 0.08,
};

/** Default tint and opacity for light mode (dark charcoal, more visible) */
const LIGHT_DEFAULTS = {
  tint: [0.15, 0.15, 0.2] as GlassColor,
  opacity: 0.25,
};

/** Near-opaque fallback for reduced-transparency in dark mode */
const REDUCED_TRANSPARENCY_DARK = {
  tint: [0.2, 0.2, 0.22] as GlassColor,
  opacity: 0.92,
};

/** Near-opaque fallback for reduced-transparency in light mode */
const REDUCED_TRANSPARENCY_LIGHT = {
  tint: [0.92, 0.92, 0.94] as GlassColor,
  opacity: 0.90,
};

export function useGlassRegion(
  elementRef: React.RefObject<HTMLElement | null>,
  props: GlassStyleProps
) {
  const ctx = useGlassEngine();
  const handleRef = useRef<GlassRegionHandle | null>(null);
  const { preferences: prefs } = ctx;

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

  // Sync effective params (considering a11y preferences) to engine
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;

    let effectiveBlur: number;
    let effectiveOpacity: number;
    let effectiveTint: GlassColor;
    let effectiveRefraction: number;
    const effectiveCornerRadius = props.cornerRadius ?? 24;

    if (prefs.reducedTransparency) {
      // Accessibility: instant transition to opaque state
      handle.updateMorphSpeed(0);

      // Reduced-transparency: near-opaque solid surface
      const rtDefaults = prefs.darkMode
        ? REDUCED_TRANSPARENCY_DARK
        : REDUCED_TRANSPARENCY_LIGHT;

      effectiveBlur = 0;
      effectiveOpacity = rtDefaults.opacity;
      effectiveTint = props.tint ?? rtDefaults.tint;
      effectiveRefraction = 0;

      // Disable all visual effects in reduced-transparency mode
      handle.updateAberration(0);
      handle.updateSpecular(0);
      handle.updateRim(0);
      handle.updateMode(0);
      handle.updateContrast(1.0);
      handle.updateSaturation(1.0);
      handle.updateBlurRadius(0);
      handle.updateFresnelIOR(1.0);
      handle.updateFresnelExponent(1.0);
      handle.updateEnvReflectionStrength(0);
      handle.updateGlareAngle(0);
    } else {
      // Normal mode: dark/light defaults for unset props
      const defaults = prefs.darkMode ? DARK_DEFAULTS : LIGHT_DEFAULTS;

      effectiveBlur = props.blur ?? 0.3;
      effectiveOpacity = props.opacity ?? defaults.opacity;
      effectiveTint = props.tint ?? defaults.tint;
      effectiveRefraction = props.refraction ?? 0.06;

      // Sync new visual effect props
      handle.updateAberration(props.aberration ?? 0.0);
      handle.updateSpecular(props.specular ?? 0.075);
      handle.updateRim(props.rim ?? 0.50);
      handle.updateMode(props.refractionMode === 'prominent' ? 1.0 : 0.0);
      handle.updateContrast(props.contrast ?? 1.22);
      handle.updateSaturation(props.saturation ?? 1.05);
      handle.updateFresnelIOR(props.fresnelIOR ?? 1.5);
      handle.updateFresnelExponent(props.fresnelExponent ?? 0.5);
      handle.updateEnvReflectionStrength(props.envReflectionStrength ?? 0.02);
      // glareDirection prop is degrees; convert to radians for shader
      handle.updateGlareAngle((props.glareDirection ?? 360) * Math.PI / 180);
      // blurRadius (pixels) takes precedence; falls back to blur (normalized) * 30
      handle.updateBlurRadius(props.blurRadius ?? (props.blur ?? 0.3) * 30);
    }

    handle.updateParams(
      effectiveCornerRadius,
      effectiveBlur,
      effectiveOpacity,
      effectiveRefraction
    );
    handle.updateTint(effectiveTint[0], effectiveTint[1], effectiveTint[2]);

    // Sync morph speed (restore after reduced-transparency instant set above)
    handle.updateMorphSpeed(props.morphSpeed ?? 8);
  }, [
    props.cornerRadius,
    props.blur,
    props.opacity,
    props.refraction,
    props.tint,
    props.aberration,
    props.specular,
    props.rim,
    props.refractionMode,
    props.morphSpeed,
    props.contrast,
    props.saturation,
    props.blurRadius,
    props.fresnelIOR,
    props.fresnelExponent,
    props.envReflectionStrength,
    props.glareDirection,
    prefs.reducedTransparency,
    prefs.darkMode,
    ctx.ready,
  ]);
}

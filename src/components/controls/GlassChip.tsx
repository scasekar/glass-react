import { useState } from 'react';
import { GlassButton } from '../GlassButton';
import { APPLE_RADII, APPLE_SPACING, APPLE_CONTROL_SIZES } from '../../tokens/apple';
import type { GlassChipProps } from '../types';

/**
 * A selectable glass chip / pill toggle.
 * Composes GlassButton with `aria-pressed` for screen reader accessibility.
 *
 * When selected, glass opacity and specular increase to visually distinguish state.
 * Uses APPLE_RADII.pill for capsule shape and APPLE_CONTROL_SIZES.minTapTarget
 * for accessible touch target sizing.
 *
 * @example
 * ```tsx
 * <GlassChip label="Featured" selected={isSelected} onToggle={setIsSelected} />
 * ```
 */
export function GlassChip({
  label,
  selected,
  onToggle,
  disabled,
  className,
  style,
}: GlassChipProps) {
  const [hovered, setHovered] = useState(false);

  // Selected state: increase opacity, specular, and rim for visual prominence
  // Hovered (unselected): subtle specular increase for feedback
  const effectiveOpacity = selected ? 0.18 : undefined;
  const effectiveSpecular = selected ? 0.2 : (hovered ? 0.16 : undefined);
  const effectiveRim = selected ? 0.2 : undefined;

  return (
    <GlassButton
      cornerRadius={APPLE_RADII.pill}
      opacity={effectiveOpacity}
      specular={effectiveSpecular}
      rim={effectiveRim}
      aria-pressed={selected}
      onClick={() => onToggle(!selected)}
      disabled={disabled}
      className={className}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        paddingInline: APPLE_SPACING.sm,
        paddingBlock: APPLE_SPACING.xs,
        minHeight: APPLE_CONTROL_SIZES.minTapTarget,
        fontSize: 14,
        fontWeight: 500,
        ...style,
      }}
    >
      {label}
    </GlassButton>
  );
}

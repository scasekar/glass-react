import { useId } from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { motion, useReducedMotion, LayoutGroup } from 'motion/react';
import { GlassPanel } from '../GlassPanel';
import { APPLE_CONTROL_SIZES, APPLE_RADII, APPLE_SPACING } from '../../tokens/apple';
import type { GlassSegmentedControlProps } from './types';

/**
 * A segmented control with a spring-animated glass indicator capsule.
 *
 * The container is a semi-transparent tinted capsule (NOT glass).
 * Only the sliding indicator thumb uses a GlassPanel for the glass effect.
 *
 * Uses Radix ToggleGroup for roving tabindex and ARIA semantics,
 * and motion layoutId for spring-animated indicator morphing.
 *
 * @example
 * ```tsx
 * <GlassSegmentedControl
 *   value={view}
 *   onValueChange={setView}
 *   segments={[
 *     { value: 'day', label: 'Day' },
 *     { value: 'week', label: 'Week' },
 *     { value: 'month', label: 'Month' },
 *   ]}
 * />
 * ```
 */
export function GlassSegmentedControl({
  value,
  onValueChange,
  segments,
  className,
  style,
}: GlassSegmentedControlProps) {
  const id = useId();
  const indicatorId = `${id}-seg-indicator`;
  const reducedMotion = useReducedMotion();

  const spring = reducedMotion
    ? { type: 'tween' as const, duration: 0 }
    : { type: 'spring' as const, stiffness: 400, damping: 35 };

  return (
    <LayoutGroup>
      <ToggleGroup.Root
        type="single"
        value={value}
        onValueChange={(v) => {
          if (v) onValueChange(v);
        }}
        className={className}
        style={{
          display: 'flex',
          height: APPLE_CONTROL_SIZES.segmentedHeight,
          padding: APPLE_CONTROL_SIZES.segmentedPadding,
          borderRadius: APPLE_RADII.pill,
          background: 'rgba(80, 80, 100, 0.5)',
          border: '1px solid rgba(255,255,255,0.1)',
          position: 'relative',
          ...style,
        }}
      >
        {segments.map((seg) => (
          <ToggleGroup.Item
            key={seg.value}
            value={seg.value}
            style={{
              position: 'relative',
              flex: 1,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              zIndex: 1,
              padding: `0 ${APPLE_SPACING.sm}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {value === seg.value && (
              <motion.div
                layoutId={indicatorId}
                transition={spring}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: APPLE_RADII.pill,
                  zIndex: 0,
                }}
              >
                <GlassPanel
                  cornerRadius={APPLE_RADII.pill}
                  opacity={0.35}
                  specular={0.25}
                  style={{ width: '100%', height: '100%' }}
                />
              </motion.div>
            )}
            <span
              style={{
                position: 'relative',
                zIndex: 1,
                fontSize: 13,
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}
            >
              {seg.label}
            </span>
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </LayoutGroup>
  );
}

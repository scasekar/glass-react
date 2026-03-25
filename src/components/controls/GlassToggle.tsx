import * as Switch from '@radix-ui/react-switch';
import { motion, useReducedMotion } from 'motion/react';
import { GlassPanel } from '../GlassPanel';
import { APPLE_CONTROL_SIZES, APPLE_RADII } from '../../tokens/apple';
import type { GlassToggleProps } from './types';

const {
  toggleWidth,
  toggleHeight,
  toggleThumbSize,
  toggleThumbInset,
  minTapTarget,
} = APPLE_CONTROL_SIZES;

/** Spring config for thumb animation */
const SPRING_CONFIG = { type: 'spring' as const, stiffness: 500, damping: 30, mass: 0.8 };

/** Instant snap for reduced-motion users */
const REDUCED_MOTION_CONFIG = { type: 'tween' as const, duration: 0 };

export function GlassToggle({
  checked,
  onCheckedChange,
  label,
  disabled = false,
  className,
  style,
}: GlassToggleProps) {
  const reducedMotion = useReducedMotion();
  const transition = reducedMotion ? REDUCED_MOTION_CONFIG : SPRING_CONFIG;

  const thumbLeft = checked
    ? toggleWidth - toggleThumbSize - toggleThumbInset
    : toggleThumbInset;

  return (
    <Switch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      className={className}
      style={{
        all: 'unset',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: minTapTarget,
        minWidth: minTapTarget,
        cursor: disabled ? 'default' : 'pointer',
        ...style,
      }}
    >
      {/* Track */}
      <GlassPanel
        cornerRadius={APPLE_RADII.pill}
        style={{
          width: toggleWidth,
          height: toggleHeight,
          position: 'relative',
          flexShrink: 0,
        }}
      >
        {/* Green overlay for ON state */}
        {checked && (
          <div
            data-testid="toggle-active-overlay"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: APPLE_RADII.pill,
              background: 'rgba(52, 199, 89, 0.6)',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Thumb */}
        <Switch.Thumb asChild>
          <motion.div
            layout
            transition={transition}
            style={{
              position: 'absolute',
              top: toggleThumbInset,
              left: thumbLeft,
              width: toggleThumbSize,
              height: toggleThumbSize,
            }}
          >
            <GlassPanel
              cornerRadius={APPLE_RADII.pill}
              style={{
                width: toggleThumbSize,
                height: toggleThumbSize,
                display: 'block',
              }}
            />
          </motion.div>
        </Switch.Thumb>
      </GlassPanel>
    </Switch.Root>
  );
}

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
      {/* Track — uses CSS background instead of GlassPanel for reliable small-size rendering */}
      <div
        style={{
          width: toggleWidth,
          height: toggleHeight,
          position: 'relative',
          flexShrink: 0,
          borderRadius: APPLE_RADII.pill,
          background: checked
            ? 'rgba(52, 199, 89, 0.65)'
            : 'rgba(120, 120, 130, 0.4)',
          border: '1px solid rgba(255,255,255,0.15)',
          transition: 'background 0.2s',
        }}
        data-testid="toggle-active-overlay"
      >
        {/* Thumb — solid white circle for visibility */}
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
              borderRadius: APPLE_RADII.pill,
              background: 'rgba(255, 255, 255, 0.95)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            }}
          />
        </Switch.Thumb>
      </div>
    </Switch.Root>
  );
}

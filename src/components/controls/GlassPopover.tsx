import * as Popover from '@radix-ui/react-popover';
import { motion, AnimatePresence } from 'motion/react';
import { GlassPanel } from '../GlassPanel';
import { APPLE_RADII, APPLE_SPACING } from '../../tokens/apple';
import type { GlassPopoverProps } from './types';

/**
 * A contextual popover with glass background anchored to a trigger element.
 * Uses Radix Popover for anchor positioning, collision avoidance, and outside-click dismiss.
 * Uses fade-only animation to avoid position miscalculation during entry (Pitfall 6).
 *
 * @example
 * ```tsx
 * <GlassPopover
 *   open={showPopover}
 *   onOpenChange={setShowPopover}
 *   trigger={<button>Options</button>}
 *   side="bottom"
 * >
 *   <p>Popover content</p>
 * </GlassPopover>
 * ```
 */
export function GlassPopover({
  open,
  onOpenChange,
  trigger,
  children,
  side = 'bottom',
  align = 'center',
  sideOffset = 8,
  className,
  style,
}: GlassPopoverProps) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        {trigger}
      </Popover.Trigger>
      <AnimatePresence>
        {open && (
          <Popover.Portal forceMount>
            <Popover.Content
              asChild
              forceMount
              side={side}
              align={align}
              sideOffset={sideOffset}
              avoidCollisions
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={className}
                style={style}
              >
                <GlassPanel cornerRadius={APPLE_RADII.lg}>
                  <div style={{ padding: APPLE_SPACING.md }}>
                    {children}
                  </div>
                </GlassPanel>
              </motion.div>
            </Popover.Content>
          </Popover.Portal>
        )}
      </AnimatePresence>
    </Popover.Root>
  );
}

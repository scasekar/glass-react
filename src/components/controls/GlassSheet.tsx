import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'motion/react';
import { GlassPanel } from '../GlassPanel';
import { APPLE_RADII, APPLE_SPACING } from '../../tokens/apple';
import type { GlassSheetProps } from './types';

/**
 * A half-height or full-height modal sheet with glass background and drag-to-dismiss.
 * Uses Radix Dialog for focus trapping, Escape dismiss, and portal rendering.
 * The drag handle is separate from content to avoid drag/scroll conflicts.
 *
 * @example
 * ```tsx
 * <GlassSheet open={showSheet} onOpenChange={setShowSheet} title="Settings">
 *   <p>Sheet content here</p>
 * </GlassSheet>
 * ```
 */
export function GlassSheet({
  open,
  onOpenChange,
  children,
  height = 'half',
  showDragHandle = true,
  title,
  className,
  style,
}: GlassSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.4)',
                  zIndex: 9998,
                }}
                onClick={() => onOpenChange(false)}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className={className}
                style={{
                  position: 'fixed',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  zIndex: 9999,
                  height: height === 'full' ? '100vh' : '50vh',
                  ...style,
                }}
              >
                <GlassPanel
                  cornerRadius={APPLE_RADII.xl}
                  style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderBottomLeftRadius: 0,
                    borderBottomRightRadius: 0,
                  }}
                >
                  {/* Drag handle area -- separate from scrollable content to avoid Pitfall 5 */}
                  {showDragHandle && (
                    <motion.div
                      drag="y"
                      dragConstraints={{ top: 0 }}
                      dragElastic={{ top: 0, bottom: 0.3 }}
                      onDragEnd={(_, info) => {
                        if (info.offset.y > 100 || info.velocity.y > 500) {
                          onOpenChange(false);
                        }
                      }}
                      style={{
                        padding: APPLE_SPACING.md,
                        cursor: 'grab',
                        touchAction: 'none',
                      }}
                      data-testid="glass-sheet-drag-handle"
                    >
                      <div
                        style={{
                          width: 36,
                          height: 5,
                          borderRadius: 2.5,
                          background: 'rgba(255,255,255,0.3)',
                          margin: '0 auto',
                        }}
                      />
                    </motion.div>
                  )}

                  {/* Title */}
                  {title ? (
                    <Dialog.Title
                      style={{
                        fontSize: 17,
                        fontWeight: 600,
                        margin: 0,
                        padding: `0 ${APPLE_SPACING.xl}px ${APPLE_SPACING.sm}px`,
                        textAlign: 'center',
                      }}
                    >
                      {title}
                    </Dialog.Title>
                  ) : (
                    <Dialog.Title className="sr-only">Sheet</Dialog.Title>
                  )}

                  {/* Visually hidden description to satisfy Radix a11y */}
                  <Dialog.Description className="sr-only">
                    Modal sheet
                  </Dialog.Description>

                  {/* Scrollable content area */}
                  <div
                    style={{
                      flex: 1,
                      overflow: 'auto',
                      padding: `0 ${APPLE_SPACING.xl}px ${APPLE_SPACING.xl}px`,
                    }}
                  >
                    {children}
                  </div>
                </GlassPanel>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

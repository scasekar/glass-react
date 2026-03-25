import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'motion/react';
import { GlassPanel } from '../GlassPanel';
import { GlassButton } from '../GlassButton';
import { APPLE_RADII, APPLE_SPACING } from '../../tokens/apple';
import type { GlassActionSheetProps } from './types';

/**
 * A bottom slide-up action sheet with glass option rows and a cancel button.
 * Uses Radix Dialog for focus trapping, Escape dismiss, and portal rendering.
 * Composes GlassPanel for the glass surface and GlassButton for action rows.
 *
 * @example
 * ```tsx
 * <GlassActionSheet
 *   open={showSheet}
 *   onOpenChange={setShowSheet}
 *   title="Share Photo"
 *   actions={[
 *     { label: 'Copy Link', onPress: handleCopy },
 *     { label: 'Save to Photos', onPress: handleSave },
 *     { label: 'Delete', onPress: handleDelete, style: 'destructive' },
 *   ]}
 * />
 * ```
 */
export function GlassActionSheet({
  open,
  onOpenChange,
  title,
  actions,
  cancelLabel = 'Cancel',
  className,
  style,
}: GlassActionSheetProps) {
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
                  padding: APPLE_SPACING.sm,
                  ...style,
                }}
              >
                <GlassPanel
                  cornerRadius={APPLE_RADII.xl}
                  style={{
                    borderBottomLeftRadius: 0,
                    borderBottomRightRadius: 0,
                  }}
                >
                  <div
                    style={{
                      padding: APPLE_SPACING.xl,
                    }}
                  >
                    {title ? (
                      <Dialog.Title
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          textAlign: 'center',
                          opacity: 0.6,
                          margin: 0,
                          marginBottom: APPLE_SPACING.md,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                        }}
                      >
                        {title}
                      </Dialog.Title>
                    ) : (
                      <Dialog.Title className="sr-only">
                        Action sheet
                      </Dialog.Title>
                    )}
                    <Dialog.Description className="sr-only">
                      {title || 'Action sheet'}
                    </Dialog.Description>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: APPLE_SPACING.sm,
                      }}
                    >
                      {actions.map((action) => (
                        <GlassButton
                          key={action.label}
                          cornerRadius={APPLE_RADII.pill}
                          tint={
                            action.style === 'destructive'
                              ? [0.8, 0.1, 0.1]
                              : undefined
                          }
                          onClick={() => {
                            action.onPress();
                            onOpenChange(false);
                          }}
                          style={{
                            width: '100%',
                            padding: `${APPLE_SPACING.md}px ${APPLE_SPACING.lg}px`,
                            fontSize: 17,
                            fontWeight:
                              action.style === 'primary' ? 600 : 400,
                          }}
                        >
                          {action.label}
                        </GlassButton>
                      ))}
                    </div>
                    <div
                      style={{
                        marginTop: APPLE_SPACING.sm,
                        paddingTop: APPLE_SPACING.sm,
                      }}
                    >
                      <GlassButton
                        cornerRadius={APPLE_RADII.pill}
                        onClick={() => onOpenChange(false)}
                        style={{
                          width: '100%',
                          padding: `${APPLE_SPACING.md}px ${APPLE_SPACING.lg}px`,
                          fontSize: 17,
                          fontWeight: 600,
                        }}
                      >
                        {cancelLabel}
                      </GlassButton>
                    </div>
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

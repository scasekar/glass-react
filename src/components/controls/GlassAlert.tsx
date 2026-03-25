import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'motion/react';
import { GlassPanel } from '../GlassPanel';
import { GlassButton } from '../GlassButton';
import { APPLE_RADII, APPLE_SPACING } from '../../tokens/apple';
import type { GlassAlertProps } from './types';

/**
 * A centered glass alert dialog with title, optional message, and action buttons.
 * Uses Radix Dialog for focus trapping, Escape dismiss, and portal rendering.
 * Composes GlassPanel for the glass surface and GlassButton for action rows.
 *
 * @example
 * ```tsx
 * <GlassAlert
 *   open={showAlert}
 *   onOpenChange={setShowAlert}
 *   title="Delete Item"
 *   message="This action cannot be undone."
 *   actions={[
 *     { label: 'Cancel', onPress: () => {}, style: 'default' },
 *     { label: 'Delete', onPress: handleDelete, style: 'destructive' },
 *   ]}
 * />
 * ```
 */
export function GlassAlert({
  open,
  onOpenChange,
  title,
  message,
  actions,
  className,
  style,
}: GlassAlertProps) {
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
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={className}
                style={{
                  position: 'fixed',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 9999,
                  minWidth: 280,
                  maxWidth: 400,
                  ...style,
                }}
              >
                <GlassPanel
                  cornerRadius={APPLE_RADII.xl}
                  style={{ width: '100%' }}
                >
                  <div
                    style={{
                      padding: APPLE_SPACING.xl,
                      textAlign: 'center',
                    }}
                  >
                    <Dialog.Title
                      style={{
                        fontSize: 17,
                        fontWeight: 600,
                        margin: 0,
                        marginBottom: message ? APPLE_SPACING.sm : APPLE_SPACING.md,
                      }}
                    >
                      {title}
                    </Dialog.Title>
                    {message ? (
                      <Dialog.Description
                        style={{
                          fontSize: 13,
                          opacity: 0.7,
                          margin: 0,
                          marginBottom: APPLE_SPACING.md,
                        }}
                      >
                        {message}
                      </Dialog.Description>
                    ) : (
                      <Dialog.Description
                        style={{
                          position: 'absolute',
                          width: 1,
                          height: 1,
                          padding: 0,
                          margin: -1,
                          overflow: 'hidden',
                          clip: 'rect(0, 0, 0, 0)',
                          whiteSpace: 'nowrap',
                          borderWidth: 0,
                        }}
                      >
                        {title}
                      </Dialog.Description>
                    )}
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
                            ...(action.style === 'destructive' ? {
                              color: '#ff453a',
                              fontWeight: 600,
                              textShadow: '0 0 12px rgba(255, 69, 58, 0.4)',
                            } : {}),
                          }}
                        >
                          {action.label}
                        </GlassButton>
                      ))}
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

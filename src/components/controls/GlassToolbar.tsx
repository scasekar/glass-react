import { GlassPanel } from '../GlassPanel';
import { GlassButton } from '../GlassButton';
import { GlassEffectContainer } from '../GlassEffectContainer';
import { APPLE_SPACING, APPLE_RADII, APPLE_CONTROL_SIZES } from '../../tokens/apple';
import type { GlassToolbarProps } from './types';

/**
 * A glass-effect toolbar for the bottom of the screen.
 *
 * Renders a fixed bottom bar with a glass background containing a centered row
 * of icon action buttons. Primary actions are visually distinguished with
 * `refractionMode="prominent"`. Follows Apple HIG dimensions (44px height,
 * 44px tap targets).
 *
 * @example
 * ```tsx
 * <GlassToolbar
 *   actions={[
 *     { id: 'bold', icon: <BoldIcon />, label: 'Bold', onPress: toggleBold },
 *     { id: 'send', icon: <SendIcon />, label: 'Send', onPress: send, primary: true },
 *   ]}
 * />
 * ```
 */
export function GlassToolbar({
  actions,
  style,
  className,
}: GlassToolbarProps) {
  return (
    <div role="toolbar" aria-label="Toolbar" className={className} style={style}>
      <GlassPanel
        cornerRadius={0}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 44,
          zIndex: 100,
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: APPLE_SPACING.sm,
          paddingLeft: APPLE_SPACING.md,
          paddingRight: APPLE_SPACING.md,
        }}
      >
        <GlassEffectContainer id="toolbar-actions" animate={false}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: APPLE_SPACING.sm,
            }}
          >
            {actions.map((action) => (
              <GlassButton
                key={action.id}
                cornerRadius={APPLE_RADII.md}
                aria-label={action.label}
                onClick={() => action.onPress()}
                refractionMode={action.primary ? 'prominent' : undefined}
                data-primary={action.primary ? 'true' : undefined}
                style={{
                  minWidth: APPLE_CONTROL_SIZES.minTapTarget,
                  minHeight: APPLE_CONTROL_SIZES.minTapTarget,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
              >
                {action.icon}
              </GlassButton>
            ))}
          </div>
        </GlassEffectContainer>
      </GlassPanel>
    </div>
  );
}

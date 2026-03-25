import { GlassPanel } from '../GlassPanel';
import { GlassButton } from '../GlassButton';
import { GlassEffectContainer } from '../GlassEffectContainer';
import { APPLE_SPACING, APPLE_RADII, APPLE_CONTROL_SIZES } from '../../tokens/apple';
import type { GlassNavigationBarProps } from './types';

/**
 * A glass-effect navigation bar for the top of the screen.
 *
 * Renders a fixed top bar with a glass background containing an optional back
 * chevron, a bold title, and optional right-side action buttons. Follows Apple
 * HIG dimensions (44px height, 44px tap targets).
 *
 * @example
 * ```tsx
 * <GlassNavigationBar
 *   title="Settings"
 *   onBack={() => navigate(-1)}
 *   actions={[{ id: 'done', icon: <CheckIcon />, label: 'Done', onPress: save }]}
 * />
 * ```
 */
export function GlassNavigationBar({
  title,
  onBack,
  actions,
  style,
  className,
}: GlassNavigationBarProps) {
  return (
    <nav role="navigation" className={className} style={style}>
      <GlassPanel
        cornerRadius={0}
        style={{
          width: '100%',
          height: 44,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: APPLE_SPACING.md,
          paddingRight: APPLE_SPACING.md,
        }}
      >
        {onBack && (
          <GlassEffectContainer id="navbar-back" animate={false}>
            <GlassButton
              cornerRadius={APPLE_RADII.md}
              aria-label="Back"
              onClick={onBack}
              style={{
                minWidth: APPLE_CONTROL_SIZES.minTapTarget,
                minHeight: APPLE_CONTROL_SIZES.minTapTarget,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              <span style={{ fontSize: 24, lineHeight: 1 }}>{'\u2039'}</span>
            </GlassButton>
          </GlassEffectContainer>
        )}

        <span
          style={{
            flex: 1,
            textAlign: 'left',
            fontWeight: 600,
            fontSize: 17,
            paddingLeft: APPLE_SPACING.sm,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>

        {actions && actions.length > 0 && (
          <GlassEffectContainer id="navbar-actions" animate={false}>
            <div style={{ display: 'flex', flexDirection: 'row', gap: APPLE_SPACING.xs }}>
              {actions.map((action) => (
                <GlassButton
                  key={action.id}
                  cornerRadius={APPLE_RADII.md}
                  aria-label={action.label}
                  onClick={() => action.onPress()}
                  refractionMode={action.primary ? 'prominent' : undefined}
                  style={{
                    minWidth: APPLE_CONTROL_SIZES.minTapTarget,
                    minHeight: APPLE_CONTROL_SIZES.minTapTarget,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}

                >
                  <span style={{ fontSize: 20, lineHeight: 1 }}>{action.icon}</span>
                </GlassButton>
              ))}
            </div>
          </GlassEffectContainer>
        )}
      </GlassPanel>
    </nav>
  );
}

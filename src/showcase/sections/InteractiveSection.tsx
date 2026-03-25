import { useState } from 'react';
import { GlassToggle } from '../../components/controls/GlassToggle';
import { GlassSlider } from '../../components/controls/GlassSlider';
import { GlassSegmentedControl } from '../../components/controls/GlassSegmentedControl';
import { GlassPanel } from '../../components/GlassPanel';
import { APPLE_RADII, APPLE_SPACING } from '../../tokens/apple';

const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/**
 * Interactive controls demo section -- a mock "Settings" card with toggle, slider,
 * and segmented control in realistic use context.
 */
export function InteractiveSection() {
  const [notifications, setNotifications] = useState(true);
  const [volume, setVolume] = useState(65);
  const [appearance, setAppearance] = useState('auto');

  return (
    <div style={{ paddingTop: 120, fontFamily: FONT_STACK }}>
      {/* Section Title */}
      <div style={{ textAlign: 'center', marginBottom: APPLE_SPACING.xxxl }}>
        <h2
          style={{
            fontSize: '2rem',
            fontWeight: 700,
            margin: 0,
            color: '#fff',
          }}
        >
          Controls That Feel Alive
        </h2>
        <p
          style={{
            fontSize: '1rem',
            color: 'rgba(255, 255, 255, 0.6)',
            margin: '12px 0 0',
          }}
        >
          Physics-based spring animations and real GPU glass on every surface.
        </p>
      </div>

      {/* Settings Card */}
      <GlassPanel
        cornerRadius={APPLE_RADII.xl}
        style={{
          maxWidth: 480,
          margin: '0 auto',
          padding: APPLE_SPACING.xxl,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: APPLE_SPACING.xl }}>
          {/* Notifications Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: '1rem', fontWeight: 500, color: '#fff' }}>
              Notifications
            </span>
            <GlassToggle
              checked={notifications}
              onCheckedChange={setNotifications}
              label="Notifications"
            />
          </div>

          {/* Volume Row */}
          <div>
            <span
              style={{
                fontSize: '1rem',
                fontWeight: 500,
                color: '#fff',
                display: 'block',
                marginBottom: APPLE_SPACING.sm,
              }}
            >
              Volume
            </span>
            <GlassSlider
              value={volume}
              onValueChange={setVolume}
              min={0}
              max={100}
              step={1}
              label="Volume"
            />
          </div>

          {/* Appearance Row */}
          <div>
            <span
              style={{
                fontSize: '1rem',
                fontWeight: 500,
                color: '#fff',
                display: 'block',
                marginBottom: APPLE_SPACING.sm,
              }}
            >
              Appearance
            </span>
            <GlassSegmentedControl
              value={appearance}
              onValueChange={setAppearance}
              segments={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'auto', label: 'Auto' },
              ]}
            />
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}

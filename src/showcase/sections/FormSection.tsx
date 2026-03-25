import { useState } from 'react';
import { GlassChip } from '../../components/controls/GlassChip';
import { GlassStepper } from '../../components/controls/GlassStepper';
import { GlassInput } from '../../components/controls/GlassInput';
import { GlassPanel } from '../../components/GlassPanel';
import { APPLE_RADII, APPLE_SPACING } from '../../tokens/apple';

const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const INTERESTS = ['Design', 'Engineering', 'Music', 'Photography'];

/**
 * Form controls demo section -- a mock "Preferences" form card with chips,
 * stepper, and text input in realistic use context.
 */
export function FormSection() {
  const [selected, setSelected] = useState<Set<string>>(new Set(['Design']));
  const [quantity, setQuantity] = useState(3);
  const [email, setEmail] = useState('');

  const toggleInterest = (interest: string, isSelected: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (isSelected) {
        next.add(interest);
      } else {
        next.delete(interest);
      }
      return next;
    });
  };

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
          The Complete Control Palette
        </h2>
        <p
          style={{
            fontSize: '1rem',
            color: 'rgba(255, 255, 255, 0.6)',
            margin: '12px 0 0',
          }}
        >
          Chips, steppers, and inputs for any form or settings screen.
        </p>
      </div>

      {/* Preferences Card */}
      <GlassPanel
        cornerRadius={APPLE_RADII.xl}
        style={{
          maxWidth: 480,
          margin: '0 auto',
          padding: APPLE_SPACING.xxl,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: APPLE_SPACING.xl }}>
          {/* Interests */}
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
              Interests
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: APPLE_SPACING.sm }}>
              {INTERESTS.map(interest => (
                <GlassChip
                  key={interest}
                  label={interest}
                  selected={selected.has(interest)}
                  onToggle={isSelected => toggleInterest(interest, isSelected)}
                />
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: '1rem', fontWeight: 500, color: '#fff' }}>Quantity</span>
            <GlassStepper
              value={quantity}
              onChange={setQuantity}
              min={1}
              max={10}
              label="Quantity"
            />
          </div>

          {/* Email */}
          <div>
            <GlassInput
              label="Email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              type="email"
            />
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}

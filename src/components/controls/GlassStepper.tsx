import { GlassButton } from '../GlassButton';
import { GlassPanel } from '../GlassPanel';
import { APPLE_RADII, APPLE_SPACING, APPLE_CONTROL_SIZES } from '../../tokens/apple';
import type { GlassStepperProps } from '../types';

/**
 * A numeric stepper control with glass +/- buttons and a glass value display.
 * Composes two GlassButton instances and one GlassPanel for the value readout.
 *
 * The value is clamped between min and max. Buttons are disabled at their
 * respective limits. Uses role="group" with aria-label for screen reader
 * context, and an <output> element for automatic value announcements.
 *
 * @example
 * ```tsx
 * const [qty, setQty] = useState(1);
 * <GlassStepper value={qty} onChange={setQty} min={0} max={99} label="Quantity" />
 * ```
 */
export function GlassStepper({
  value,
  onChange,
  min = 0,
  max = 10,
  step = 1,
  label,
  disabled,
  className,
  style,
}: GlassStepperProps) {
  const decrement = () => onChange(Math.max(min, value - step));
  const increment = () => onChange(Math.min(max, value + step));

  return (
    <div
      role="group"
      aria-label={label ?? 'Stepper'}
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: APPLE_SPACING.xs,
        ...style,
      }}
    >
      <GlassButton
        cornerRadius={APPLE_RADII.pill}
        opacity={0.2}
        aria-label="Decrease"
        disabled={disabled || value <= min}
        onClick={decrement}
        style={{
          width: APPLE_CONTROL_SIZES.minTapTarget,
          height: APPLE_CONTROL_SIZES.minTapTarget,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          fontWeight: 500,
          border: '1px solid rgba(255,255,255,0.15)',
        }}
      >
        {'\u2212'}
      </GlassButton>

      <output
        aria-label={`${label ?? 'Value'}: ${value}`}
        aria-atomic="true"
      >
        <GlassPanel
          cornerRadius={APPLE_RADII.sm}
          style={{
            minWidth: 48,
            minHeight: 36,
            textAlign: 'center',
            padding: `${APPLE_SPACING.sm}px ${APPLE_SPACING.md}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 17,
            fontWeight: 500,
          }}
        >
          {value}
        </GlassPanel>
      </output>

      <GlassButton
        cornerRadius={APPLE_RADII.pill}
        opacity={0.2}
        aria-label="Increase"
        disabled={disabled || value >= max}
        onClick={increment}
        style={{
          width: APPLE_CONTROL_SIZES.minTapTarget,
          height: APPLE_CONTROL_SIZES.minTapTarget,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          fontWeight: 500,
          border: '1px solid rgba(255,255,255,0.15)',
        }}
      >
        +
      </GlassButton>
    </div>
  );
}

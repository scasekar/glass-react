import { GlassButton } from '../GlassButton';
import { GlassPanel } from '../GlassPanel';
import { APPLE_RADII, APPLE_SPACING } from '../../tokens/apple';
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
        aria-label="Decrease"
        disabled={disabled || value <= min}
        onClick={decrement}
        style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
            minWidth: 40,
            textAlign: 'center',
            padding: `${APPLE_SPACING.xs}px ${APPLE_SPACING.sm}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {value}
        </GlassPanel>
      </output>

      <GlassButton
        cornerRadius={APPLE_RADII.pill}
        aria-label="Increase"
        disabled={disabled || value >= max}
        onClick={increment}
        style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        +
      </GlassButton>
    </div>
  );
}

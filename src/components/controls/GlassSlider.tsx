import * as RadixSlider from '@radix-ui/react-slider';
import { GlassPanel } from '../GlassPanel';
import { APPLE_CONTROL_SIZES, APPLE_RADII } from '../../tokens/apple';
import type { GlassSliderProps } from './types';

const { sliderTrackHeight, sliderThumbSize, minTapTarget } = APPLE_CONTROL_SIZES;

export function GlassSlider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  disabled = false,
  className,
  style,
}: GlassSliderProps) {
  return (
    <RadixSlider.Root
      value={[value]}
      onValueChange={([v]) => onValueChange(v)}
      min={min}
      max={max}
      step={step}
      aria-label={label}
      disabled={disabled}
      className={className}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        height: minTapTarget,
        touchAction: 'none',
        userSelect: 'none',
        ...style,
      }}
    >
      {/* Track — CSS background for reliable rendering at small height */}
      <RadixSlider.Track
        style={{
          display: 'block',
          position: 'relative',
          flexGrow: 1,
          height: 6,
          borderRadius: APPLE_RADII.pill,
          background: 'rgba(255, 255, 255, 0.15)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {/* Fill / Range */}
        <RadixSlider.Range
          style={{
            display: 'block',
            position: 'absolute',
            height: '100%',
            borderRadius: APPLE_RADII.pill,
            background: 'rgba(255, 255, 255, 0.5)',
          }}
        />
      </RadixSlider.Track>

      {/* Thumb — wrapping div ensures Radix Thumb span gets dimensions */}
      <RadixSlider.Thumb
        aria-label={label}
        style={{
          display: 'block',
          width: sliderThumbSize,
          height: sliderThumbSize,
          borderRadius: APPLE_RADII.pill,
          outline: 'none',
          background: 'rgba(255, 255, 255, 0.9)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.2)',
          cursor: 'pointer',
        }}
      />
    </RadixSlider.Root>
  );
}

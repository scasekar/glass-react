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
      {/* Track */}
      <RadixSlider.Track asChild>
        <GlassPanel
          cornerRadius={APPLE_RADII.pill}
          style={{
            height: sliderTrackHeight,
            flexGrow: 1,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Fill / Range */}
          <RadixSlider.Range asChild>
            <GlassPanel
              cornerRadius={APPLE_RADII.pill}
              style={{
                position: 'absolute',
                height: '100%',
                borderRadius: APPLE_RADII.pill,
              }}
            />
          </RadixSlider.Range>
        </GlassPanel>
      </RadixSlider.Track>

      {/* Thumb */}
      <RadixSlider.Thumb asChild>
        <GlassPanel
          cornerRadius={APPLE_RADII.pill}
          style={{
            display: 'block',
            width: sliderThumbSize,
            height: sliderThumbSize,
            borderRadius: APPLE_RADII.pill,
          }}
        />
      </RadixSlider.Thumb>
    </RadixSlider.Root>
  );
}

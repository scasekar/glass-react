import { GlassSegmentedControl } from '../../components/controls/GlassSegmentedControl';
import { GlassButton } from '../../components/GlassButton';
import { APPLE_RADII } from '../../tokens/apple';

export interface HeroSectionProps {
  backgroundMode: 'image' | 'noise';
  onBackgroundModeChange: (mode: 'image' | 'noise') => void;
}

const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/**
 * Full-viewport hero section with headline, tagline, wallpaper selector, and CTA buttons.
 * The hero IS the demo -- glass CTA buttons and segmented control against the live wallpaper.
 */
export function HeroSection({ backgroundMode, onBackgroundModeChange }: HeroSectionProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT_STACK,
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 800, padding: '0 24px' }}>
        {/* Headline */}
        <h1
          style={{
            fontSize: '3rem',
            fontWeight: 700,
            margin: 0,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            color: '#fff',
          }}
        >
          Glass for React
        </h1>

        {/* Tagline */}
        <p
          style={{
            fontSize: '1.2rem',
            color: 'rgba(255, 255, 255, 0.7)',
            margin: '16px 0 0',
            lineHeight: 1.5,
          }}
        >
          WebGPU-powered refraction and specular lighting. Not CSS blur.
        </p>

        {/* Wallpaper Selector */}
        <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center' }}>
          <GlassSegmentedControl
            value={backgroundMode}
            onValueChange={onBackgroundModeChange as (value: string) => void}
            segments={[
              { value: 'image', label: 'Wallpaper' },
              { value: 'noise', label: 'Noise' },
            ]}
          />
        </div>

        {/* CTA Buttons */}
        <div
          style={{
            marginTop: 40,
            display: 'flex',
            gap: 16,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <GlassButton
            refractionMode="prominent"
            cornerRadius={APPLE_RADII.md}
            onClick={() => window.open('https://github.com', '_blank')}
            style={{ padding: '12px 28px', fontSize: '1rem', fontWeight: 600 }}
          >
            View on GitHub
          </GlassButton>
          <GlassButton
            cornerRadius={APPLE_RADII.md}
            onClick={() =>
              document.getElementById('interactive')?.scrollIntoView({ behavior: 'smooth' })
            }
            style={{ padding: '12px 28px', fontSize: '1rem', fontWeight: 600 }}
          >
            Explore Controls
          </GlassButton>
        </div>
      </div>
    </div>
  );
}

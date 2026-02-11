import { useState } from 'react';
import { GlassProvider } from '../src/components/GlassProvider';
import { GlassPanel } from '../src/components/GlassPanel';
import { GlassButton } from '../src/components/GlassButton';
import { GlassCard } from '../src/components/GlassCard';
import { ControlPanel, type GlassParams } from './controls/ControlPanel';

const defaults: GlassParams = {
  blur: 0.5,
  opacity: 0.05,
  cornerRadius: 24,
  aberration: 3,
  specular: 0.2,
  rim: 0.15,
  tint: [1, 1, 1],
  refractionMode: 'standard',
  morphSpeed: 8,
};

export default function App() {
  const [params, setParams] = useState<GlassParams>(defaults);

  return (
    <GlassProvider>
      {/* Main content area */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 24,
        padding: '48px 48px 48px 48px',
        paddingRight: 328,
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <h1 style={{
            fontSize: '1.6rem',
            fontWeight: 700,
            color: 'rgba(255, 255, 255, 0.9)',
            margin: 0,
            letterSpacing: '-0.02em',
          }}>
            LiquidGlass React
          </h1>
          <p style={{
            fontSize: '0.85rem',
            color: 'rgba(255, 255, 255, 0.45)',
            marginTop: 6,
            maxWidth: 420,
            lineHeight: 1.5,
          }}>
            Real-time glass refraction effects powered by WebGPU.
            Adjust the controls on the right to explore every parameter.
          </p>
        </div>

        {/* Glass Panel */}
        <GlassPanel
          style={{ width: 360, padding: '32px', textAlign: 'center' }}
          blur={params.blur}
          opacity={params.opacity}
          cornerRadius={params.cornerRadius}
          tint={params.tint}
          aberration={params.aberration}
          specular={params.specular}
          rim={params.rim}
          refractionMode={params.refractionMode}
          morphSpeed={params.morphSpeed}
        >
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>
            Glass Panel
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: '0.85rem', opacity: 0.8, lineHeight: 1.5 }}>
            A frosted glass container with contrast-safe text.
            All parameters are controlled by the sidebar.
          </p>
        </GlassPanel>

        {/* Buttons row */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          <GlassButton
            style={{ padding: '14px 36px', fontSize: '1rem', fontWeight: 500 }}
            blur={params.blur}
            opacity={params.opacity}
            cornerRadius={Math.min(params.cornerRadius, 16)}
            tint={params.tint}
            aberration={params.aberration}
            specular={params.specular}
            rim={params.rim}
            refractionMode="standard"
            morphSpeed={params.morphSpeed}
            onClick={() => console.log('Standard glass clicked')}
          >
            Standard Button
          </GlassButton>

          <GlassButton
            style={{ padding: '14px 36px', fontSize: '1rem', fontWeight: 500 }}
            blur={params.blur}
            opacity={params.opacity}
            cornerRadius={Math.min(params.cornerRadius, 16)}
            tint={params.tint}
            aberration={params.aberration}
            specular={params.specular}
            rim={params.rim}
            refractionMode="prominent"
            morphSpeed={params.morphSpeed}
            onClick={() => console.log('Prominent glass clicked')}
          >
            Prominent Button
          </GlassButton>
        </div>

        {/* Glass Card */}
        <GlassCard
          style={{ width: 360, padding: '24px' }}
          blur={params.blur}
          opacity={params.opacity}
          cornerRadius={params.cornerRadius}
          tint={params.tint}
          aberration={params.aberration}
          specular={params.specular}
          rim={params.rim}
          refractionMode={params.refractionMode}
          morphSpeed={params.morphSpeed}
        >
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
            Glass Card
          </h3>
          <p style={{ margin: '8px 0 0', fontSize: '0.85rem', opacity: 0.8, lineHeight: 1.5 }}>
            An article-style card with the same glass parameters.
            Hover over the buttons above to see smooth morph transitions.
          </p>
        </GlassCard>

        {/* Footer hint */}
        <div style={{
          marginTop: 8,
          padding: '12px 20px',
          maxWidth: 440,
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.35)',
          fontSize: '0.72rem',
          lineHeight: 1.5,
        }}>
          Hover buttons to see morph transitions (specular 1.8x, rim 2x, aberration 1.5x).
          Press for blur reduction. Toggle OS accessibility preferences via Chrome DevTools
          &gt; Rendering to test reduced motion, reduced transparency, and dark/light mode.
        </div>
      </div>

      {/* Control Panel */}
      <ControlPanel params={params} onChange={setParams} />
    </GlassProvider>
  );
}

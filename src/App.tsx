import { GlassProvider } from './components/GlassProvider';
import { GlassPanel } from './components/GlassPanel';
import { GlassButton } from './components/GlassButton';
import { GlassCard } from './components/GlassCard';

export default function App() {
  return (
    <GlassProvider>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '24px',
        padding: '48px',
        position: 'relative',
        zIndex: 1,
      }}>
        <GlassPanel
          style={{ width: 340, padding: '32px', textAlign: 'center' }}
          cornerRadius={28}
        >
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>
            Glass Panel
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: '0.9rem', opacity: 0.8 }}>
            A frosted glass container with contrast-safe text.
            Text color and shadow adapt to dark/light mode.
          </p>
        </GlassPanel>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <GlassButton
            style={{ padding: '14px 36px', fontSize: '1rem', fontWeight: 500 }}
            cornerRadius={16}
            onClick={() => console.log('Standard glass clicked')}
          >
            Standard Glass
          </GlassButton>

          <GlassButton
            style={{ padding: '14px 36px', fontSize: '1rem', fontWeight: 500 }}
            cornerRadius={16}
            refractionMode="prominent"
            onClick={() => console.log('Prominent glass clicked')}
          >
            Prominent Glass
          </GlassButton>
        </div>

        <GlassCard
          style={{ width: 340, padding: '24px' }}
          cornerRadius={20}
          tint={[0.8, 0.85, 1.0]}
        >
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
            Glass Card (Custom Tint)
          </h3>
          <p style={{ margin: '8px 0 0', fontSize: '0.85rem', opacity: 0.8 }}>
            This card has an explicit blue tint with enhanced specular and rim
            effects. Hover the buttons above to see smooth morph transitions.
          </p>
        </GlassCard>

        <div style={{
          marginTop: '16px',
          padding: '16px 24px',
          maxWidth: 420,
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.5)',
          fontSize: '0.75rem',
          lineHeight: 1.5,
        }}>
          Hover over buttons to see smooth morph transitions (blur, specular, rim, aberration animate).
          The Standard button uses default refraction; Prominent uses enhanced mode (1.8x refraction, 1.5x specular).
          Toggle OS accessibility: Reduce Motion (freezes background), Reduce Transparency (instant opaque),
          Dark/Light Mode (adapts tint). Use Chrome DevTools &gt; Rendering to emulate.
        </div>
      </div>
    </GlassProvider>
  );
}

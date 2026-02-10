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
          blur={0.6}
          opacity={0.08}
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

        <GlassButton
          style={{ padding: '14px 36px', fontSize: '1rem', fontWeight: 500 }}
          blur={0.5}
          opacity={0.06}
          cornerRadius={16}
          onClick={() => console.log('Glass button clicked')}
        >
          Glass Button
        </GlassButton>

        <GlassCard
          style={{ width: 340, padding: '24px' }}
          blur={0.7}
          opacity={0.04}
          cornerRadius={20}
          tint={[0.8, 0.85, 1.0]}
        >
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
            Glass Card (Custom Tint)
          </h3>
          <p style={{ margin: '8px 0 0', fontSize: '0.85rem', opacity: 0.8 }}>
            This card has an explicit blue tint prop that is preserved in both
            dark and light modes -- never overridden by defaults.
          </p>
        </GlassCard>

        <div style={{
          marginTop: '16px',
          padding: '16px 24px',
          maxWidth: 400,
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.5)',
          fontSize: '0.75rem',
          lineHeight: 1.5,
        }}>
          Try toggling OS accessibility settings to see changes:
          Reduce Motion (freezes background animation),
          Reduce Transparency (opaque glass surfaces),
          Dark/Light Mode (adapts tint and text styles).
          Use Chrome DevTools &gt; Rendering to emulate these.
        </div>
      </div>
    </GlassProvider>
  );
}

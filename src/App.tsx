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
          style={{ width: 320, padding: '32px', textAlign: 'center' }}
          blur={0.6}
          opacity={0.08}
          cornerRadius={28}
        >
          <h2 style={{ color: 'white', margin: 0, fontSize: '1.2rem', fontWeight: 500 }}>
            Glass Panel
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', margin: '8px 0 0', fontSize: '0.9rem' }}>
            A frosted glass container
          </p>
        </GlassPanel>

        <GlassButton
          style={{ padding: '14px 36px', fontSize: '1rem', color: 'white', fontWeight: 500 }}
          blur={0.5}
          opacity={0.06}
          cornerRadius={16}
          onClick={() => console.log('Glass button clicked')}
        >
          Glass Button
        </GlassButton>

        <GlassCard
          style={{ width: 320, padding: '24px' }}
          blur={0.7}
          opacity={0.04}
          cornerRadius={20}
          tint={[0.8, 0.85, 1.0]}
        >
          <h3 style={{ color: 'white', margin: 0, fontSize: '1.1rem', fontWeight: 500 }}>
            Glass Card
          </h3>
          <p style={{ color: 'rgba(255,255,255,0.7)', margin: '8px 0 0', fontSize: '0.85rem' }}>
            An article-semantic glass element with a cool blue tint.
          </p>
        </GlassCard>
      </div>
    </GlassProvider>
  );
}

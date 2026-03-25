import { useState } from 'react';
import { GlassPanel } from '../components/GlassPanel';
import { VirtualSection } from './VirtualSection';
import { TuningDrawer } from './TuningDrawer';

export interface ShowcasePageProps {
  backgroundMode: 'image' | 'noise';
  onBackgroundModeChange: (mode: 'image' | 'noise') => void;
}

const NAV_LINKS = [
  { label: 'Controls', id: 'interactive' },
  { label: 'Navigation', id: 'navigation' },
  { label: 'Forms', id: 'forms' },
  { label: 'Get Started', id: 'developer' },
];

const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

function handleNavClick(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Top-level showcase shell with sticky header, virtualized sections, and tuning drawer.
 * Sections contain placeholders -- Plan 02 fills them with actual control demos.
 */
export function ShowcasePage({ backgroundMode, onBackgroundModeChange }: ShowcasePageProps) {
  const [tuningOpen, setTuningOpen] = useState(false);

  return (
    <div
      style={{
        fontFamily: FONT_STACK,
        color: 'rgba(255, 255, 255, 0.9)',
        position: 'relative',
        zIndex: 1,
      }}
    >
      {/* Sticky Header */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          height: 60,
        }}
      >
        <GlassPanel
          style={{
            height: '100%',
            maxWidth: 1200,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
          }}
          cornerRadius={0}
        >
          {/* Left: Logo */}
          <span
            style={{
              fontWeight: 700,
              fontSize: '1.1rem',
              letterSpacing: '-0.02em',
            }}
          >
            LiquidGlass
          </span>

          {/* Center: Nav links */}
          <nav
            style={{
              display: 'flex',
              gap: 24,
              alignItems: 'center',
            }}
          >
            {NAV_LINKS.map(link => (
              <a
                key={link.id}
                href={`#${link.id}`}
                onClick={e => handleNavClick(e, link.id)}
                style={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  textDecoration: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255, 255, 255, 1)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)')}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right: Tuning toggle */}
          <button
            onClick={() => setTuningOpen(o => !o)}
            aria-label="Toggle tuning drawer"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: 8,
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '1.1rem',
            }}
          >
            {'\u2699'}
          </button>
        </GlassPanel>
      </header>

      {/* Main content */}
      <main
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0 24px',
        }}
      >
        {/* Hero Section -- always mounted (above fold) */}
        <section id="hero">
          <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', maxWidth: 600 }}>
              <h1
                style={{
                  fontSize: '3rem',
                  fontWeight: 700,
                  margin: '0 0 16px',
                  letterSpacing: '-0.03em',
                  lineHeight: 1.1,
                }}
              >
                Apple Liquid Glass for React
              </h1>
              <p
                style={{
                  fontSize: '1.2rem',
                  opacity: 0.7,
                  margin: '0 0 32px',
                  lineHeight: 1.5,
                }}
              >
                WebGPU-powered refraction, not CSS blur.
              </p>
            </div>
          </div>
        </section>

        {/* Virtualized content sections -- placeholders for Plan 02 */}
        <VirtualSection id="interactive" minHeight={500}>
          <div style={{ padding: '120px 0 60px' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 600, marginBottom: 24 }}>Interactive Controls</h2>
            <p style={{ opacity: 0.6 }}>Toggle, slider, and segmented control demos will appear here.</p>
          </div>
        </VirtualSection>

        <VirtualSection id="navigation" minHeight={600}>
          <div style={{ padding: '120px 0 60px' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 600, marginBottom: 24 }}>Navigation</h2>
            <p style={{ opacity: 0.6 }}>Tab bar, navigation bar, toolbar, and search bar demos will appear here.</p>
          </div>
        </VirtualSection>

        <VirtualSection id="overlays" minHeight={500}>
          <div style={{ padding: '120px 0 60px' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 600, marginBottom: 24 }}>Overlays</h2>
            <p style={{ opacity: 0.6 }}>Action sheet, alert, sheet, and popover demos will appear here.</p>
          </div>
        </VirtualSection>

        <VirtualSection id="forms" minHeight={500}>
          <div style={{ padding: '120px 0 60px' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 600, marginBottom: 24 }}>Forms</h2>
            <p style={{ opacity: 0.6 }}>Chip, stepper, and input demos will appear here.</p>
          </div>
        </VirtualSection>

        <VirtualSection id="developer" minHeight={500}>
          <div style={{ padding: '120px 0 60px' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 600, marginBottom: 24 }}>Get Started</h2>
            <p style={{ opacity: 0.6 }}>Install command, API example, and GitHub link will appear here.</p>
          </div>
        </VirtualSection>
      </main>

      {/* TuningDrawer -- always mounted */}
      <TuningDrawer open={tuningOpen} onClose={() => setTuningOpen(false)} />
    </div>
  );
}

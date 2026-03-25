import { useState } from 'react';
import { GlassPanel } from '../components/GlassPanel';
import { VirtualSection } from './VirtualSection';
import { TuningDrawer } from './TuningDrawer';
import { HeroSection } from './sections/HeroSection';
import { InteractiveSection } from './sections/InteractiveSection';
import { NavigationSection } from './sections/NavigationSection';
import { OverlaySection } from './sections/OverlaySection';
import { FormSection } from './sections/FormSection';
import { DeveloperSection } from './sections/DeveloperSection';

export interface ShowcasePageProps {
  backgroundMode: 'image' | 'noise';
  onBackgroundModeChange: (mode: 'image' | 'noise') => void;
}

const NAV_LINKS = [
  { label: 'Controls', id: 'interactive' },
  { label: 'Navigation', id: 'navigation' },
  { label: 'Overlays', id: 'overlays' },
  { label: 'Forms', id: 'forms' },
  { label: 'Get Started', id: 'developer' },
];

const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

function handleNavClick(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Top-level showcase shell with sticky header, content sections, and tuning drawer.
 * Sections demonstrate glass controls in realistic contexts (not component catalogs).
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
          <HeroSection
            backgroundMode={backgroundMode}
            onBackgroundModeChange={onBackgroundModeChange}
          />
        </section>

        {/* Interactive Controls */}
        <VirtualSection id="interactive" minHeight={500}>
          <InteractiveSection />
        </VirtualSection>

        {/* Navigation */}
        <VirtualSection id="navigation" minHeight={600}>
          <NavigationSection />
        </VirtualSection>

        {/* Overlays */}
        <VirtualSection id="overlays" minHeight={400}>
          <OverlaySection />
        </VirtualSection>

        {/* Forms */}
        <VirtualSection id="forms" minHeight={500}>
          <FormSection />
        </VirtualSection>

        {/* Developer Quick Start */}
        <VirtualSection id="developer" minHeight={300}>
          <DeveloperSection />
        </VirtualSection>
      </main>

      {/* Footer */}
      <footer
        style={{
          textAlign: 'center',
          padding: '60px 0',
          color: 'rgba(255, 255, 255, 0.4)',
          fontSize: '0.85rem',
          fontFamily: FONT_STACK,
        }}
      >
        Built with WebGPU
      </footer>

      {/* TuningDrawer -- always mounted */}
      <TuningDrawer open={tuningOpen} onClose={() => setTuningOpen(false)} />
    </div>
  );
}

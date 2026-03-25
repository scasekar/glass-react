import { useState } from 'react';
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

const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

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
      {/* Settings gear — fixed in top-right corner */}
      <button
        onClick={() => setTuningOpen(o => !o)}
        aria-label="Toggle tuning drawer"
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 100,
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 10,
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'rgba(255, 255, 255, 0.7)',
          fontSize: '1.2rem',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        {'\u2699'}
      </button>

      {/* Main content */}
      <main
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0 24px',
          boxSizing: 'border-box',
          overflowX: 'hidden',
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

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 600px) {
          .showcase-nav-links {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

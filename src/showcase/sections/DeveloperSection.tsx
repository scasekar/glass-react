import { useState, useCallback } from 'react';
import { GlassPanel } from '../../components/GlassPanel';
import { GlassButton } from '../../components/GlassButton';
import { APPLE_RADII, APPLE_SPACING } from '../../tokens/apple';

const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const INSTALL_COMMAND = 'npm install liquidglass-react';

const CODE_EXAMPLE = `import { GlassProvider, GlassButton } from 'liquidglass-react';

function App() {
  return (
    <GlassProvider>
      <GlassButton onClick={() => alert('Hello!')}>
        Click Me
      </GlassButton>
    </GlassProvider>
  );
}`;

const codeBlockStyle: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.3)',
  borderRadius: 12,
  padding: APPLE_SPACING.md,
  fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
  fontSize: '0.85rem',
  lineHeight: 1.6,
  color: 'rgba(255, 255, 255, 0.9)',
  overflow: 'auto',
  margin: `${APPLE_SPACING.md}px 0 0`,
  whiteSpace: 'pre',
  position: 'relative' as const,
};

/**
 * Developer quick-start section -- the conversion section that turns evaluators into adopters.
 * Shows npm install command with copy button, minimal code example, browser compat, and GitHub link.
 */
export function DeveloperSection() {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail in non-secure contexts; silently ignore
    }
  }, []);

  return (
    <div
      style={{
        paddingTop: 120,
        paddingBottom: 60,
        fontFamily: FONT_STACK,
      }}
    >
      {/* Section Title */}
      <h2
        style={{
          fontSize: '2rem',
          fontWeight: 700,
          margin: 0,
          textAlign: 'center',
          color: '#fff',
        }}
      >
        Start in 5 Minutes
      </h2>
      <p
        style={{
          fontSize: '1rem',
          color: 'rgba(255, 255, 255, 0.6)',
          margin: `${APPLE_SPACING.sm}px 0 0`,
          textAlign: 'center',
        }}
      >
        One install. One provider. Real GPU glass.
      </p>

      {/* Two side-by-side cards */}
      <div
        style={{
          display: 'flex',
          gap: APPLE_SPACING.xl,
          marginTop: APPLE_SPACING.xxxl,
          flexWrap: 'wrap',
        }}
      >
        {/* Card 1: Install / Quick Start */}
        <GlassPanel
          cornerRadius={APPLE_RADII.lg}
          style={{
            flex: 1,
            minWidth: 300,
            padding: APPLE_SPACING.xxl,
          }}
        >
          <h3
            style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              margin: 0,
              color: '#fff',
            }}
          >
            Quick Start
          </h3>

          <div style={{ position: 'relative' }}>
            <pre style={codeBlockStyle}>
              <code>{INSTALL_COMMAND}</code>
            </pre>

            {/* Copy button */}
            <button
              onClick={handleCopy}
              aria-label={copied ? 'Copied' : 'Copy install command'}
              style={{
                position: 'absolute',
                top: APPLE_SPACING.md + APPLE_SPACING.sm,
                right: APPLE_SPACING.sm,
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 6,
                padding: '4px 10px',
                cursor: 'pointer',
                color: copied ? 'rgba(100, 255, 100, 0.9)' : 'rgba(255, 255, 255, 0.6)',
                fontSize: '0.75rem',
                fontFamily: FONT_STACK,
                transition: 'color 0.2s, background 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              }}
            >
              {copied ? '\u2713 Copied' : 'Copy'}
            </button>
          </div>
        </GlassPanel>

        {/* Card 2: Minimal Example */}
        <GlassPanel
          cornerRadius={APPLE_RADII.lg}
          style={{
            flex: 1,
            minWidth: 300,
            padding: APPLE_SPACING.xxl,
          }}
        >
          <h3
            style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              margin: 0,
              color: '#fff',
            }}
          >
            Minimal Example
          </h3>

          <pre style={codeBlockStyle}>
            <code>{CODE_EXAMPLE}</code>
          </pre>
        </GlassPanel>
      </div>

      {/* Browser compatibility */}
      <p
        style={{
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: '0.9rem',
          marginTop: APPLE_SPACING.xxxl,
        }}
      >
        WebGPU: Chrome 113+, Edge 113+, Safari 18+
      </p>

      {/* GitHub link */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: APPLE_SPACING.lg,
        }}
      >
        <GlassButton
          onClick={() => window.open('https://github.com', '_blank')}
        >
          View on GitHub
        </GlassButton>
      </div>
    </div>
  );
}

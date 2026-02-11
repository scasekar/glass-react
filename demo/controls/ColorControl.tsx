import type { GlassColor } from '../../src/components/types';

interface ColorControlProps {
  label: string;
  value: GlassColor;
  onChange: (value: GlassColor) => void;
}

export function ColorControl({ label, value, onChange }: ColorControlProps) {
  const [r, g, b] = value;

  const previewColor = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;

  const channelStyle: React.CSSProperties = {
    width: '100%',
    height: 4,
    appearance: 'none',
    background: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 2,
    outline: 'none',
    cursor: 'pointer',
    accentColor: '#6cb4ee',
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
      }}>
        <label style={{
          fontSize: '0.8rem',
          color: 'rgba(255, 255, 255, 0.7)',
          userSelect: 'none',
        }}>
          {label}
        </label>
        <div style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          border: '1px solid rgba(255, 255, 255, 0.2)',
          backgroundColor: previewColor,
          flexShrink: 0,
        }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: '0.7rem', color: '#f66', width: 12 }}>R</span>
        <input
          type="range" min={0} max={1} step={0.01} value={r}
          onChange={(e) => onChange([parseFloat(e.target.value), g, b])}
          style={channelStyle}
        />
        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', width: 28, textAlign: 'right' }}>
          {r.toFixed(2)}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: '0.7rem', color: '#6f6', width: 12 }}>G</span>
        <input
          type="range" min={0} max={1} step={0.01} value={g}
          onChange={(e) => onChange([r, parseFloat(e.target.value), b])}
          style={channelStyle}
        />
        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', width: 28, textAlign: 'right' }}>
          {g.toFixed(2)}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: '0.7rem', color: '#66f', width: 12 }}>B</span>
        <input
          type="range" min={0} max={1} step={0.01} value={b}
          onChange={(e) => onChange([r, g, parseFloat(e.target.value)])}
          style={channelStyle}
        />
        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', width: 28, textAlign: 'right' }}>
          {b.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

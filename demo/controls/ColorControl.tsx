import type { GlassColor } from '../../src/components/types';
import { tokens } from './tokens';

interface ColorControlProps {
  label: string;
  value: GlassColor;
  onChange: (value: GlassColor) => void;
}

const channels = [
  { key: 'R', color: '#f66', index: 0 },
  { key: 'G', color: '#6f6', index: 1 },
  { key: 'B', color: '#66f', index: 2 },
] as const;

export function ColorControl({ label, value, onChange }: ColorControlProps) {
  const [r, g, b] = value;
  const previewColor = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;

  const handleChannel = (index: number, newVal: number) => {
    const next: GlassColor = [value[0], value[1], value[2]];
    next[index] = newVal;
    onChange(next);
  };

  return (
    <div style={{ marginBottom: tokens.space.controlGap }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
      }}>
        <label style={{
          fontSize: tokens.font.label,
          color: tokens.color.labelPrimary,
          userSelect: 'none',
        }}>
          {label}
        </label>
        <div style={{
          width: 18,
          height: 18,
          borderRadius: tokens.radius.control,
          border: `1px solid ${tokens.color.presetChipBorder}`,
          backgroundColor: previewColor,
          flexShrink: 0,
        }} />
      </div>

      {channels.map((ch, i) => {
        const channelValue = value[ch.index];
        const pct = channelValue * 100;
        return (
          <div key={ch.key} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: i < 2 ? 4 : 0,
          }}>
            <span style={{ fontSize: '0.7rem', color: ch.color, width: 12 }}>
              {ch.key}
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={channelValue}
              onChange={(e) => handleChannel(ch.index, parseFloat(e.target.value))}
              style={{ '--pct': `${pct}%`, width: '100%' } as React.CSSProperties}
            />
            <span style={{
              fontSize: tokens.font.value,
              color: tokens.color.valueText,
              fontFamily: 'monospace',
              width: 28,
              textAlign: 'right',
            }}>
              {channelValue.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

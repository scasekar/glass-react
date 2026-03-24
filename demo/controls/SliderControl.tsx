import { tokens } from './tokens';

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

function formatValue(value: number, step: number, max: number): string {
  if (step >= 1) return value.toFixed(0);
  if (max <= 1) return value.toFixed(2);
  return value.toFixed(1);
}

export function SliderControl({ label, value, min, max, step, onChange }: SliderControlProps) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div style={{ marginBottom: tokens.space.controlGap }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
      }}>
        <label style={{
          fontSize: tokens.font.label,
          color: tokens.color.labelPrimary,
          userSelect: 'none',
        }}>
          {label}
        </label>
        <span style={{
          fontSize: tokens.font.value,
          color: tokens.color.valueText,
          fontFamily: 'monospace',
          minWidth: 38,
          textAlign: 'right',
        }}>
          {formatValue(value, step, max)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ '--pct': `${pct}%`, width: '100%' } as React.CSSProperties}
      />
    </div>
  );
}

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

export function SliderControl({ label, value, min, max, step, onChange }: SliderControlProps) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
      }}>
        <label style={{
          fontSize: '0.8rem',
          color: 'rgba(255, 255, 255, 0.7)',
          userSelect: 'none',
        }}>
          {label}
        </label>
        <span style={{
          fontSize: '0.75rem',
          color: 'rgba(255, 255, 255, 0.5)',
          fontFamily: 'monospace',
          minWidth: 40,
          textAlign: 'right',
        }}>
          {value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          width: '100%',
          height: 4,
          appearance: 'none',
          background: 'rgba(255, 255, 255, 0.15)',
          borderRadius: 2,
          outline: 'none',
          cursor: 'pointer',
          accentColor: '#6cb4ee',
        }}
      />
    </div>
  );
}

import { tokens } from './tokens';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectControlProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}

export function SelectControl({ label, value, options, onChange }: SelectControlProps) {
  return (
    <div style={{ marginBottom: tokens.space.controlGap }}>
      <label style={{
        display: 'block',
        fontSize: tokens.font.label,
        color: tokens.color.labelPrimary,
        marginBottom: 4,
        userSelect: 'none',
      }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '6px 28px 6px 8px',
          fontSize: tokens.font.label,
          background: tokens.color.presetChipBg,
          color: tokens.color.labelPrimary,
          border: `1px solid ${tokens.color.presetChipBorder}`,
          borderRadius: tokens.radius.control,
          outline: 'none',
          cursor: 'pointer',
          appearance: 'none',
          WebkitAppearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 5l3 3 3-3' fill='none' stroke='%23999' stroke-width='1.5'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 8px center',
          transition: tokens.transition.fast,
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} style={{ background: '#222', color: '#eee' }}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

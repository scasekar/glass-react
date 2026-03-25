import { useState, useId } from 'react';
import { GlassPanel } from '../GlassPanel';
import { APPLE_RADII, APPLE_SPACING, APPLE_CONTROL_SIZES } from '../../tokens/apple';
import type { GlassInputProps } from '../types';

/**
 * A glass-bordered text input with focus-driven glass intensity changes.
 *
 * Wraps a native `<input>` inside a GlassPanel. On focus, the glass
 * specular and rim values increase and a visible CSS outline focus ring
 * appears (WCAG SC 1.4.11 compliant).
 *
 * The native input has transparent background and inherits color/font
 * from the GlassPanel's text styles. GlassPanel dimensions do NOT
 * change on focus to avoid mask lag.
 *
 * @example
 * ```tsx
 * <GlassInput label="Email" value={email} onChange={setEmail} placeholder="you@example.com" />
 * ```
 */
export function GlassInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  id,
  disabled,
  className,
  style,
}: GlassInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [focused, setFocused] = useState(false);

  // Glass parameter shift on focus -- flows through useGlassRegion sync effect
  const glassSpecular = focused ? 0.22 : undefined;
  const glassRim = focused ? 0.28 : undefined;

  return (
    <div className={className} style={style}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            display: 'block',
            marginBottom: APPLE_SPACING.xs,
            fontSize: 14,
          }}
        >
          {label}
        </label>
      )}
      <GlassPanel
        cornerRadius={APPLE_RADII.md}
        opacity={0.2}
        specular={glassSpecular}
        rim={glassRim}
        style={{
          display: 'flex',
          alignItems: 'center',
          minHeight: APPLE_CONTROL_SIZES.minTapTarget,
          padding: `${APPLE_SPACING.sm}px ${APPLE_SPACING.md}px`,
          border: focused
            ? '1px solid rgba(255,255,255,0.4)'
            : '1px solid rgba(255,255,255,0.15)',
          // Visible focus ring via CSS -- required for WCAG SC 1.4.11
          outline: focused
            ? '2px solid rgba(255,255,255,0.65)'
            : '2px solid transparent',
          outlineOffset: 2,
          transition: 'outline-color 0.15s, border-color 0.15s',
        }}
      >
        <input
          id={inputId}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            width: '100%',
            color: 'inherit',
            font: 'inherit',
            fontSize: 16,
            padding: 0,
          }}
        />
      </GlassPanel>
    </div>
  );
}

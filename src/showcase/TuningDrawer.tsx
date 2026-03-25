import { useState } from 'react';

export interface TuningDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface SliderParam {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

const PARAMS: SliderParam[] = [
  { key: 'blurIntensity', label: 'Blur Intensity', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
  { key: 'specularIntensity', label: 'Specular Intensity', min: 0, max: 2, step: 0.01, defaultValue: 0.8 },
  { key: 'rimIntensity', label: 'Rim Intensity', min: 0, max: 2, step: 0.01, defaultValue: 0.6 },
  { key: 'refractionStrength', label: 'Refraction Strength', min: 0, max: 0.3, step: 0.005, defaultValue: 0.08 },
  { key: 'aberration', label: 'Aberration', min: 0, max: 3, step: 0.05, defaultValue: 1.0 },
  { key: 'blurRadius', label: 'Blur Radius', min: 0, max: 20, step: 0.5, defaultValue: 9 },
];

/**
 * Always-mounted slide-in panel with glass parameter sliders.
 * Visibility controlled via CSS transform -- preserves slider state across open/close.
 * NOTE: Sliders maintain local state only; they do not wire to GlassRenderer globals.
 */
export function TuningDrawer({ open, onClose }: TuningDrawerProps) {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const p of PARAMS) {
      init[p.key] = p.defaultValue;
    }
    return init;
  });

  const updateValue = (key: string, value: number) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 380,
        zIndex: 200,
        transform: open ? 'translateX(0%)' : 'translateX(100%)',
        transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        overflowY: 'auto',
        background: 'rgba(20, 20, 22, 0.92)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        color: 'rgba(255, 255, 255, 0.9)',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: '24px 20px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Tuning</h2>
        <button
          onClick={onClose}
          aria-label="Close tuning drawer"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: 8,
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '1.1rem',
          }}
        >
          {'\u2715'}
        </button>
      </div>

      {/* Parameter sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {PARAMS.map(param => (
          <div key={param.key}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
                fontSize: '0.85rem',
              }}
            >
              <span>{param.label}</span>
              <span style={{ opacity: 0.6, fontVariantNumeric: 'tabular-nums' }}>
                {values[param.key].toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={param.min}
              max={param.max}
              step={param.step}
              value={values[param.key]}
              onChange={e => updateValue(param.key, parseFloat(e.target.value))}
              aria-label={param.label}
              style={{
                width: '100%',
                accentColor: 'rgba(100, 160, 255, 0.8)',
              }}
            />
          </div>
        ))}
      </div>

      {/* Reduced motion media query -- disable transition */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          [style*="translateX"] {
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}

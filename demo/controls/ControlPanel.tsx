import { useState, useEffect } from 'react';
import { SliderControl } from './SliderControl';
import { ColorControl } from './ColorControl';
import { SelectControl } from './SelectControl';
import {
  DEFAULTS,
  PRESETS,
  SECTION_KEYS,
  exportParams,
  importParams,
} from './presets';

// Re-export GlassParams for backward compatibility with App.tsx
export type { GlassParams } from './presets';

import type { GlassParams } from './presets';

interface ControlPanelProps {
  params: GlassParams;
  onChange: (params: GlassParams) => void;
}

function Section({ title, onReset, children }: {
  title: string;
  onReset: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.7rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'rgba(255, 255, 255, 0.4)',
        marginBottom: 8,
        paddingBottom: 4,
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      }}>
        <span>{title}</span>
        <button
          onClick={onReset}
          style={{
            fontSize: '0.65rem',
            color: 'rgba(255, 255, 255, 0.35)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 6px',
          }}
        >
          Reset
        </button>
      </div>
      {children}
    </div>
  );
}

const toolbarButtonStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  background: 'rgba(255, 255, 255, 0.08)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: 4,
  padding: '4px 10px',
  color: 'rgba(255, 255, 255, 0.7)',
  cursor: 'pointer',
};

export function ControlPanel({ params, onChange }: ControlPanelProps) {
  const [open, setOpen] = useState(true);
  const [importError, setImportError] = useState<string | null>(null);

  // Auto-clear import error after 3 seconds
  useEffect(() => {
    if (importError === null) return;
    const timer = setTimeout(() => setImportError(null), 3000);
    return () => clearTimeout(timer);
  }, [importError]);

  const update = <K extends keyof GlassParams>(key: K, value: GlassParams[K]) => {
    onChange({ ...params, [key]: value });
  };

  const resetSection = (section: string) => {
    const keys = SECTION_KEYS[section];
    if (!keys) return;
    onChange({ ...params, ...Object.fromEntries(keys.map(k => [k, DEFAULTS[k]])) });
  };

  return (
    <>
      {/* Toggle button -- always visible */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed',
          top: 16,
          right: open ? 296 : 16,
          zIndex: 1001,
          width: 36,
          height: 36,
          borderRadius: 8,
          border: '1px solid rgba(255, 255, 255, 0.15)',
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          color: '#eee',
          fontSize: '1.1rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'right 0.25s ease',
        }}
        title={open ? 'Hide controls' : 'Show controls'}
      >
        {open ? '\u00BB' : '\u00AB'}
      </button>

      {/* Panel */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: 280,
        height: '100vh',
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(12px)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
        overflowY: 'auto',
        padding: '16px 14px',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s ease',
      }}>
        {/* Header */}
        <div style={{
          fontSize: '0.85rem',
          fontWeight: 600,
          color: 'rgba(255, 255, 255, 0.9)',
          marginBottom: 12,
          paddingBottom: 8,
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          Glass Parameters
        </div>

        {/* Toolbar: Presets */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {Object.keys(PRESETS).map((name) => (
            <button
              key={name}
              onClick={() => onChange(PRESETS[name])}
              style={toolbarButtonStyle}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Toolbar: Reset All, Import, Export */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
          <button
            onClick={() => onChange(DEFAULTS)}
            style={toolbarButtonStyle}
          >
            Reset All
          </button>
          <button
            onClick={() => importParams(onChange, (msg) => setImportError(msg))}
            style={toolbarButtonStyle}
          >
            Import JSON
          </button>
          <button
            onClick={() => exportParams(params)}
            style={toolbarButtonStyle}
          >
            Export JSON
          </button>
        </div>

        {/* Import error message */}
        {importError && (
          <div style={{
            fontSize: '0.7rem',
            color: '#f66',
            marginBottom: 4,
            padding: '2px 0',
          }}>
            {importError}
          </div>
        )}

        {/* Divider between toolbar and sections */}
        <div style={{
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          marginBottom: 12,
          marginTop: 8,
        }} />

        {/* Blur & Opacity */}
        <Section title="Blur & Opacity" onReset={() => resetSection('Blur & Opacity')}>
          <SliderControl
            label="Blur"
            value={params.blur}
            min={0} max={1} step={0.01}
            onChange={(v) => update('blur', v)}
          />
          <SliderControl
            label="Opacity"
            value={params.opacity}
            min={0} max={1} step={0.01}
            onChange={(v) => update('opacity', v)}
          />
          <SliderControl
            label="Blur Radius (px)"
            value={params.blurRadius}
            min={0} max={50} step={1}
            onChange={(v) => update('blurRadius', v)}
          />
        </Section>

        {/* Geometry */}
        <Section title="Geometry" onReset={() => resetSection('Geometry')}>
          <SliderControl
            label="Corner Radius"
            value={params.cornerRadius}
            min={0} max={50} step={1}
            onChange={(v) => update('cornerRadius', v)}
          />
        </Section>

        {/* Refraction */}
        <Section title="Refraction" onReset={() => resetSection('Refraction')}>
          <SelectControl
            label="Refraction Mode"
            value={params.refractionMode}
            options={[
              { value: 'standard', label: 'Standard' },
              { value: 'prominent', label: 'Prominent' },
            ]}
            onChange={(v) => update('refractionMode', v as 'standard' | 'prominent')}
          />
          <SliderControl
            label="Refraction Strength"
            value={params.refraction}
            min={0} max={0.3} step={0.01}
            onChange={(v) => update('refraction', v)}
          />
          <SliderControl
            label="Aberration"
            value={params.aberration}
            min={0} max={10} step={0.5}
            onChange={(v) => update('aberration', v)}
          />
        </Section>

        {/* Lighting */}
        <Section title="Lighting" onReset={() => resetSection('Lighting')}>
          <SliderControl
            label="Specular"
            value={params.specular}
            min={0} max={1} step={0.01}
            onChange={(v) => update('specular', v)}
          />
          <SliderControl
            label="Rim"
            value={params.rim}
            min={0} max={1} step={0.01}
            onChange={(v) => update('rim', v)}
          />
          <SliderControl
            label="Fresnel IOR"
            value={params.fresnelIOR}
            min={1.0} max={3.0} step={0.1}
            onChange={(v) => update('fresnelIOR', v)}
          />
          <SliderControl
            label="Fresnel Exponent"
            value={params.fresnelExponent}
            min={0.5} max={10} step={0.5}
            onChange={(v) => update('fresnelExponent', v)}
          />
          <SliderControl
            label="Env Reflection"
            value={params.envReflectionStrength}
            min={0} max={1} step={0.01}
            onChange={(v) => update('envReflectionStrength', v)}
          />
          <SliderControl
            label="Glare Direction (deg)"
            value={params.glareDirection}
            min={0} max={360} step={1}
            onChange={(v) => update('glareDirection', v)}
          />
        </Section>

        {/* Color Adjustment */}
        <Section title="Color Adjustment" onReset={() => resetSection('Color Adjustment')}>
          <ColorControl
            label="Tint"
            value={params.tint}
            onChange={(v) => update('tint', v)}
          />
          <SliderControl
            label="Contrast"
            value={params.contrast}
            min={0} max={2} step={0.01}
            onChange={(v) => update('contrast', v)}
          />
          <SliderControl
            label="Saturation"
            value={params.saturation}
            min={0} max={3} step={0.01}
            onChange={(v) => update('saturation', v)}
          />
        </Section>

        {/* Animation */}
        <Section title="Animation" onReset={() => resetSection('Animation')}>
          <SliderControl
            label="Morph Speed"
            value={params.morphSpeed}
            min={0} max={20} step={1}
            onChange={(v) => update('morphSpeed', v)}
          />
        </Section>
      </div>
    </>
  );
}

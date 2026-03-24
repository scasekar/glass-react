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
import { tokens } from './tokens';

interface ControlPanelProps {
  params: GlassParams;
  onChange: (params: GlassParams) => void;
}

function SectionAccordion({ title, defaultOpen, onReset, children }: {
  title: string;
  defaultOpen?: boolean;
  onReset: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);

  return (
    <div style={{ marginBottom: tokens.space.sectionGap }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          padding: '3px 0 5px',
          borderBottom: '1px solid ' + tokens.color.sectionBorder,
          background: 'none',
          border: 'none',
        }}
      >
        <span style={{
          fontSize: tokens.font.sectionTitle,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: tokens.color.sectionTitle,
        }}>
          {title}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onReset(); }}
            style={{
              fontSize: '0.65rem',
              color: tokens.color.labelMuted,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 6px',
            }}
          >
            Reset
          </button>
          <span style={{
            color: tokens.color.labelMuted,
            fontSize: '0.7rem',
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.15s ease',
            display: 'inline-block',
          }}>
            {'\u25BE'}
          </span>
        </span>
      </div>
      {open && <div style={{ paddingTop: 8 }}>{children}</div>}
    </div>
  );
}

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

  // Detect which preset (if any) matches current params
  const activePreset = Object.entries(PRESETS).find(
    ([, p]) => Object.keys(p).every(k => p[k as keyof GlassParams] === params[k as keyof GlassParams])
  )?.[0] ?? null;

  const actionButtonStyle: React.CSSProperties = {
    fontSize: '0.72rem',
    background: tokens.color.presetChipBg,
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: tokens.radius.control,
    padding: '4px 10px',
    color: tokens.color.labelMuted,
    cursor: 'pointer',
    transition: tokens.transition.fast,
  };

  return (
    <>
      {/* Toggle button -- always visible */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed',
          top: 16,
          right: open ? 316 : 16,
          zIndex: 1001,
          width: 36,
          height: 36,
          borderRadius: 8,
          border: '1px solid ' + tokens.color.panelBorder,
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
      <div data-testid="control-panel" style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: 300,
        height: '100vh',
        zIndex: 1000,
        background: tokens.color.panelBg,
        backdropFilter: 'blur(12px)',
        borderLeft: '1px solid ' + tokens.color.panelBorder,
        overflowY: 'auto',
        padding: tokens.space.panelPad,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: tokens.transition.panel,
      }}>
        {/* Header */}
        <div style={{
          fontSize: tokens.font.header,
          fontWeight: 600,
          color: tokens.color.labelPrimary,
          paddingBottom: 8,
          marginBottom: 10,
          borderBottom: '1px solid ' + tokens.color.panelBorder,
        }}>
          Glass Parameters
        </div>

        {/* Preset chips */}
        <div style={{ display: 'flex', gap: tokens.space.chipGap, flexWrap: 'wrap', marginBottom: 10 }}>
          {Object.keys(PRESETS).map((name) => {
            const isActive = activePreset === name;
            return (
              <button
                key={name}
                onClick={() => onChange(PRESETS[name])}
                style={{
                  fontSize: tokens.font.chip,
                  padding: '4px 10px',
                  borderRadius: tokens.radius.chip,
                  background: isActive ? tokens.color.presetChipBgActive : tokens.color.presetChipBg,
                  border: '1px solid ' + (isActive ? tokens.color.presetChipBorderActive : tokens.color.presetChipBorder),
                  color: isActive ? tokens.color.accentBlue : tokens.color.labelPrimary,
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  transition: tokens.transition.fast,
                }}
              >
                {name}
              </button>
            );
          })}
        </div>

        {/* Action toolbar: Reset All, Import JSON, Export JSON, Copy URL */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <button
            onClick={() => onChange(DEFAULTS)}
            style={actionButtonStyle}
          >
            Reset All
          </button>
          <button
            onClick={() => importParams(onChange, (msg) => setImportError(msg))}
            style={actionButtonStyle}
          >
            Import JSON
          </button>
          <button
            onClick={() => exportParams(params)}
            style={actionButtonStyle}
          >
            Export JSON
          </button>
          <button
            onClick={() => navigator.clipboard.writeText(window.location.href).catch(() => {})}
            style={actionButtonStyle}
          >
            Copy URL
          </button>
        </div>

        {/* Import error message */}
        {importError && (
          <div style={{
            fontSize: '0.7rem',
            color: tokens.color.errorText,
            marginBottom: 4,
            padding: '2px 0',
          }}>
            {importError}
          </div>
        )}

        {/* Divider between toolbar and sections */}
        <div style={{
          borderBottom: '1px solid ' + tokens.color.sectionBorder,
          marginBottom: 12,
          marginTop: 4,
        }} />

        {/* Blur & Opacity */}
        <SectionAccordion title="Blur & Opacity" defaultOpen={true} onReset={() => resetSection('Blur & Opacity')}>
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
        </SectionAccordion>

        {/* Geometry */}
        <SectionAccordion title="Geometry" defaultOpen={false} onReset={() => resetSection('Geometry')}>
          <SliderControl
            label="Corner Radius"
            value={params.cornerRadius}
            min={0} max={50} step={1}
            onChange={(v) => update('cornerRadius', v)}
          />
        </SectionAccordion>

        {/* Refraction */}
        <SectionAccordion title="Refraction" defaultOpen={true} onReset={() => resetSection('Refraction')}>
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
        </SectionAccordion>

        {/* Lighting */}
        <SectionAccordion title="Lighting" defaultOpen={true} onReset={() => resetSection('Lighting')}>
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
        </SectionAccordion>

        {/* Color Adjustment */}
        <SectionAccordion title="Color Adjustment" defaultOpen={true} onReset={() => resetSection('Color Adjustment')}>
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
        </SectionAccordion>

        {/* Animation */}
        <SectionAccordion title="Animation" defaultOpen={false} onReset={() => resetSection('Animation')}>
          <SliderControl
            label="Morph Speed"
            value={params.morphSpeed}
            min={0} max={20} step={1}
            onChange={(v) => update('morphSpeed', v)}
          />
        </SectionAccordion>
      </div>
    </>
  );
}

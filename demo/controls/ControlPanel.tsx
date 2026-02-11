import { useState } from 'react';
import { SliderControl } from './SliderControl';
import { ColorControl } from './ColorControl';
import { SelectControl } from './SelectControl';
import type { GlassColor } from '../../src/components/types';

export interface GlassParams {
  blur: number;
  opacity: number;
  cornerRadius: number;
  aberration: number;
  specular: number;
  rim: number;
  tint: GlassColor;
  refractionMode: 'standard' | 'prominent';
  morphSpeed: number;
}

interface ControlPanelProps {
  params: GlassParams;
  onChange: (params: GlassParams) => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: '0.7rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'rgba(255, 255, 255, 0.4)',
        marginBottom: 8,
        paddingBottom: 4,
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export function ControlPanel({ params, onChange }: ControlPanelProps) {
  const [open, setOpen] = useState(true);

  const update = <K extends keyof GlassParams>(key: K, value: GlassParams[K]) => {
    onChange({ ...params, [key]: value });
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
        <div style={{
          fontSize: '0.85rem',
          fontWeight: 600,
          color: 'rgba(255, 255, 255, 0.9)',
          marginBottom: 16,
          paddingBottom: 8,
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          Glass Parameters
        </div>

        <Section title="Blur & Opacity">
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
        </Section>

        <Section title="Geometry">
          <SliderControl
            label="Corner Radius"
            value={params.cornerRadius}
            min={0} max={50} step={1}
            onChange={(v) => update('cornerRadius', v)}
          />
        </Section>

        <Section title="Refraction">
          <SelectControl
            label="Refraction Mode"
            value={params.refractionMode}
            options={[
              { value: 'standard', label: 'Standard' },
              { value: 'prominent', label: 'Prominent' },
            ]}
            onChange={(v) => update('refractionMode', v as 'standard' | 'prominent')}
          />
        </Section>

        <Section title="Visual Effects">
          <SliderControl
            label="Aberration"
            value={params.aberration}
            min={0} max={10} step={0.5}
            onChange={(v) => update('aberration', v)}
          />
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
        </Section>

        <Section title="Color">
          <ColorControl
            label="Tint"
            value={params.tint}
            onChange={(v) => update('tint', v)}
          />
        </Section>

        <Section title="Animation">
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

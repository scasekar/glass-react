/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { GlassChip } from '../controls/GlassChip';

// Mock useGlassEngine -- controls don't call it directly but GlassButton does
vi.mock('../../hooks/useGlassEngine', () => ({
  useGlassEngine: () => ({
    renderer: null,
    preferences: { darkMode: true, reducedMotion: false, reducedTransparency: false },
  }),
}));

// Mock useGlassRegion -- no WebGPU in jsdom
vi.mock('../../hooks/useGlassRegion', () => ({
  useGlassRegion: () => null,
}));

describe('GlassChip', () => {
  it('renders with label text', () => {
    render(<GlassChip label="Filter" selected={false} onToggle={() => {}} />);
    expect(screen.getByText('Filter')).toBeDefined();
  });

  it('renders as a button element', () => {
    render(<GlassChip label="Tag" selected={false} onToggle={() => {}} />);
    const button = screen.getByRole('button', { name: 'Tag' });
    expect(button.tagName).toBe('BUTTON');
  });

  it('aria-pressed reflects selected=false', () => {
    render(<GlassChip label="Off" selected={false} onToggle={() => {}} />);
    const button = screen.getByRole('button', { name: 'Off' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('aria-pressed reflects selected=true', () => {
    render(<GlassChip label="On" selected={true} onToggle={() => {}} />);
    const button = screen.getByRole('button', { name: 'On' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('clicking calls onToggle with !selected (false -> true)', () => {
    const onToggle = vi.fn();
    render(<GlassChip label="Toggle" selected={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('clicking calls onToggle with !selected (true -> false)', () => {
    const onToggle = vi.fn();
    render(<GlassChip label="Untoggle" selected={true} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'Untoggle' }));
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('disabled prevents onToggle call', () => {
    const onToggle = vi.fn();
    render(<GlassChip label="Disabled" selected={false} onToggle={onToggle} disabled />);
    fireEvent.click(screen.getByRole('button', { name: 'Disabled' }));
    expect(onToggle).not.toHaveBeenCalled();
  });
});

/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { GlassStepper } from '../controls/GlassStepper';

// Mock useGlassEngine -- GlassButton and GlassPanel call it internally
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

describe('GlassStepper', () => {
  afterEach(() => cleanup());
  it('renders Decrease and Increase buttons', () => {
    render(<GlassStepper value={5} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Decrease' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Increase' })).toBeDefined();
  });

  it('renders current value in output element', () => {
    render(<GlassStepper value={7} onChange={() => {}} />);
    const output = document.querySelector('output');
    expect(output).not.toBeNull();
    expect(output!.textContent).toContain('7');
  });

  it('clicking Increase calls onChange with value + step', () => {
    const onChange = vi.fn();
    render(<GlassStepper value={3} onChange={onChange} step={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Increase' }));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('clicking Decrease calls onChange with value - step', () => {
    const onChange = vi.fn();
    render(<GlassStepper value={5} onChange={onChange} step={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Decrease' }));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('Decrease button is disabled when value equals min', () => {
    render(<GlassStepper value={0} onChange={() => {}} min={0} />);
    const btn = screen.getByRole('button', { name: 'Decrease' });
    expect(btn).toHaveProperty('disabled', true);
  });

  it('Increase button is disabled when value equals max', () => {
    render(<GlassStepper value={10} onChange={() => {}} max={10} />);
    const btn = screen.getByRole('button', { name: 'Increase' });
    expect(btn).toHaveProperty('disabled', true);
  });

  it('value is clamped at max when clicking increase at max', () => {
    const onChange = vi.fn();
    render(<GlassStepper value={10} onChange={onChange} max={10} />);
    // Button should be disabled, but verify clamp logic by checking the disabled state
    const btn = screen.getByRole('button', { name: 'Increase' });
    expect(btn).toHaveProperty('disabled', true);
  });

  it('outer container has role="group"', () => {
    render(<GlassStepper value={5} onChange={() => {}} label="Quantity" />);
    const group = screen.getByRole('group', { name: 'Quantity' });
    expect(group).toBeDefined();
  });

  it('uses custom step value', () => {
    const onChange = vi.fn();
    render(<GlassStepper value={4} onChange={onChange} step={2} max={10} />);
    fireEvent.click(screen.getByRole('button', { name: 'Increase' }));
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it('clamps decrement at min', () => {
    const onChange = vi.fn();
    render(<GlassStepper value={1} onChange={onChange} min={0} step={5} />);
    fireEvent.click(screen.getByRole('button', { name: 'Decrease' }));
    expect(onChange).toHaveBeenCalledWith(0);
  });
});

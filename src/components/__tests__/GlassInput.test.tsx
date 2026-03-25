/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup, within } from '@testing-library/react';
import { GlassInput } from '../controls/GlassInput';

// Mock useGlassEngine -- returns default preferences
vi.mock('../../hooks/useGlassEngine', () => ({
  useGlassEngine: () => ({
    preferences: { reducedMotion: false, reducedTransparency: false, darkMode: true },
    engineRef: { current: null },
    isReady: false,
  }),
}));

// Mock useGlassRegion -- no-op in jsdom (no WebGPU)
vi.mock('../../hooks/useGlassRegion', () => ({
  useGlassRegion: () => null,
}));

afterEach(cleanup);

describe('GlassInput', () => {
  it('renders an input element', () => {
    const { container } = render(<GlassInput value="" onChange={() => {}} />);
    const input = container.querySelector('input');
    expect(input).not.toBeNull();
    expect(input!.tagName).toBe('INPUT');
  });

  it('renders label associated with input via htmlFor when label prop provided', () => {
    const { container } = render(<GlassInput value="" onChange={() => {}} label="Email" id="email-input" />);
    const label = container.querySelector('label');
    expect(label).not.toBeNull();
    expect(label!.tagName).toBe('LABEL');
    expect(label!.getAttribute('for')).toBe('email-input');
    const input = container.querySelector('input');
    expect(input!.id).toBe('email-input');
  });

  it('onChange called with new value when typing', () => {
    const handleChange = vi.fn();
    const { container } = render(<GlassInput value="" onChange={handleChange} />);
    const input = container.querySelector('input')!;
    fireEvent.change(input, { target: { value: 'hello' } });
    expect(handleChange).toHaveBeenCalledWith('hello');
  });

  it('GlassPanel shows visible CSS outline focus ring on focus', () => {
    const { container } = render(<GlassInput value="" onChange={() => {}} />);
    const input = container.querySelector('input')!;
    const glassPanel = container.querySelector('[data-testid="glass-panel"]') as HTMLElement;

    // Before focus: outline should be transparent
    expect(glassPanel.style.outline).toContain('transparent');

    // Focus the input
    fireEvent.focus(input);

    // After focus: outline should show visible focus ring
    expect(glassPanel.style.outline).toContain('rgba(255,255,255,0.65)');
  });

  it('native input has background transparent and no border in style', () => {
    const { container } = render(<GlassInput value="" onChange={() => {}} />);
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.style.background).toBe('transparent');
    // jsdom serializes `border: 'none'` as `border-style: none` (border shorthand becomes 'medium')
    expect(input.style.borderStyle).toBe('none');
  });

  it('disabled prop disables the input', () => {
    const { container } = render(<GlassInput value="" onChange={() => {}} disabled />);
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it('placeholder prop renders on the input', () => {
    const { container } = render(<GlassInput value="" onChange={() => {}} placeholder="Type here..." />);
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.placeholder).toBe('Type here...');
  });

  it('does not render label when label prop is not provided', () => {
    const { container } = render(<GlassInput value="" onChange={() => {}} />);
    const labels = container.querySelectorAll('label');
    expect(labels.length).toBe(0);
  });
});

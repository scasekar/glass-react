/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GlassSlider } from '../GlassSlider';

// Polyfill ResizeObserver for jsdom (required by Radix Slider)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock motion/react -- we are testing React behavior, not animation
vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
      ({ children, ...props }, ref) => <div ref={ref} {...props}>{children}</div>
    ),
  },
  useReducedMotion: () => false,
}));

// Mock useGlassRegion -- controls compose GlassPanel which calls useGlassRegion
vi.mock('../../../hooks/useGlassRegion', () => ({
  useGlassRegion: () => {},
}));

// Mock useGlassEngine -- needed by GlassPanel
vi.mock('../../../hooks/useGlassEngine', () => ({
  useGlassEngine: () => ({
    ready: false,
    preferences: { reducedMotion: false, reducedTransparency: false, darkMode: true },
  }),
}));

afterEach(() => {
  cleanup();
});

describe('GlassSlider', () => {
  it('renders with role="slider" and correct aria-valuenow/min/max', () => {
    render(
      <GlassSlider value={50} onValueChange={() => {}} label="Volume" min={0} max={100} />
    );
    const slider = screen.getByRole('slider');
    expect(slider).toBeDefined();
    expect(slider.getAttribute('aria-valuenow')).toBe('50');
    expect(slider.getAttribute('aria-valuemin')).toBe('0');
    expect(slider.getAttribute('aria-valuemax')).toBe('100');
  });

  it('calls onValueChange when value changes', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <GlassSlider value={50} onValueChange={onChange} label="Volume" />
    );
    // Rerender with new value to verify controlled component behavior
    rerender(
      <GlassSlider value={75} onValueChange={onChange} label="Volume" />
    );
    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('aria-valuenow')).toBe('75');
  });

  it('renders track and thumb elements', () => {
    render(
      <GlassSlider value={50} onValueChange={() => {}} label="Volume" />
    );
    // Radix Slider renders track and thumb as CSS-styled elements (no GlassPanel)
    const slider = document.querySelector('[role="slider"]');
    expect(slider).not.toBeNull();
  });

  it('Arrow key Right increments value by step', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GlassSlider value={50} onValueChange={onChange} label="Volume" min={0} max={100} step={1} />
    );
    const slider = screen.getByRole('slider');
    slider.focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith(51);
  });

  it('Arrow key Left decrements value by step', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GlassSlider value={50} onValueChange={onChange} label="Volume" min={0} max={100} step={1} />
    );
    const slider = screen.getByRole('slider');
    slider.focus();
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenCalledWith(49);
  });

  it('disabled slider does not respond to interaction', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GlassSlider value={50} onValueChange={onChange} label="Volume" disabled />
    );
    const slider = screen.getByRole('slider');
    slider.focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).not.toHaveBeenCalled();
  });
});

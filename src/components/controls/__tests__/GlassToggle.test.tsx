/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GlassToggle } from '../GlassToggle';

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

describe('GlassToggle', () => {
  it('renders with correct dimensions (51px wide, 31px tall track)', () => {
    render(
      <GlassToggle checked={false} onCheckedChange={() => {}} label="Test toggle" />
    );
    const switchEl = screen.getByRole('switch');
    expect(switchEl).toBeDefined();
    // The track should be rendered with Apple dimensions
    const track = switchEl.querySelector('[data-testid="glass-panel"]');
    expect(track).toBeDefined();
    if (track) {
      const style = (track as HTMLElement).style;
      expect(style.width).toBe('51px');
      expect(style.height).toBe('31px');
    }
  });

  it('clicking toggle calls onCheckedChange with opposite boolean', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GlassToggle checked={false} onCheckedChange={onChange} label="Test toggle" />
    );
    const switchEl = screen.getByRole('switch');
    await user.click(switchEl);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('renders with role="switch" and correct aria-checked', () => {
    const { rerender } = render(
      <GlassToggle checked={false} onCheckedChange={() => {}} label="Test toggle" />
    );
    const switchEl = screen.getByRole('switch');
    expect(switchEl.getAttribute('aria-checked')).toBe('false');

    rerender(
      <GlassToggle checked={true} onCheckedChange={() => {}} label="Test toggle" />
    );
    expect(switchEl.getAttribute('aria-checked')).toBe('true');
  });

  it('Space key toggles the switch when focused', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GlassToggle checked={false} onCheckedChange={onChange} label="Test toggle" />
    );
    const switchEl = screen.getByRole('switch');
    switchEl.focus();
    await user.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('disabled toggle does not respond to clicks', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GlassToggle checked={false} onCheckedChange={onChange} label="Test toggle" disabled />
    );
    const switchEl = screen.getByRole('switch');
    await user.click(switchEl);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('toggle ON state shows green background color on track', () => {
    render(
      <GlassToggle checked={true} onCheckedChange={() => {}} label="Test toggle" />
    );
    const switchEl = screen.getByRole('switch');
    // The green overlay should be present when checked
    const greenOverlay = switchEl.querySelector('[data-testid="toggle-active-overlay"]');
    expect(greenOverlay).toBeDefined();
    expect(greenOverlay).not.toBeNull();
  });
});

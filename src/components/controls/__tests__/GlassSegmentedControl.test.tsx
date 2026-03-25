/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GlassSegmentedControl } from '../GlassSegmentedControl';

// Mock motion/react -- we are testing React behavior, not animation
vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  LayoutGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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

const defaultSegments = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
];

describe('GlassSegmentedControl', () => {
  it('renders all segment labels', () => {
    render(
      <GlassSegmentedControl
        value="a"
        onValueChange={() => {}}
        segments={defaultSegments}
      />
    );
    expect(screen.getByText('Alpha')).toBeDefined();
    expect(screen.getByText('Beta')).toBeDefined();
    expect(screen.getByText('Gamma')).toBeDefined();
  });

  it('clicking a segment calls onValueChange with that segment value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GlassSegmentedControl
        value="a"
        onValueChange={onChange}
        segments={defaultSegments}
      />
    );
    await user.click(screen.getByText('Beta'));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('clicking the already-selected segment does NOT call onValueChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GlassSegmentedControl
        value="a"
        onValueChange={onChange}
        segments={defaultSegments}
      />
    );
    // Click the already-selected segment
    await user.click(screen.getByText('Alpha'));
    // Radix ToggleGroup returns empty string on deselect; guard should filter it
    expect(onChange).not.toHaveBeenCalled();
  });

  it('the glass indicator renders only within the selected segment', () => {
    render(
      <GlassSegmentedControl
        value="b"
        onValueChange={() => {}}
        segments={defaultSegments}
      />
    );
    // The GlassPanel (data-testid="glass-panel") should exist
    const glassPanels = screen.getAllByTestId('glass-panel');
    expect(glassPanels.length).toBe(1);
    // The indicator should be inside the selected segment's button
    const betaButton = screen.getByText('Beta').closest('button');
    expect(betaButton).not.toBeNull();
    expect(betaButton!.querySelector('[data-testid="glass-panel"]')).not.toBeNull();
  });

  it('arrow key Right moves selection to next segment', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GlassSegmentedControl
        value="a"
        onValueChange={onChange}
        segments={defaultSegments}
      />
    );
    // Focus the selected segment
    const alphaButton = screen.getByText('Alpha').closest('button');
    alphaButton!.focus();
    // Press right arrow
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('each segment renders as a button with correct accessibility attributes', () => {
    render(
      <GlassSegmentedControl
        value="a"
        onValueChange={() => {}}
        segments={defaultSegments}
      />
    );
    const buttons = screen.getAllByRole('radio');
    expect(buttons.length).toBe(3);
    // The selected segment should have aria-checked="true"
    const alphaButton = screen.getByText('Alpha').closest('[role="radio"]');
    expect(alphaButton!.getAttribute('aria-checked')).toBe('true');
    const betaButton = screen.getByText('Beta').closest('[role="radio"]');
    expect(betaButton!.getAttribute('aria-checked')).toBe('false');
  });

  it('multiple instances render independently (no layoutId collision)', async () => {
    const user = userEvent.setup();
    const onChange1 = vi.fn();
    const onChange2 = vi.fn();
    render(
      <>
        <GlassSegmentedControl
          value="a"
          onValueChange={onChange1}
          segments={defaultSegments}
        />
        <GlassSegmentedControl
          value="x"
          onValueChange={onChange2}
          segments={[
            { value: 'x', label: 'X-ray' },
            { value: 'y', label: 'Yankee' },
          ]}
        />
      </>
    );
    // Click a segment in the first control
    await user.click(screen.getByText('Beta'));
    expect(onChange1).toHaveBeenCalledWith('b');
    // The second control's onValueChange should NOT have been called
    expect(onChange2).not.toHaveBeenCalled();
  });
});

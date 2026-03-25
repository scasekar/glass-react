/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GlassToolbar } from '../GlassToolbar';

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

// Mock useGlassEngine -- needed by GlassPanel and GlassButton
vi.mock('../../../hooks/useGlassEngine', () => ({
  useGlassEngine: () => ({
    ready: false,
    preferences: { reducedMotion: false, reducedTransparency: false, darkMode: true },
  }),
}));

afterEach(() => {
  cleanup();
});

const makeActions = (overrides?: { primary?: boolean }) => [
  { id: 'bold', icon: <span>B</span>, label: 'Bold', onPress: vi.fn() },
  { id: 'italic', icon: <span>I</span>, label: 'Italic', onPress: vi.fn() },
  { id: 'send', icon: <span>S</span>, label: 'Send', onPress: vi.fn(), primary: overrides?.primary ?? false },
];

describe('GlassToolbar', () => {
  it('renders all action buttons from actions array', () => {
    const actions = makeActions();
    render(<GlassToolbar actions={actions} />);
    expect(screen.getByLabelText('Bold')).toBeDefined();
    expect(screen.getByLabelText('Italic')).toBeDefined();
    expect(screen.getByLabelText('Send')).toBeDefined();
  });

  it('clicking an action button calls its onPress callback', async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    render(<GlassToolbar actions={actions} />);
    await user.click(screen.getByLabelText('Bold'));
    expect(actions[0].onPress).toHaveBeenCalledTimes(1);
    await user.click(screen.getByLabelText('Italic'));
    expect(actions[1].onPress).toHaveBeenCalledTimes(1);
  });

  it('primary action button has data-primary="true" attribute', () => {
    const actions = makeActions({ primary: true });
    render(<GlassToolbar actions={actions} />);
    const sendButton = screen.getByLabelText('Send');
    expect(sendButton.getAttribute('data-primary')).toBe('true');
  });

  it('each button has aria-label matching action.label', () => {
    const actions = makeActions();
    render(<GlassToolbar actions={actions} />);
    for (const action of actions) {
      const button = screen.getByLabelText(action.label);
      expect(button.getAttribute('aria-label')).toBe(action.label);
    }
  });

  it('bar has role="toolbar" for semantic landmark', () => {
    const actions = makeActions();
    render(<GlassToolbar actions={actions} />);
    expect(screen.getByRole('toolbar')).toBeDefined();
  });
});

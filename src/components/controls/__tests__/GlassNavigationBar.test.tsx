/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GlassNavigationBar } from '../GlassNavigationBar';

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

describe('GlassNavigationBar', () => {
  it('renders title text', () => {
    render(<GlassNavigationBar title="Settings" />);
    expect(screen.getByText('Settings')).toBeDefined();
  });

  it('renders back chevron button when onBack is provided; clicking it calls onBack', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<GlassNavigationBar title="Details" onBack={onBack} />);
    const backButton = screen.getByLabelText('Back');
    expect(backButton).toBeDefined();
    await user.click(backButton);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('does NOT render back button when onBack is omitted', () => {
    render(<GlassNavigationBar title="Home" />);
    expect(screen.queryByLabelText('Back')).toBeNull();
  });

  it('renders action buttons from actions array; clicking action calls its onPress', async () => {
    const user = userEvent.setup();
    const onShare = vi.fn();
    const onEdit = vi.fn();
    render(
      <GlassNavigationBar
        title="Page"
        actions={[
          { id: 'share', icon: <span>S</span>, label: 'Share', onPress: onShare },
          { id: 'edit', icon: <span>E</span>, label: 'Edit', onPress: onEdit },
        ]}
      />
    );
    const shareButton = screen.getByLabelText('Share');
    const editButton = screen.getByLabelText('Edit');
    expect(shareButton).toBeDefined();
    expect(editButton).toBeDefined();
    await user.click(shareButton);
    expect(onShare).toHaveBeenCalledTimes(1);
    await user.click(editButton);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('bar has role="navigation" for semantic landmark', () => {
    render(<GlassNavigationBar title="Nav Test" />);
    expect(screen.getByRole('navigation')).toBeDefined();
  });

  it('back button has aria-label="Back"', () => {
    const onBack = vi.fn();
    render(<GlassNavigationBar title="Test" onBack={onBack} />);
    const backButton = screen.getByLabelText('Back');
    expect(backButton.getAttribute('aria-label')).toBe('Back');
  });
});

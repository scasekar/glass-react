/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GlassTabBar } from '../GlassTabBar';

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

const tabs = [
  { value: 'home', label: 'Home', icon: <span data-testid="icon-home">H</span> },
  { value: 'search', label: 'Search', icon: <span data-testid="icon-search">S</span> },
  { value: 'profile', label: 'Profile' },
];

describe('GlassTabBar', () => {
  it('renders all tab items with labels', () => {
    render(
      <GlassTabBar value="home" onValueChange={() => {}} tabs={tabs} />
    );
    expect(screen.getByText('Home')).toBeDefined();
    expect(screen.getByText('Search')).toBeDefined();
    expect(screen.getByText('Profile')).toBeDefined();
  });

  it('active tab has aria-pressed="true"', () => {
    render(
      <GlassTabBar value="home" onValueChange={() => {}} tabs={tabs} />
    );
    const homeBtn = screen.getByLabelText('Home');
    expect(homeBtn.getAttribute('aria-pressed')).toBe('true');
    const searchBtn = screen.getByLabelText('Search');
    expect(searchBtn.getAttribute('aria-pressed')).toBe('false');
  });

  it('clicking a non-active tab calls onValueChange with that tab value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GlassTabBar value="home" onValueChange={onChange} tabs={tabs} />
    );
    const searchBtn = screen.getByLabelText('Search');
    await user.click(searchBtn);
    expect(onChange).toHaveBeenCalledWith('search');
  });

  it('does NOT call onValueChange when clicking the already-active tab', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GlassTabBar value="home" onValueChange={onChange} tabs={tabs} />
    );
    const homeBtn = screen.getByLabelText('Home');
    await user.click(homeBtn);
    // Radix single toggle deselects on re-click (sends empty string), but we guard that
    expect(onChange).not.toHaveBeenCalled();
  });

  it('tab items have correct aria-label matching tab.label', () => {
    render(
      <GlassTabBar value="home" onValueChange={() => {}} tabs={tabs} />
    );
    expect(screen.getByLabelText('Home')).toBeDefined();
    expect(screen.getByLabelText('Search')).toBeDefined();
    expect(screen.getByLabelText('Profile')).toBeDefined();
  });

  it('renders icons when tab.icon is provided', () => {
    render(
      <GlassTabBar value="home" onValueChange={() => {}} tabs={tabs} />
    );
    expect(screen.getByTestId('icon-home')).toBeDefined();
    expect(screen.getByTestId('icon-search')).toBeDefined();
  });
});

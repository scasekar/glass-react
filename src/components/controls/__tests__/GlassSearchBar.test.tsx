/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GlassSearchBar } from '../GlassSearchBar';

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

describe('GlassSearchBar', () => {
  it('renders input with default placeholder "Search"', () => {
    render(
      <GlassSearchBar value="" onValueChange={() => {}} />
    );
    const input = screen.getByPlaceholderText('Search');
    expect(input).toBeDefined();
  });

  it('renders input with custom placeholder', () => {
    render(
      <GlassSearchBar value="" onValueChange={() => {}} placeholder="Find items..." />
    );
    const input = screen.getByPlaceholderText('Find items...');
    expect(input).toBeDefined();
  });

  it('typing in input calls onValueChange with new value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GlassSearchBar value="" onValueChange={onChange} />
    );
    const input = screen.getByPlaceholderText('Search');
    await user.type(input, 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('clear button appears when value is non-empty; clicking it calls onValueChange with empty string', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GlassSearchBar value="hello" onValueChange={onChange} />
    );
    const clearBtn = screen.getByLabelText('Clear search');
    expect(clearBtn).toBeDefined();
    await user.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('clear button is NOT rendered when value is empty', () => {
    render(
      <GlassSearchBar value="" onValueChange={() => {}} />
    );
    const clearBtn = screen.queryByLabelText('Clear search');
    expect(clearBtn).toBeNull();
  });

  it('cancel button appears when input is focused', async () => {
    const user = userEvent.setup();
    render(
      <GlassSearchBar value="" onValueChange={() => {}} onCancel={() => {}} />
    );
    const input = screen.getByPlaceholderText('Search');
    await user.click(input);
    const cancelBtn = screen.getByText('Cancel');
    expect(cancelBtn).toBeDefined();
  });

  it('clicking cancel calls onCancel and clears value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onCancel = vi.fn();
    render(
      <GlassSearchBar value="test" onValueChange={onChange} onCancel={onCancel} />
    );
    const input = screen.getByPlaceholderText('Search');
    await user.click(input); // focus to show cancel
    const cancelBtn = screen.getByText('Cancel');
    await user.click(cancelBtn);
    expect(onCancel).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('input has aria-label matching label prop (default "Search")', () => {
    render(
      <GlassSearchBar value="" onValueChange={() => {}} />
    );
    const input = screen.getByLabelText('Search');
    expect(input).toBeDefined();
  });

  it('input has custom aria-label matching label prop', () => {
    render(
      <GlassSearchBar value="" onValueChange={() => {}} label="Filter items" />
    );
    const input = screen.getByLabelText('Filter items');
    expect(input).toBeDefined();
  });

  it('disabled prop prevents input interaction', () => {
    render(
      <GlassSearchBar value="" onValueChange={() => {}} disabled />
    );
    const input = screen.getByPlaceholderText('Search') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });
});

/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { GlassPopover } from '../controls/GlassPopover';

// Mock useGlassEngine -- GlassPanel depends on it
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

// Mock motion/react to avoid animation complexity in jsdom
vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
      (props: React.ComponentProps<'div'>, ref) => {
        const {
          initial, animate, exit, transition,
          ...domProps
        } = props as Record<string, unknown>;
        return <div ref={ref} {...domProps as React.HTMLAttributes<HTMLDivElement>} />;
      }
    ),
  },
}));

describe('GlassPopover', () => {
  afterEach(() => cleanup());

  it('renders trigger element', () => {
    render(
      <GlassPopover
        open={false}
        onOpenChange={() => {}}
        trigger={<button>Open Menu</button>}
      >
        <p>Popover content</p>
      </GlassPopover>
    );
    expect(screen.getByText('Open Menu')).toBeDefined();
  });

  it('renders children content when open', () => {
    render(
      <GlassPopover
        open={true}
        onOpenChange={() => {}}
        trigger={<button>Trigger</button>}
      >
        <p>Visible popover content</p>
      </GlassPopover>
    );
    expect(screen.getByText('Visible popover content')).toBeDefined();
  });

  it('does not render popover content when open=false', () => {
    render(
      <GlassPopover
        open={false}
        onOpenChange={() => {}}
        trigger={<button>Trigger</button>}
      >
        <p>Hidden popover</p>
      </GlassPopover>
    );
    expect(screen.queryByText('Hidden popover')).toBeNull();
  });

  it('renders trigger as the popover trigger', () => {
    render(
      <GlassPopover
        open={false}
        onOpenChange={() => {}}
        trigger={<button data-testid="my-trigger">Click me</button>}
      >
        <p>Content</p>
      </GlassPopover>
    );
    // Radix Popover.Trigger asChild merges onto the trigger element
    const trigger = screen.getByTestId('my-trigger');
    expect(trigger).toBeDefined();
    expect(trigger.tagName).toBe('BUTTON');
  });
});

/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { GlassSheet } from '../controls/GlassSheet';

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
          drag, dragConstraints, dragElastic, onDragEnd,
          ...domProps
        } = props as Record<string, unknown>;
        return <div ref={ref} {...domProps as React.HTMLAttributes<HTMLDivElement>} />;
      }
    ),
  },
}));

describe('GlassSheet', () => {
  afterEach(() => cleanup());

  it('renders children content when open', () => {
    render(
      <GlassSheet open={true} onOpenChange={() => {}}>
        <p>Sheet content here</p>
      </GlassSheet>
    );
    expect(screen.getByText('Sheet content here')).toBeDefined();
  });

  it('does not render content when open=false', () => {
    render(
      <GlassSheet open={false} onOpenChange={() => {}}>
        <p>Hidden content</p>
      </GlassSheet>
    );
    expect(screen.queryByText('Hidden content')).toBeNull();
  });

  it('renders a dialog role element when open', () => {
    render(
      <GlassSheet open={true} onOpenChange={() => {}}>
        <p>Dialog test</p>
      </GlassSheet>
    );
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('renders a drag handle when showDragHandle is true (default)', () => {
    render(
      <GlassSheet open={true} onOpenChange={() => {}}>
        <p>With handle</p>
      </GlassSheet>
    );
    expect(screen.getByTestId('glass-sheet-drag-handle')).toBeDefined();
  });

  it('renders with half height by default', () => {
    render(
      <GlassSheet open={true} onOpenChange={() => {}}>
        <p>Half height</p>
      </GlassSheet>
    );
    const dialog = screen.getByRole('dialog');
    // The content container should have 50vh height (half)
    expect(dialog).toBeDefined();
    // Check the parent motion.div style contains 50vh
    expect(dialog.style.height).toBe('50vh');
  });

  it('renders title when provided', () => {
    render(
      <GlassSheet open={true} onOpenChange={() => {}} title="My Sheet Title">
        <p>Content</p>
      </GlassSheet>
    );
    expect(screen.getByRole('heading', { name: 'My Sheet Title' })).toBeDefined();
  });
});

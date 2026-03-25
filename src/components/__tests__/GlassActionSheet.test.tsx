/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { GlassActionSheet } from '../controls/GlassActionSheet';

// Mock useGlassEngine -- GlassPanel/GlassButton depend on it
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

describe('GlassActionSheet', () => {
  afterEach(() => cleanup());

  it('renders action labels when open', () => {
    render(
      <GlassActionSheet
        open={true}
        onOpenChange={() => {}}
        actions={[
          { label: 'Share', onPress: () => {} },
          { label: 'Copy Link', onPress: () => {} },
        ]}
      />
    );
    expect(screen.getByText('Share')).toBeDefined();
    expect(screen.getByText('Copy Link')).toBeDefined();
  });

  it('does not render content when open=false', () => {
    render(
      <GlassActionSheet
        open={false}
        onOpenChange={() => {}}
        actions={[{ label: 'Hidden Action', onPress: () => {} }]}
      />
    );
    expect(screen.queryByText('Hidden Action')).toBeNull();
  });

  it('action row calls its onPress callback on click', () => {
    const onPress = vi.fn();
    render(
      <GlassActionSheet
        open={true}
        onOpenChange={() => {}}
        actions={[{ label: 'Delete', onPress }]}
      />
    );
    fireEvent.click(screen.getByText('Delete'));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('cancel button calls onOpenChange(false)', () => {
    const onOpenChange = vi.fn();
    render(
      <GlassActionSheet
        open={true}
        onOpenChange={onOpenChange}
        actions={[{ label: 'Share', onPress: () => {} }]}
      />
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders optional title when provided', () => {
    render(
      <GlassActionSheet
        open={true}
        onOpenChange={() => {}}
        title="Choose Action"
        actions={[{ label: 'OK', onPress: () => {} }]}
      />
    );
    expect(screen.getByRole('heading', { name: 'Choose Action' })).toBeDefined();
  });

  it('renders a dialog role element when open', () => {
    render(
      <GlassActionSheet
        open={true}
        onOpenChange={() => {}}
        actions={[{ label: 'OK', onPress: () => {} }]}
      />
    );
    expect(screen.getByRole('dialog')).toBeDefined();
  });
});

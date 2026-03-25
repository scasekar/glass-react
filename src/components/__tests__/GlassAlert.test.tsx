/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { GlassAlert } from '../controls/GlassAlert';

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
        // Strip motion-specific props before passing to DOM
        const {
          initial, animate, exit, transition,
          ...domProps
        } = props as Record<string, unknown>;
        return <div ref={ref} {...domProps as React.HTMLAttributes<HTMLDivElement>} />;
      }
    ),
  },
}));

describe('GlassAlert', () => {
  afterEach(() => cleanup());

  it('renders title text when open', () => {
    render(
      <GlassAlert
        open={true}
        onOpenChange={() => {}}
        title="Delete Item"
        actions={[{ label: 'OK', onPress: () => {} }]}
      />
    );
    expect(screen.getByRole('heading', { name: 'Delete Item' })).toBeDefined();
  });

  it('renders message text when open', () => {
    render(
      <GlassAlert
        open={true}
        onOpenChange={() => {}}
        title="Warning"
        message="Are you sure you want to delete this?"
        actions={[{ label: 'OK', onPress: () => {} }]}
      />
    );
    expect(screen.getByText('Are you sure you want to delete this?')).toBeDefined();
  });

  it('does not render content when open=false', () => {
    render(
      <GlassAlert
        open={false}
        onOpenChange={() => {}}
        title="Hidden"
        actions={[{ label: 'OK', onPress: () => {} }]}
      />
    );
    expect(screen.queryByText('Hidden')).toBeNull();
  });

  it('action button calls its callback on click', () => {
    const onPress = vi.fn();
    render(
      <GlassAlert
        open={true}
        onOpenChange={() => {}}
        title="Confirm"
        actions={[{ label: 'Delete', onPress }]}
      />
    );
    fireEvent.click(screen.getByText('Delete'));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('calls onOpenChange(false) when action button is clicked (auto-dismiss)', () => {
    const onOpenChange = vi.fn();
    render(
      <GlassAlert
        open={true}
        onOpenChange={onOpenChange}
        title="Dismiss Test"
        actions={[{ label: 'OK', onPress: () => {} }]}
      />
    );
    fireEvent.click(screen.getByText('OK'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders a dialog role element when open', () => {
    render(
      <GlassAlert
        open={true}
        onOpenChange={() => {}}
        title="Dialog Test"
        actions={[{ label: 'OK', onPress: () => {} }]}
      />
    );
    expect(screen.getByRole('dialog')).toBeDefined();
  });
});

/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';
import { VirtualSection } from '../VirtualSection';

// --- IntersectionObserver mock ---
type IOCallback = (entries: Partial<IntersectionObserverEntry>[]) => void;
let lastObserverCallback: IOCallback | null = null;
let lastObserverInstance: { disconnect: ReturnType<typeof vi.fn> } | null = null;

beforeEach(() => {
  lastObserverCallback = null;
  lastObserverInstance = null;

  class MockIntersectionObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    constructor(callback: IOCallback) {
      lastObserverCallback = callback;
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      lastObserverInstance = this;
    }
  }

  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function fireIntersection(isIntersecting: boolean) {
  act(() => {
    lastObserverCallback?.([{ isIntersecting } as Partial<IntersectionObserverEntry>]);
  });
}

describe('VirtualSection', () => {
  it('does NOT render children when observer reports not intersecting', () => {
    render(
      <VirtualSection id="test-section">
        <div data-testid="child-content">Hello</div>
      </VirtualSection>
    );
    // Initially not intersecting (default state)
    expect(screen.queryByTestId('child-content')).toBeNull();
  });

  it('renders children when observer reports intersecting', () => {
    render(
      <VirtualSection id="test-section">
        <div data-testid="child-content">Hello</div>
      </VirtualSection>
    );
    fireIntersection(true);
    expect(screen.getByTestId('child-content')).toBeDefined();
    expect(screen.getByTestId('child-content').textContent).toBe('Hello');
  });

  it('section has minHeight when children are not mounted', () => {
    const { container } = render(
      <VirtualSection id="test-section" minHeight={600}>
        <div data-testid="child-content">Hello</div>
      </VirtualSection>
    );
    expect(screen.queryByTestId('child-content')).toBeNull();
    const section = container.querySelector('section');
    expect(section).not.toBeNull();
    expect((section as HTMLElement).style.minHeight).toBe('600px');
  });

  it('uses default minHeight of 400px', () => {
    const { container } = render(
      <VirtualSection id="test-section">
        <div>Content</div>
      </VirtualSection>
    );
    const section = container.querySelector('section');
    expect(section).not.toBeNull();
    expect((section as HTMLElement).style.minHeight).toBe('400px');
  });

  it('section element has the provided id attribute', () => {
    const { container } = render(
      <VirtualSection id="my-section">
        <div>Content</div>
      </VirtualSection>
    );
    const section = container.querySelector('section');
    expect(section).not.toBeNull();
    expect(section?.id).toBe('my-section');
  });

  it('unmounts children when observer reports not intersecting after being visible', () => {
    render(
      <VirtualSection id="test-section">
        <div data-testid="child-content">Hello</div>
      </VirtualSection>
    );
    fireIntersection(true);
    expect(screen.getByTestId('child-content')).toBeDefined();

    fireIntersection(false);
    expect(screen.queryByTestId('child-content')).toBeNull();
  });
});

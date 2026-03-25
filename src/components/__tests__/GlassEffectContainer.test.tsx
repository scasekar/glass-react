/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import React, { useRef, useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import { GlassEffectContainer } from '../GlassEffectContainer';
import { useGlassEffect } from '../../context/GlassEffectContext';

// Mock motion/react -- we are testing React context, not animation behavior
vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

/** Helper component that exposes context value via test ID */
function ContextReader({ testId = 'context-value' }: { testId?: string }) {
  const ctx = useGlassEffect();
  return <div data-testid={testId}>{ctx ? ctx.containerId : 'null'}</div>;
}

/** Helper that captures context value for assertion */
function ContextCapture({ onCapture }: { onCapture: (val: ReturnType<typeof useGlassEffect>) => void }) {
  const ctx = useGlassEffect();
  useEffect(() => { onCapture(ctx); });
  return null;
}

/** Helper that captures context across re-renders to check stability */
function StabilityChecker({ captures }: { captures: (string | null)[] }) {
  const ctx = useGlassEffect();
  useEffect(() => {
    captures.push(ctx?.containerId ?? null);
  });
  return null;
}

describe('GlassEffectContainer', () => {
  it('renders children without error', () => {
    render(
      <GlassEffectContainer>
        <div data-testid="child">Hello</div>
      </GlassEffectContainer>
    );
    expect(screen.getByTestId('child')).toBeDefined();
    expect(screen.getByTestId('child').textContent).toBe('Hello');
  });

  it('useGlassEffect() returns context value with containerId string', () => {
    let captured: ReturnType<typeof useGlassEffect> = null;
    render(
      <GlassEffectContainer>
        <ContextCapture onCapture={(val) => { captured = val; }} />
      </GlassEffectContainer>
    );
    expect(captured).not.toBeNull();
    expect(typeof captured!.containerId).toBe('string');
    expect(captured!.containerId.length).toBeGreaterThan(0);
  });

  it('containerId is stable across re-renders', () => {
    const captures: (string | null)[] = [];
    const { rerender } = render(
      <GlassEffectContainer>
        <StabilityChecker captures={captures} />
      </GlassEffectContainer>
    );
    rerender(
      <GlassEffectContainer>
        <StabilityChecker captures={captures} />
      </GlassEffectContainer>
    );
    expect(captures.length).toBeGreaterThanOrEqual(2);
    expect(captures[0]).toBe(captures[1]);
  });

  it('nested GlassEffectContainers provide different containerIds', () => {
    let outerCtx: ReturnType<typeof useGlassEffect> = null;
    let innerCtx: ReturnType<typeof useGlassEffect> = null;

    render(
      <GlassEffectContainer>
        <ContextCapture onCapture={(val) => { outerCtx = val; }} />
        <GlassEffectContainer>
          <ContextCapture onCapture={(val) => { innerCtx = val; }} />
        </GlassEffectContainer>
      </GlassEffectContainer>
    );

    expect(outerCtx).not.toBeNull();
    expect(innerCtx).not.toBeNull();
    expect(outerCtx!.containerId).not.toBe(innerCtx!.containerId);
  });

  it('custom id prop overrides auto-generated containerId', () => {
    let captured: ReturnType<typeof useGlassEffect> = null;
    render(
      <GlassEffectContainer id="my-custom-id">
        <ContextCapture onCapture={(val) => { captured = val; }} />
      </GlassEffectContainer>
    );
    expect(captured).not.toBeNull();
    expect(captured!.containerId).toBe('my-custom-id');
  });

  it('defaultGlassProps are accessible from context', () => {
    let captured: ReturnType<typeof useGlassEffect> = null;
    const defaultProps = { blur: 0.8, cornerRadius: 20 };
    render(
      <GlassEffectContainer defaultGlassProps={defaultProps}>
        <ContextCapture onCapture={(val) => { captured = val; }} />
      </GlassEffectContainer>
    );
    expect(captured).not.toBeNull();
    expect(captured!.defaultProps).toEqual(defaultProps);
  });

  it('useGlassEffect() returns null when used outside GlassEffectContainer', () => {
    let captured: ReturnType<typeof useGlassEffect> = undefined as any;
    render(
      <ContextCapture onCapture={(val) => { captured = val; }} />
    );
    expect(captured).toBeNull();
  });
});

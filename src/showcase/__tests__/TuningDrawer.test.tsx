/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TuningDrawer } from '../TuningDrawer';

afterEach(() => {
  cleanup();
});

describe('TuningDrawer', () => {
  it('renders with transform translateX(100%) when open=false', () => {
    const { container } = render(
      <TuningDrawer open={false} onClose={() => {}} />
    );
    const drawer = container.firstElementChild as HTMLElement;
    expect(drawer.style.transform).toBe('translateX(100%)');
  });

  it('renders with transform translateX(0%) when open=true', () => {
    const { container } = render(
      <TuningDrawer open={true} onClose={() => {}} />
    );
    const drawer = container.firstElementChild as HTMLElement;
    expect(drawer.style.transform).toBe('translateX(0%)');
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<TuningDrawer open={true} onClose={onClose} />);
    const closeBtn = screen.getByRole('button', { name: /close/i });
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('contains parameter slider labels for blur, specular, rim, refraction, aberration, blur radius', () => {
    render(<TuningDrawer open={true} onClose={() => {}} />);
    expect(screen.getByText(/blur intensity/i)).toBeDefined();
    expect(screen.getByText(/specular/i)).toBeDefined();
    expect(screen.getByText(/rim/i)).toBeDefined();
    expect(screen.getByText(/refraction/i)).toBeDefined();
    expect(screen.getByText(/aberration/i)).toBeDefined();
    expect(screen.getByText(/blur radius/i)).toBeDefined();
  });

  it('has fixed positioning styles', () => {
    const { container } = render(
      <TuningDrawer open={false} onClose={() => {}} />
    );
    const drawer = container.firstElementChild as HTMLElement;
    expect(drawer.style.position).toBe('fixed');
    expect(drawer.style.top).toBe('0px');
    expect(drawer.style.right).toBe('0px');
    expect(drawer.style.bottom).toBe('0px');
    expect(drawer.style.zIndex).toBe('200');
  });
});

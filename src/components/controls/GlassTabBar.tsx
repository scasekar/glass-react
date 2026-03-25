import { useState, useEffect } from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { useReducedMotion } from 'motion/react';
import { GlassPanel } from '../GlassPanel';
import { GlassButton } from '../GlassButton';
import { APPLE_SPACING, APPLE_RADII, APPLE_CONTROL_SIZES } from '../../tokens/apple';
import type { GlassTabBarProps } from './types';

/**
 * A glass-effect tab bar for bottom-of-screen navigation.
 *
 * Renders a fixed bottom bar with glass background containing tab items
 * powered by Radix ToggleGroup for accessible keyboard navigation (arrow
 * keys, roving tabindex). The active tab uses prominent refraction for
 * visual distinction.
 *
 * Optionally minimizes on scroll-down (icon-only mode) and expands on
 * scroll-up when `scrollMinimize` is enabled.
 *
 * @example
 * ```tsx
 * const [tab, setTab] = useState('home');
 * <GlassTabBar
 *   value={tab}
 *   onValueChange={setTab}
 *   tabs={[
 *     { value: 'home', label: 'Home', icon: <HomeIcon /> },
 *     { value: 'search', label: 'Search', icon: <SearchIcon /> },
 *   ]}
 * />
 * ```
 */
export function GlassTabBar({
  value,
  onValueChange,
  tabs,
  scrollMinimize,
  className,
  style,
}: GlassTabBarProps) {
  const [minimized, setMinimized] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!scrollMinimize) return;
    const lastScrollY = { current: 0 };
    const onScroll = () => {
      const currentY = window.scrollY;
      if (currentY > lastScrollY.current && currentY > 50) {
        setMinimized(true);
      } else {
        setMinimized(false);
      }
      lastScrollY.current = currentY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [scrollMinimize]);

  return (
    <nav role="navigation" className={className} style={style}>
      <GlassPanel
        cornerRadius={0}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: minimized ? 49 : 83,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: reducedMotion ? 'none' : 'height 0.3s ease',
          paddingBottom: minimized ? 0 : 34,
        }}
      >
        <ToggleGroup.Root
          type="single"
          value={value}
          onValueChange={(v) => { if (v) onValueChange(v); }}
          aria-label="Navigation tabs"
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: APPLE_SPACING.xs,
          }}
        >
          {tabs.map((tab) => (
            <ToggleGroup.Item
              key={tab.value}
              value={tab.value}
              asChild
            >
              <GlassButton
                cornerRadius={APPLE_RADII.md}
                refractionMode={value === tab.value ? 'prominent' : undefined}
                aria-label={tab.label}
                style={{
                  minWidth: APPLE_CONTROL_SIZES.minTapTarget,
                  minHeight: APPLE_CONTROL_SIZES.minTapTarget,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                }}
              >
                {tab.icon}
                {!minimized && (
                  <span style={{ fontSize: 10 }}>{tab.label}</span>
                )}
              </GlassButton>
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
      </GlassPanel>
    </nav>
  );
}

import React, { useMemo, useId } from 'react';
import { AnimatePresence } from 'motion/react';
import { GlassEffectContext } from '../context/GlassEffectContext';
import type { GlassEffectContextValue } from '../context/GlassEffectContext';
import type { GlassStyleProps } from './types';

/**
 * Props for GlassEffectContainer.
 */
export interface GlassEffectContainerProps {
  children: React.ReactNode;
  /** Optional stable ID for layoutId coordination. When provided, overrides the auto-generated containerId. */
  id?: string;
  /** Default glass style props propagated to child controls for visual coherence. */
  defaultGlassProps?: GlassStyleProps;
  /** Wrap children in AnimatePresence for mount/unmount transitions. Default: true */
  animate?: boolean;
  /** CSS styles applied to the container div. */
  style?: React.CSSProperties;
  /** CSS class name applied to the container div. */
  className?: string;
}

/**
 * Coordination primitive for grouped glass controls.
 *
 * GlassEffectContainer provides a shared morph ID namespace via React context,
 * enabling coordinated layout animations (e.g., button-to-sheet morphs) and
 * shared default glass props for visual coherence across children.
 *
 * This component is a logical grouper only -- it does NOT register a GPU region.
 * Child controls (GlassPanel, GlassButton, etc.) handle their own GPU region
 * registration as usual.
 *
 * @example
 * ```tsx
 * <GlassEffectContainer defaultGlassProps={{ blur: 0.6, cornerRadius: 20 }}>
 *   <GlassButton>Action</GlassButton>
 *   <GlassPanel style={{ width: 200, height: 100 }}>
 *     Content
 *   </GlassPanel>
 * </GlassEffectContainer>
 * ```
 *
 * @example Nested containers create separate morph scopes
 * ```tsx
 * <GlassEffectContainer id="toolbar">
 *   <GlassEffectContainer id="search-group">
 *     {/* Inner controls use "search-group" as their morph scope *\/}
 *   </GlassEffectContainer>
 * </GlassEffectContainer>
 * ```
 */
export function GlassEffectContainer({
  children,
  id,
  defaultGlassProps,
  animate = true,
  style,
  className,
}: GlassEffectContainerProps) {
  const autoId = useId();
  const containerId = id ?? autoId;

  const contextValue = useMemo<GlassEffectContextValue>(
    () => ({
      containerId,
      defaultProps: defaultGlassProps,
    }),
    [containerId, defaultGlassProps]
  );

  const content = animate ? (
    <AnimatePresence>{children}</AnimatePresence>
  ) : (
    children
  );

  return (
    <GlassEffectContext.Provider value={contextValue}>
      <div style={style} className={className}>
        {content}
      </div>
    </GlassEffectContext.Provider>
  );
}

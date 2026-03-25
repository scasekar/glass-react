import { createContext, useContext } from 'react';
import type { GlassStyleProps } from '../components/types';

/**
 * Value provided by GlassEffectContainer to coordinate morph animations
 * and shared styling across grouped glass controls.
 */
export interface GlassEffectContextValue {
  /** Stable identifier for this container group, used as layoutId prefix for morph animations */
  containerId: string;
  /** Default glass style props propagated to child controls for visual coherence */
  defaultProps?: GlassStyleProps;
}

/**
 * React context for GlassEffectContainer coordination.
 * Null when no GlassEffectContainer is present in the tree.
 */
export const GlassEffectContext = createContext<GlassEffectContextValue | null>(null);

/**
 * Hook to access the nearest GlassEffectContainer's context value.
 *
 * Returns `null` when used outside a GlassEffectContainer -- this is intentional.
 * Unlike useGlassEngine, this context is optional; controls function without it
 * but gain morph coordination and shared defaults when inside a container.
 *
 * @example
 * ```tsx
 * function MyControl() {
 *   const effect = useGlassEffect();
 *   const layoutPrefix = effect?.containerId ?? '';
 *   // Use layoutPrefix for morph animation scoping
 * }
 * ```
 */
export function useGlassEffect(): GlassEffectContextValue | null {
  return useContext(GlassEffectContext);
}

import { useContext } from 'react';
import { GlassContext, type GlassContextValue } from '../context/GlassContext';

export function useGlassEngine(): GlassContextValue {
  const ctx = useContext(GlassContext);
  if (!ctx) {
    throw new Error('useGlassEngine must be used within a <GlassProvider>');
  }
  return ctx;
}

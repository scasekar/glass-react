import { createContext } from 'react';
import type { AccessibilityPreferences } from '../components/types';

export interface GlassRegionHandle {
  id: number;
  updateRect(x: number, y: number, w: number, h: number): void;
  updateParams(cornerRadius: number, blur: number, opacity: number, refraction: number): void;
  updateTint(r: number, g: number, b: number): void;
  updateAberration(intensity: number): void;
  updateSpecular(intensity: number): void;
  updateRim(intensity: number): void;
  updateMode(mode: number): void;
  remove(): void;
}

export interface RegisteredRegion {
  element: HTMLElement;
  handle: GlassRegionHandle;
}

export interface GlassContextValue {
  registerRegion(element: HTMLElement): GlassRegionHandle | null;
  unregisterRegion(id: number): void;
  ready: boolean;
  preferences: AccessibilityPreferences;
}

export const GlassContext = createContext<GlassContextValue | null>(null);

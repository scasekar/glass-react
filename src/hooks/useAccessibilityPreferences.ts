import { useSyncExternalStore } from 'react';
import type { AccessibilityPreferences } from '../components/types';

interface MediaQueryStore {
  subscribe(callback: () => void): () => void;
  getSnapshot(): boolean;
  getServerSnapshot(): boolean;
}

function createMediaQueryStore(query: string): MediaQueryStore {
  return {
    subscribe(callback: () => void) {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', callback);
      return () => mql.removeEventListener('change', callback);
    },
    getSnapshot() {
      return window.matchMedia(query).matches;
    },
    getServerSnapshot() {
      return false;
    },
  };
}

const reducedMotionStore = createMediaQueryStore('(prefers-reduced-motion: reduce)');
const reducedTransparencyStore = createMediaQueryStore('(prefers-reduced-transparency: reduce)');
const darkModeStore = createMediaQueryStore('(prefers-color-scheme: dark)');

export function useAccessibilityPreferences(): AccessibilityPreferences {
  const reducedMotion = useSyncExternalStore(
    reducedMotionStore.subscribe,
    reducedMotionStore.getSnapshot,
    reducedMotionStore.getServerSnapshot,
  );
  const reducedTransparency = useSyncExternalStore(
    reducedTransparencyStore.subscribe,
    reducedTransparencyStore.getSnapshot,
    reducedTransparencyStore.getServerSnapshot,
  );
  const darkMode = useSyncExternalStore(
    darkModeStore.subscribe,
    darkModeStore.getSnapshot,
    darkModeStore.getServerSnapshot,
  );

  return { reducedMotion, reducedTransparency, darkMode };
}

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GlassContext, type GlassRegionHandle, type RegisteredRegion } from '../context/GlassContext';
import { initEngine, type EngineModule } from '../wasm/loader';
import { useAccessibilityPreferences } from '../hooks/useAccessibilityPreferences';

export function GlassProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const moduleRef = useRef<EngineModule | null>(null);
  const regionsRef = useRef(new Map<number, RegisteredRegion>());
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prefs = useAccessibilityPreferences();

  // Initialize WASM engine
  useEffect(() => {
    let cancelled = false;
    initEngine().then(async module => {
      if (cancelled) return;
      // The C++ main() fires RequestAdapter → RequestDevice asynchronously.
      // Poll until getEngine() returns non-null (device acquired, engine created).
      while (!module.getEngine()) {
        if (cancelled) return;
        await new Promise(r => setTimeout(r, 50));
      }
      moduleRef.current = module;
      setReady(true);
    }).catch(err => {
      console.error('GlassProvider: engine init failed', err);
    });
    return () => {
      cancelled = true;
      if (moduleRef.current) {
        moduleRef.current.destroyEngine();
        moduleRef.current = null;
      }
    };
  }, []);

  // ResizeObserver for canvas
  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver((entries) => {
      const engine = moduleRef.current?.getEngine();
      if (!engine) return;
      for (const entry of entries) {
        const width = entry.devicePixelContentBoxSize?.[0].inlineSize
          ?? Math.round(entry.contentBoxSize[0].inlineSize * devicePixelRatio);
        const height = entry.devicePixelContentBoxSize?.[0].blockSize
          ?? Math.round(entry.contentBoxSize[0].blockSize * devicePixelRatio);
        const maxDim = 4096;
        const w = Math.max(1, Math.min(width, maxDim));
        const h = Math.max(1, Math.min(height, maxDim));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
          engine.resize(w, h);
        }
      }
    });
    try {
      observer.observe(canvas, { box: 'device-pixel-content-box' as ResizeObserverBoxOptions });
    } catch {
      observer.observe(canvas, { box: 'content-box' });
    }
    return () => observer.disconnect();
  }, [ready]);

  // Sync reduced-motion preference to engine
  useEffect(() => {
    const engine = moduleRef.current?.getEngine();
    if (!engine) return;
    engine.setPaused(prefs.reducedMotion);
  }, [prefs.reducedMotion, ready]);

  // rAF position sync loop
  useEffect(() => {
    if (!ready) return;
    let rafId: number;
    const sync = () => {
      const canvas = canvasRef.current;
      if (canvas && regionsRef.current.size > 0) {
        const canvasRect = canvas.getBoundingClientRect();
        for (const [, region] of regionsRef.current) {
          const rect = region.element.getBoundingClientRect();
          const x = (rect.left - canvasRect.left) / canvasRect.width;
          const y = (rect.top - canvasRect.top) / canvasRect.height;
          const w = rect.width / canvasRect.width;
          const h = rect.height / canvasRect.height;
          region.handle.updateRect(x, y, w, h);
        }
      }
      rafId = requestAnimationFrame(sync);
    };
    rafId = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(rafId);
  }, [ready]);

  const registerRegion = useCallback((element: HTMLElement): GlassRegionHandle | null => {
    const engine = moduleRef.current?.getEngine();
    if (!engine) return null;
    const id = engine.addGlassRegion();
    if (id < 0) return null;
    const handle: GlassRegionHandle = {
      id,
      updateRect: (x, y, w, h) => engine.setRegionRect(id, x, y, w, h),
      updateParams: (cr, b, o, r) => engine.setRegionParams(id, cr, b, o, r),
      updateTint: (r, g, b) => engine.setRegionTint(id, r, g, b),
      updateAberration: (intensity) => engine.setRegionAberration(id, intensity),
      updateSpecular: (intensity) => engine.setRegionSpecular(id, intensity),
      updateRim: (intensity) => engine.setRegionRim(id, intensity),
      updateMode: (mode) => engine.setRegionMode(id, mode),
      remove: () => engine.removeGlassRegion(id),
    };
    regionsRef.current.set(id, { element, handle });
    return handle;
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const unregisterRegion = useCallback((id: number) => {
    regionsRef.current.delete(id);
  }, []);

  const contextValue = useMemo(() => ({
    registerRegion,
    unregisterRegion,
    ready,
    preferences: prefs,
  }), [registerRegion, unregisterRegion, ready, prefs]);

  return (
    <GlassContext value={contextValue}>
      <canvas
        id="gpu-canvas"
        ref={canvasRef}
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: -1,
          display: 'block',
        }}
      />
      {children}
    </GlassContext>
  );
}

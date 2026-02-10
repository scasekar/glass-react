import { useEffect, useRef, useState } from 'react';
import { initEngine, type EngineModule } from './wasm/loader';

export default function App() {
  const [status, setStatus] = useState<'loading' | 'running' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const moduleRef = useRef<EngineModule | null>(null);

  useEffect(() => {
    let cancelled = false;

    initEngine()
      .then((module) => {
        if (cancelled) return;
        moduleRef.current = module;

        const canvas = document.getElementById('gpu-canvas') as HTMLCanvasElement | null;
        if (!canvas) {
          setStatus('error');
          setError('Canvas element #gpu-canvas not found');
          return;
        }

        const observer = new ResizeObserver((entries) => {
          const engine = module.getEngine();
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

        observerRef.current = observer;
        setStatus('running');
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('error');
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
      observerRef.current?.disconnect();
      if (moduleRef.current) {
        moduleRef.current.destroyEngine();
        moduleRef.current = null;
      }
    };
  }, []);

  if (status === 'error') {
    return (
      <p style={{ color: '#f44', padding: '24px', pointerEvents: 'auto' }}>
        Engine failed: {error}
      </p>
    );
  }

  // No visible UI when loading or running -- the noise background IS the visual
  return null;
}

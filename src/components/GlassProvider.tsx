import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GlassContext, type GlassRegionHandle, type RegisteredRegion } from '../context/GlassContext';
import { initEngine, type EngineModule } from '../wasm/loader';
import { useAccessibilityPreferences } from '../hooks/useAccessibilityPreferences';
import wallpaperUrl from '../assets/wallpaper.jpg';

export interface GlassProviderProps {
  children: React.ReactNode;
  backgroundMode?: 'image' | 'noise'; // default: 'image'
  /** Ref populated with the WASM engine module once ready. */
  engineRef?: React.MutableRefObject<EngineModule | null>;
}

async function loadAndUploadWallpaper(module: EngineModule): Promise<void> {
  const response = await fetch(wallpaperUrl);
  if (!response.ok) {
    console.error('GlassProvider: failed to load wallpaper:', response.status);
    return;
  }
  const blob = await response.blob();

  // colorSpaceConversion: 'none' preserves raw sRGB values from JPEG
  // This prevents the browser from applying unwanted ICC profile conversion
  const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none' });

  // Capture dimensions before closing bitmap
  const width = bitmap.width;
  const height = bitmap.height;

  // Extract raw RGBA pixels via OffscreenCanvas
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, width, height);
  bitmap.close();

  const rgba = new Uint8Array(imageData.data.buffer);

  // Transfer to WASM heap and upload
  const ptr = module._malloc(rgba.byteLength);
  module.HEAPU8.set(rgba, ptr);
  module.uploadImageData(ptr, width, height);
  module._free(ptr);
}

export function GlassProvider({ children, backgroundMode = 'image', engineRef }: GlassProviderProps) {
  const [ready, setReady] = useState(false);
  const moduleRef = useRef<EngineModule | null>(null);
  const regionsRef = useRef(new Map<number, RegisteredRegion>());
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prefs = useAccessibilityPreferences();

  // Initialize WASM engine — JS creates GPUDevice, passes to initEngine (DEV-01, DEV-02)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!navigator.gpu) {
        console.error('GlassProvider: WebGPU not supported');
        return;
      }
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter || cancelled) return;
      const device = await adapter.requestDevice();
      if (cancelled) { device.destroy(); return; }

      const module = await initEngine(device);
      if (cancelled) { module.destroyEngine(); device.destroy(); return; }

      // initWithExternalDevice is synchronous — getEngine() is ready immediately
      // (C++ main() no longer does async RequestAdapter/RequestDevice)
      // Small poll guard in case there is any async init lag:
      while (!module.getEngine()) {
        if (cancelled) { module.destroyEngine(); device.destroy(); return; }
        await new Promise(r => setTimeout(r, 50));
      }

      moduleRef.current = module;
      if (engineRef) engineRef.current = module;
      setReady(true);
    })().catch(err => {
      console.error('GlassProvider: engine init failed', err);
    });

    return () => {
      cancelled = true;
      if (engineRef) engineRef.current = null;
      if (moduleRef.current) {
        moduleRef.current.destroyEngine();
        moduleRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // JS-driven render loop: replaces C++ emscripten_set_main_loop (DEV-05)
  useEffect(() => {
    if (!ready) return;
    let rafId: number;
    let lastTime = 0;

    const loop = (now: number) => {
      const dt = lastTime === 0 ? 0 : Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      const engine = moduleRef.current?.getEngine();
      if (engine) {
        engine.update(dt);
        engine.renderBackground();
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [ready]);

  // ResizeObserver for canvas
  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Set DPR immediately on engine init (before first resize)
    const engine0 = moduleRef.current?.getEngine();
    if (engine0) engine0.setDpr(devicePixelRatio);

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
      // Always sync DPR (may change when moving between displays)
      engine.setDpr(devicePixelRatio);
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

  // Load and upload wallpaper image when engine is ready
  useEffect(() => {
    if (!ready || !moduleRef.current) return;
    loadAndUploadWallpaper(moduleRef.current).catch(err => {
      console.error('GlassProvider: wallpaper upload failed', err);
    });
  }, [ready]);

  // Sync backgroundMode prop to C++ engine
  useEffect(() => {
    if (!ready || !moduleRef.current) return;
    // 0 = Image, 1 = Noise (matches C++ BackgroundMode enum)
    moduleRef.current.setBackgroundMode(backgroundMode === 'image' ? 0 : 1);
  }, [backgroundMode, ready]);

  const registerRegion = useCallback((_element: HTMLElement): GlassRegionHandle | null => {
    // TODO Phase 17: wire to JS GlassRenderer instead of C++ BackgroundEngine
    return null;
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const unregisterRegion = useCallback((id: number) => {
    const region = regionsRef.current.get(id);
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

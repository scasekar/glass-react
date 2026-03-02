import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GlassContext, type GlassRegionHandle, type RegisteredRegion } from '../context/GlassContext';
import { initEngine, type EngineModule } from '../wasm/loader';
import { useAccessibilityPreferences } from '../hooks/useAccessibilityPreferences';
import wallpaperUrl from '../assets/wallpaper.jpg';

export interface GlassProviderProps {
  children: React.ReactNode;
  backgroundMode?: 'image' | 'noise'; // default: 'image'
  /** External WebGPU device. When provided, engine uses this instead of creating its own. */
  device?: GPUDevice;
  /** External background texture. When provided, noise pass is skipped and this texture is used as background. */
  externalTexture?: GPUTexture;
  /** Ref populated with the WASM engine module once ready. Enables per-frame texture updates from outside. */
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

export function GlassProvider({ children, backgroundMode = 'image', device, externalTexture, engineRef }: GlassProviderProps) {
  const [ready, setReady] = useState(false);
  const moduleRef = useRef<EngineModule | null>(null);
  const regionsRef = useRef(new Map<number, RegisteredRegion>());
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prefs = useAccessibilityPreferences();

  // Initialize WASM engine
  useEffect(() => {
    let cancelled = false;
    initEngine(device ? { device } : undefined).then(async module => {
      if (cancelled) {
        // StrictMode cleanup ran before initEngine resolved — destroy the
        // orphaned engine to stop its rAF render loop.
        module.destroyEngine();
        return;
      }
      // The C++ main() fires RequestAdapter → RequestDevice asynchronously.
      // Poll until getEngine() returns non-null (device acquired, engine created).
      while (!module.getEngine()) {
        if (cancelled) {
          module.destroyEngine();
          return;
        }
        await new Promise(r => setTimeout(r, 50));
      }
      moduleRef.current = module;
      if (engineRef) engineRef.current = module;
      setReady(true);
    }).catch(err => {
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

  // When using external device, skip background rendering (Pass 1) immediately.
  // This prevents noise/wallpaper from flashing before the scene texture arrives.
  useEffect(() => {
    if (!ready || !moduleRef.current || !device) return;
    const engine = moduleRef.current.getEngine();
    if (!engine) return;
    engine.setExternalTextureMode(true);
  }, [ready, device]);

  // Load and upload wallpaper image when engine is ready (only in standalone mode)
  useEffect(() => {
    if (!ready || !moduleRef.current || device || externalTexture) return;
    loadAndUploadWallpaper(moduleRef.current).catch(err => {
      console.error('GlassProvider: wallpaper upload failed', err);
    });
  }, [ready, device, externalTexture]);

  // Sync backgroundMode prop to C++ engine (only in standalone mode)
  useEffect(() => {
    if (!ready || !moduleRef.current || device || externalTexture) return;
    // 0 = Image, 1 = Noise (matches C++ BackgroundMode enum)
    moduleRef.current.setBackgroundMode(backgroundMode === 'image' ? 0 : 1);
  }, [backgroundMode, ready, device, externalTexture]);

  // Inject external texture directly into the glass engine's bind group (no copy)
  useEffect(() => {
    if (!ready || !moduleRef.current || !externalTexture) return;
    const module = moduleRef.current;
    if (!module.WebGPU?.importJsTexture) return;

    // Import the JS GPUTexture into emdawnwebgpu's object table → returns a WASM handle
    const handle = module.WebGPU.importJsTexture(externalTexture);
    module.setExternalBackgroundTexture(handle);

    return () => {
      // Clear external texture on unmount so engine falls back to offscreen
      module.setExternalBackgroundTexture(0);
    };
  }, [ready, externalTexture]);

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
      updateMorphSpeed: (speed) => engine.setRegionMorphSpeed(id, speed),
      updateContrast: (v) => engine.setRegionContrast(id, v),
      updateSaturation: (v) => engine.setRegionSaturation(id, v),
      updateBlurRadius: (v) => engine.setRegionBlurRadius(id, v),
      updateFresnelIOR: (v) => engine.setRegionFresnelIOR(id, v),
      updateFresnelExponent: (v) => engine.setRegionFresnelExponent(id, v),
      updateEnvReflectionStrength: (v) => engine.setRegionEnvReflectionStrength(id, v),
      updateGlareAngle: (v) => engine.setRegionGlareAngle(id, v),
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

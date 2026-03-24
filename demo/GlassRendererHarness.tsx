import { useEffect, useRef } from 'react';
import { GlassRenderer } from '../src/renderer';

/**
 * Standalone visual test harness for GlassRenderer.
 * Uses a synthetic 512x512 solid-color scene texture -- NO WASM required.
 * This lets Phase 16 verify the glass pipeline in isolation.
 */
export function GlassRendererHarness() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let rafId: number;
    let renderer: GlassRenderer | null = null;
    let device: GPUDevice | null = null;
    let regionId: number | null = null;
    let canvasContext: GPUCanvasContext | null = null;
    let sceneTexture: GPUTexture | null = null;

    (async () => {
      if (!navigator.gpu) {
        console.error('GlassRendererHarness: WebGPU not available');
        return;
      }
      const canvas = canvasRef.current;
      if (!canvas) return;

      // 1. Create GPUDevice (JS owns it -- matches v3.0 architecture)
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) { console.error('No GPU adapter'); return; }
      device = await adapter.requestDevice();

      // 2. Configure canvas context (GLASS-04)
      const format = navigator.gpu.getPreferredCanvasFormat();
      canvasContext = canvas.getContext('webgpu')!;
      canvasContext.configure({
        device,
        format,
        alphaMode: 'opaque', // Alpha compositing happens inside the render pass
      });

      // 3. Init GlassRenderer
      renderer = new GlassRenderer();
      await renderer.init(device, format);

      // 4. Create synthetic 512x512 rgba8unorm scene texture filled with warm gray
      // rgba8unorm is REQUIRED -- matches C++ offscreen texture format (NOT bgra)
      sceneTexture = device.createTexture({
        label: 'synthetic scene texture',
        size: [512, 512, 1],
        format: 'rgba8unorm',
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT,
      });

      // Fill with warm golden/amber color to make glass refraction visually obvious
      // (R=200, G=160, B=80, A=255 in sRGB)
      const fillData = new Uint8Array(512 * 512 * 4);
      for (let i = 0; i < 512 * 512; i++) {
        fillData[i * 4 + 0] = 200; // R
        fillData[i * 4 + 1] = 160; // G
        fillData[i * 4 + 2] = 80;  // B
        fillData[i * 4 + 3] = 255; // A
      }
      device.queue.writeTexture(
        { texture: sceneTexture },
        fillData,
        { bytesPerRow: 512 * 4 },
        [512, 512, 1],
      );

      // 5. Wire synthetic texture into renderer (GLASS-05 mechanism)
      renderer.setSceneTexture(sceneTexture);

      // 6. Add one glass region -- a div overlaid on the canvas center
      const glassPanel = document.getElementById('glass-panel');
      if (glassPanel) {
        regionId = renderer.addRegion(glassPanel as HTMLElement, {
          cornerRadius: 16,
          blurIntensity: 0.6,
          opacity: 0.15,
          refractionStrength: 0.1,
          tint: { r: 1, g: 1, b: 1 },
          aberration: 2.0,
        });
      }

      // 7. rAF render loop
      let lastTime = 0;
      const loop = (now: number) => {
        const dt = lastTime === 0 ? 0 : Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;
        if (renderer && canvasContext) {
          renderer.render(
            canvasContext,
            canvas.width,
            canvas.height,
            dt,
            devicePixelRatio,
          );
        }
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
    })().catch(err => console.error('GlassRendererHarness init failed:', err));

    // 8. ResizeObserver -- calls setSceneTexture with SAME texture on resize (GLASS-05)
    // NOTE: In Phase 16 the synthetic texture doesn't actually resize,
    // but the bind group rebuild path is exercised.
    const canvas = canvasRef.current!;
    const observer = new ResizeObserver(() => {
      if (!renderer || !device || !sceneTexture) return;
      // Re-set the same synthetic texture to exercise the bind group rebuild path (GLASS-05)
      // In Phase 17 this will re-fetch the resized C++ texture
      renderer.setSceneTexture(sceneTexture);
    });
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      if (renderer) renderer.destroy();
      if (device) device.destroy();
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        id="glass-renderer-canvas"
        width={window.innerWidth * devicePixelRatio}
        height={window.innerHeight * devicePixelRatio}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />
      {/* Glass panel overlay -- centered, used as the glass region element */}
      <div
        id="glass-panel"
        data-testid="glass-panel"
        style={{
          position: 'absolute',
          top: '30%',
          left: '25%',
          width: '50%',
          height: '40%',
          borderRadius: '16px',
          pointerEvents: 'none',
          // Transparent -- glass effect renders on canvas behind it
        }}
      />
      <div style={{
        position: 'absolute',
        top: 16,
        left: 16,
        color: 'white',
        fontFamily: 'system-ui',
        fontSize: 14,
        textShadow: '0 1px 3px rgba(0,0,0,0.8)',
        pointerEvents: 'none',
      }}>
        Phase 16: GlassRenderer Harness -- synthetic texture
      </div>
    </div>
  );
}

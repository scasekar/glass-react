import glassWgsl from './glass.wgsl?raw';
import {
  buildGlassUniformData,
  morphLerp,
  DEFAULT_GLASS_UNIFORMS,
  type GlassUniforms,
  type GlassRegionState,
} from './GlassRegionState';

export const MAX_GLASS_REGIONS = 32;
const UNIFORM_STRIDE = 256; // WebGPU minUniformBufferOffsetAlignment
const FLOATS_PER_REGION = 28; // 112 bytes / 4

export class GlassRenderer {
  private device!: GPUDevice;
  private pipeline!: GPURenderPipeline;
  private uniformBuffer!: GPUBuffer;
  private sampler!: GPUSampler;
  private perFrameLayout!: GPUBindGroupLayout;
  private perRegionLayout!: GPUBindGroupLayout;
  private perFrameBindGroup: GPUBindGroup | null = null;
  private perRegionBindGroup!: GPUBindGroup;
  private canvasFormat!: GPUTextureFormat;

  private regions = new Map<number, GlassRegionState>();
  private nextId = 1;

  // ── Performance: pre-allocated buffers (avoid per-frame GC) ──
  private stagingBuffer: Float32Array;
  private regionScratch: Float32Array;
  private cachedRegionList: GlassRegionState[] = [];
  private regionListDirty = true;

  // ── Performance: rect caching ──
  private rectCacheDirty = true;
  private scrollX = 0;
  private scrollY = 0;
  private scrollListenerBound = false;

  // ── Performance metrics (dev only) ──
  private _frameCount = 0;
  private _frameTimes: number[] = [];
  private _lastMetricsLog = 0;

  constructor() {
    // Pre-allocate staging buffer for all regions + blit slot
    // Each slot = UNIFORM_STRIDE / 4 floats = 64 floats (256 bytes / 4)
    const floatsPerSlot = UNIFORM_STRIDE / 4;
    this.stagingBuffer = new Float32Array((MAX_GLASS_REGIONS + 1) * floatsPerSlot);
    this.regionScratch = new Float32Array(FLOATS_PER_REGION);
  }

  async init(device: GPUDevice, canvasFormat: GPUTextureFormat): Promise<void> {
    this.device = device;
    this.canvasFormat = canvasFormat;

    this.perFrameLayout = device.createBindGroupLayout({
      label: 'GlassRenderer perFrame',
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      ],
    });

    this.perRegionLayout = device.createBindGroupLayout({
      label: 'GlassRenderer perRegion',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform', hasDynamicOffset: true, minBindingSize: 112 },
        },
      ],
    });

    const pipelineLayout = device.createPipelineLayout({
      label: 'GlassRenderer pipeline layout',
      bindGroupLayouts: [this.perFrameLayout, this.perRegionLayout],
    });

    const shaderModule = device.createShaderModule({ label: 'GlassRenderer shader', code: glassWgsl });

    this.pipeline = await device.createRenderPipelineAsync({
      label: 'GlassRenderer pipeline',
      layout: pipelineLayout,
      vertex: { module: shaderModule, entryPoint: 'vs_main' },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{
          format: canvasFormat,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-list' },
    });

    this.sampler = device.createSampler({ label: 'GlassRenderer sampler', magFilter: 'linear', minFilter: 'linear' });

    this.uniformBuffer = device.createBuffer({
      label: 'GlassRenderer uniforms',
      size: (MAX_GLASS_REGIONS + 1) * UNIFORM_STRIDE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.perRegionBindGroup = device.createBindGroup({
      label: 'GlassRenderer perRegion bindGroup',
      layout: this.perRegionLayout,
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer, size: 112 } }],
    });

    // Bind scroll listener for rect cache invalidation
    this.bindScrollListener();
  }

  setSceneTexture(texture: GPUTexture): void {
    this.perFrameBindGroup = this.device.createBindGroup({
      label: 'GlassRenderer perFrame bindGroup',
      layout: this.perFrameLayout,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: texture.createView() },
      ],
    });
  }

  // ── Scroll/resize listener for rect cache invalidation ──

  private bindScrollListener(): void {
    if (this.scrollListenerBound) return;
    const onScrollOrResize = () => {
      this.rectCacheDirty = true;
    };
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });
    this.scrollListenerBound = true;
  }

  // ── Region management ──

  addRegion(element: HTMLElement, initialUniforms?: Partial<GlassUniforms>): number {
    if (this.regions.size >= MAX_GLASS_REGIONS) {
      throw new Error(
        `GlassRenderer: MAX_GLASS_REGIONS (${MAX_GLASS_REGIONS}) exceeded. ` +
        `Currently ${this.regions.size} active regions. ` +
        `Unmount off-screen glass components or increase MAX_GLASS_REGIONS.`
      );
    }
    const id = this.nextId++;
    const uniforms: GlassUniforms = {
      ...DEFAULT_GLASS_UNIFORMS,
      ...initialUniforms,
      tint: { ...DEFAULT_GLASS_UNIFORMS.tint, ...(initialUniforms?.tint ?? {}) },
      rect: { ...DEFAULT_GLASS_UNIFORMS.rect, ...(initialUniforms?.rect ?? {}) },
      resolution: { ...DEFAULT_GLASS_UNIFORMS.resolution, ...(initialUniforms?.resolution ?? {}) },
    };
    const region: GlassRegionState = {
      id,
      element,
      current: { ...uniforms, tint: { ...uniforms.tint }, rect: { ...uniforms.rect }, resolution: { ...uniforms.resolution } },
      target: { ...uniforms, tint: { ...uniforms.tint }, rect: { ...uniforms.rect }, resolution: { ...uniforms.resolution } },
      morphSpeed: 8,
      // Perf: cached rect from getBoundingClientRect
      cachedRect: { left: 0, top: 0, width: 0, height: 0 },
      rectDirty: true,
    };
    this.regions.set(id, region);
    this.regionListDirty = true;
    this.rectCacheDirty = true; // new region needs rect
    return id;
  }

  removeRegion(id: number): void {
    this.regions.delete(id);
    this.regionListDirty = true;
  }

  getRegion(id: number): GlassRegionState | undefined {
    return this.regions.get(id);
  }

  // ── Region setters (14 methods) ──

  setRegionParams(id: number, cornerRadius: number, blurIntensity: number, opacity: number, refractionStrength: number): void {
    const r = this.regions.get(id);
    if (!r) return;
    r.target.cornerRadius = cornerRadius;
    r.target.blurIntensity = blurIntensity;
    r.target.opacity = opacity;
    r.target.refractionStrength = refractionStrength;
  }

  setRegionTint(id: number, r: number, g: number, b: number): void {
    const region = this.regions.get(id);
    if (!region) return;
    region.target.tint = { r, g, b };
  }

  setRegionAberration(id: number, v: number): void { const r = this.regions.get(id); if (!r) return; r.target.aberration = v; }
  setRegionSpecular(id: number, v: number): void { const r = this.regions.get(id); if (!r) return; r.target.specularIntensity = v; }
  setRegionRim(id: number, v: number): void { const r = this.regions.get(id); if (!r) return; r.target.rimIntensity = v; }
  setRegionMode(id: number, v: number): void { const r = this.regions.get(id); if (!r) return; r.target.mode = v; }
  setRegionMorphSpeed(id: number, speed: number): void { const r = this.regions.get(id); if (!r) return; r.morphSpeed = speed; }
  setRegionContrast(id: number, v: number): void { const r = this.regions.get(id); if (!r) return; r.target.contrast = v; }
  setRegionSaturation(id: number, v: number): void { const r = this.regions.get(id); if (!r) return; r.target.saturation = v; }
  setRegionBlurRadius(id: number, v: number): void { const r = this.regions.get(id); if (!r) return; r.target.blurRadius = v; }
  setRegionFresnelIOR(id: number, v: number): void { const r = this.regions.get(id); if (!r) return; r.target.fresnelIOR = v; }
  setRegionFresnelExponent(id: number, v: number): void { const r = this.regions.get(id); if (!r) return; r.target.fresnelExponent = v; }
  setRegionEnvReflectionStrength(id: number, v: number): void { const r = this.regions.get(id); if (!r) return; r.target.envReflectionStrength = v; }
  setRegionGlareAngle(id: number, v: number): void { const r = this.regions.get(id); if (!r) return; r.target.glareAngle = v; }

  // ── Render ──

  render(
    canvasContext: GPUCanvasContext,
    canvasW: number,
    canvasH: number,
    dt: number,
    dpr: number,
  ): void {
    if (!this.perFrameBindGroup) return;

    const frameStart = performance.now();
    const device = this.device;

    // Use cached region list — avoid Array.from() allocation every frame
    if (this.regionListDirty) {
      this.cachedRegionList = Array.from(this.regions.values());
      this.regionListDirty = false;
    }
    const activeRegions = this.cachedRegionList;
    const regionCount = activeRegions.length;

    // ── Detect scroll change for rect cache ──
    const sx = window.scrollX;
    const sy = window.scrollY;
    if (sx !== this.scrollX || sy !== this.scrollY) {
      this.rectCacheDirty = true;
      this.scrollX = sx;
      this.scrollY = sy;
    }

    // ── Write blit uniforms to slot 0 ──
    const floatsPerSlot = UNIFORM_STRIDE / 4;
    const staging = this.stagingBuffer;
    // Clear slot 0
    staging.fill(0, 0, floatsPerSlot);
    staging[12] = canvasW;  // resolution.x
    staging[13] = canvasH;  // resolution.y
    staging[27] = dpr;      // dpr

    // ── Update per-region uniforms ──
    for (let i = 0; i < regionCount; i++) {
      const region = activeRegions[i];

      // morphLerp: skip if current ≈ target (converged)
      morphLerp(region.current, region.target, dt, region.morphSpeed);

      // Update resolution and dpr
      region.current.resolution.x = canvasW;
      region.current.resolution.y = canvasH;
      region.current.dpr = dpr;

      // ── Rect: use cached value unless dirty ──
      if (this.rectCacheDirty || region.rectDirty) {
        const el = region.element;
        const domRect = el.getBoundingClientRect();
        region.cachedRect.left = domRect.left;
        region.cachedRect.top = domRect.top;
        region.cachedRect.width = domRect.width;
        region.cachedRect.height = domRect.height;
        region.rectDirty = false;
      }

      const cr = region.cachedRect;
      region.current.rect.x = cr.left / canvasW * dpr;
      region.current.rect.y = cr.top / canvasH * dpr;
      region.current.rect.w = cr.width / canvasW * dpr;
      region.current.rect.h = cr.height / canvasH * dpr;

      // Build uniform data into pre-allocated scratch buffer
      buildGlassUniformData(region.current, this.regionScratch);

      // Copy scratch into staging at correct slot offset
      const slotOffset = (i + 1) * floatsPerSlot;
      staging.set(this.regionScratch, slotOffset);
    }

    // Clear rect dirty flag after all regions processed
    this.rectCacheDirty = false;

    // ── Single batched writeBuffer for all slots ──
    const totalBytes = (regionCount + 1) * UNIFORM_STRIDE;
    device.queue.writeBuffer(this.uniformBuffer, 0, staging.buffer, 0, totalBytes);

    // ── Encode render pass ──
    const surfaceTexture = canvasContext.getCurrentTexture();
    const encoder = device.createCommandEncoder({ label: 'GlassRenderer frame' });
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: surfaceTexture.createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
      }],
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.perFrameBindGroup);

    // Draw 1: background blit (slot 0)
    pass.setBindGroup(1, this.perRegionBindGroup, [0]);
    pass.draw(3);

    // Draws 2..N: glass regions
    for (let i = 0; i < regionCount; i++) {
      pass.setBindGroup(1, this.perRegionBindGroup, [(i + 1) * UNIFORM_STRIDE]);
      pass.draw(3);
    }

    pass.end();
    device.queue.submit([encoder.finish()]);

    // ── Performance metrics ──
    const elapsed = performance.now() - frameStart;
    this._frameCount++;
    this._frameTimes.push(elapsed);
    if (this._frameTimes.length > 60) this._frameTimes.shift();

    // Log metrics every 5 seconds in dev
    if (import.meta.env.DEV && performance.now() - this._lastMetricsLog > 5000) {
      this._lastMetricsLog = performance.now();
      const avg = this._frameTimes.reduce((a, b) => a + b, 0) / this._frameTimes.length;
      const max = Math.max(...this._frameTimes);
      console.log(
        `[GlassRenderer] regions=${regionCount} avgFrame=${avg.toFixed(2)}ms maxFrame=${max.toFixed(2)}ms fps≈${(1000 / avg).toFixed(0)}`
      );
    }
  }

  destroy(): void {
    this.uniformBuffer?.destroy();
    this.regions.clear();
    this.cachedRegionList = [];
    this.perFrameBindGroup = null;
  }
}

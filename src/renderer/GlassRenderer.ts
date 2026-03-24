import glassWgsl from './glass.wgsl?raw';
import {
  buildGlassUniformData,
  morphLerp,
  DEFAULT_GLASS_UNIFORMS,
  type GlassUniforms,
  type GlassRegionState,
} from './GlassRegionState';

const MAX_GLASS_REGIONS = 16;
const UNIFORM_STRIDE = 256; // WebGPU minUniformBufferOffsetAlignment

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

  /**
   * Initialize the renderer. Must be awaited before calling any other method.
   * @param device - The GPUDevice (owned by caller)
   * @param canvasFormat - From navigator.gpu.getPreferredCanvasFormat()
   */
  async init(device: GPUDevice, canvasFormat: GPUTextureFormat): Promise<void> {
    this.device = device;
    this.canvasFormat = canvasFormat;

    // --- Explicit two-group bind group layout (GLASS-02) ---
    // Group 0: per-frame (sampler + scene texture) -- shared across all draw calls
    this.perFrameLayout = device.createBindGroupLayout({
      label: 'GlassRenderer perFrame',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: 'filtering' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'float' },
        },
      ],
    });

    // Group 1: per-region (dynamic offset uniform buffer)
    this.perRegionLayout = device.createBindGroupLayout({
      label: 'GlassRenderer perRegion',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {
            type: 'uniform',
            hasDynamicOffset: true,
            minBindingSize: 112, // sizeof(GlassUniforms)
          },
        },
      ],
    });

    const pipelineLayout = device.createPipelineLayout({
      label: 'GlassRenderer pipeline layout',
      bindGroupLayouts: [this.perFrameLayout, this.perRegionLayout],
    });

    // --- Shader compilation (async, non-blocking) ---
    const shaderModule = device.createShaderModule({
      label: 'GlassRenderer shader',
      code: glassWgsl,
    });

    // GLASS-02: createRenderPipelineAsync -- compile once, never recreate on resize
    this.pipeline = await device.createRenderPipelineAsync({
      label: 'GlassRenderer pipeline',
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [
          {
            format: canvasFormat,
            // Alpha blending: glass regions blend over background via SDF mask alpha
            // Background blit outputs alpha=1.0 (rect.z=0 sentinel) -- no visual difference
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: { topology: 'triangle-list' },
    });

    // --- Sampler (shared, never changes) ---
    this.sampler = device.createSampler({
      label: 'GlassRenderer sampler',
      magFilter: 'linear',
      minFilter: 'linear',
    });

    // --- Uniform buffer: (MAX_REGIONS + 1) slots x 256 bytes ---
    // Slot 0: blit pass (rect.z = 0 sentinel)
    // Slots 1..MAX_REGIONS: glass regions
    this.uniformBuffer = device.createBuffer({
      label: 'GlassRenderer uniforms',
      size: (MAX_GLASS_REGIONS + 1) * UNIFORM_STRIDE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Per-region bind group: references the uniform buffer at dynamic offsets
    // This bind group never changes -- only the dynamic offset changes per draw call
    this.perRegionBindGroup = device.createBindGroup({
      label: 'GlassRenderer perRegion bindGroup',
      layout: this.perRegionLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.uniformBuffer,
            size: 112, // one GlassUniforms slot
          },
        },
      ],
    });
  }

  /**
   * Called once at init and after every engine.resize().
   * Rebuilds the per-frame bind group with the new texture view (GLASS-05).
   * The scene texture format must be 'rgba8unorm' (C++ offscreen format).
   */
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

  /**
   * Register a new glass region.
   * @param element - The DOM element for this region (used for rect computation)
   * @param initialUniforms - Optional overrides for default glass parameters
   * @returns Region ID (stable until removeRegion is called)
   */
  addRegion(element: HTMLElement, initialUniforms?: Partial<GlassUniforms>): number {
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
      morphSpeed: 8, // default: snappy
    };
    this.regions.set(id, region);
    return id;
  }

  removeRegion(id: number): void {
    this.regions.delete(id);
  }

  getRegion(id: number): GlassRegionState | undefined {
    return this.regions.get(id);
  }

  /**
   * Render one frame. Must be called from the rAF loop.
   * Encodes: (1) background blit (slot 0), (2) one glass draw per active region.
   *
   * @param canvasContext - The GPUCanvasContext (configure it once outside, not here)
   * @param canvasW - Canvas width in physical pixels
   * @param canvasH - Canvas height in physical pixels
   * @param dt - Delta time in seconds (for morphLerp)
   * @param dpr - Current devicePixelRatio
   */
  render(
    canvasContext: GPUCanvasContext,
    canvasW: number,
    canvasH: number,
    dt: number,
    dpr: number,
  ): void {
    if (!this.perFrameBindGroup) return; // setSceneTexture not yet called

    const device = this.device;
    const activeRegions = Array.from(this.regions.values());

    // --- Write blit uniforms to slot 0 (all zeros -> rect.z = 0 -> isBlit = true) ---
    const blitData = new Float32Array(28); // all zeros
    blitData[12] = canvasW;  // resolution.x
    blitData[13] = canvasH;  // resolution.y
    blitData[27] = dpr;       // dpr
    device.queue.writeBuffer(this.uniformBuffer, 0, blitData);

    // --- Update and write per-region uniforms ---
    activeRegions.forEach((region, i) => {
      // Apply exponential decay lerp: current -> target
      morphLerp(region.current, region.target, dt, region.morphSpeed);

      // Update resolution and dpr (always current frame values)
      region.current.resolution.x = canvasW;
      region.current.resolution.y = canvasH;
      region.current.dpr = dpr;

      // Sync rect from DOM element (normalized UV coordinates)
      const el = region.element;
      const rect = el.getBoundingClientRect();
      region.current.rect.x = rect.left / canvasW * dpr;
      region.current.rect.y = rect.top / canvasH * dpr;
      region.current.rect.w = rect.width / canvasW * dpr;
      region.current.rect.h = rect.height / canvasH * dpr;

      const data = buildGlassUniformData(region.current);
      device.queue.writeBuffer(
        this.uniformBuffer,
        (i + 1) * UNIFORM_STRIDE,
        data.buffer,
        data.byteOffset,
        data.byteLength,
      );
    });

    // --- Encode render pass ---
    const surfaceTexture = canvasContext.getCurrentTexture();
    const encoder = device.createCommandEncoder({ label: 'GlassRenderer frame' });
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: surfaceTexture.createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
        },
      ],
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.perFrameBindGroup);

    // Draw 1: background blit (dynamic offset = 0, slot 0)
    pass.setBindGroup(1, this.perRegionBindGroup, [0]);
    pass.draw(3);

    // Draws 2..N: glass regions (dynamic offset = (i+1) * UNIFORM_STRIDE)
    activeRegions.forEach((_, i) => {
      pass.setBindGroup(1, this.perRegionBindGroup, [(i + 1) * UNIFORM_STRIDE]);
      pass.draw(3);
    });

    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  destroy(): void {
    this.uniformBuffer?.destroy();
    this.regions.clear();
    this.perFrameBindGroup = null;
  }
}

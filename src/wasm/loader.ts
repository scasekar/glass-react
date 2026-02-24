export interface EngineInitOptions {
  /** External WebGPU device. When provided, engine uses this instead of creating its own. */
  device?: GPUDevice;
}

export interface EngineModule {
  getEngine(): {
    resize(w: number, h: number): void;
    addGlassRegion(): number;
    removeGlassRegion(id: number): void;
    setRegionRect(id: number, x: number, y: number, w: number, h: number): void;
    setRegionParams(id: number, cornerRadius: number, blur: number, opacity: number, refraction: number): void;
    setRegionTint(id: number, r: number, g: number, b: number): void;
    setRegionAberration(id: number, aberration: number): void;
    setRegionSpecular(id: number, intensity: number): void;
    setRegionRim(id: number, intensity: number): void;
    setRegionMode(id: number, mode: number): void;
    setRegionMorphSpeed(id: number, speed: number): void;
    setPaused(paused: boolean): void;
    setReducedTransparency(enabled: boolean): void;
    setExternalTextureMode(enabled: boolean): void;
    getBackgroundTextureHandle(): number;
    update(deltaTime: number): void;
    render(): void;
  } | null;
  destroyEngine(): void;
  /** Emscripten WebGPU manager (for texture handle interop) */
  WebGPU?: {
    mgrTexture: {
      get(handle: number): GPUTexture;
    };
  };
}

export async function initEngine(options?: EngineInitOptions): Promise<EngineModule> {
  if (!navigator.gpu) {
    throw new Error('WebGPU is not supported in this browser. Use Chrome 113+ or Edge 113+.');
  }

  // MODULARIZE=1 + EXPORT_ES6=1 makes the Emscripten output an ESM factory function
  // @ts-expect-error -- Emscripten generated module, no type declarations
  const createEngineModule = (await import('../../engine/build-web/engine.js')).default;

  const config: Record<string, unknown> = {};
  if (options?.device) {
    config.preinitializedWebGPUDevice = options.device;
  }

  const module = await createEngineModule(config);
  return module as EngineModule;
}

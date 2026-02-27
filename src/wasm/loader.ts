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
    setRegionContrast(id: number, contrast: number): void;
    setRegionSaturation(id: number, saturation: number): void;
    setRegionFresnelIOR(id: number, ior: number): void;
    setRegionFresnelExponent(id: number, exponent: number): void;
    setRegionEnvReflectionStrength(id: number, strength: number): void;
    setRegionGlareAngle(id: number, angle: number): void;
    setRegionBlurRadius(id: number, radius: number): void;
    setPaused(paused: boolean): void;
    setReducedTransparency(enabled: boolean): void;
    setExternalTextureMode(enabled: boolean): void;
    update(deltaTime: number): void;
    render(): void;
  } | null;
  destroyEngine(): void;

  // Lifecycle
  setExternalDeviceMode(): void;
  initWithExternalDevice(handle: number): void;

  // Image background upload
  uploadImageData(pixelPtr: number, width: number, height: number): void;
  setBackgroundMode(mode: number): void; // 0 = Image, 1 = Noise
  setExternalTextureMode(enabled: boolean): void;
  getBackgroundTextureHandle(): number;

  // Emscripten heap access for pixel data transfer
  _malloc(size: number): number;
  _free(ptr: number): void;
  HEAPU8: Uint8Array;

  /** emdawnwebgpu interop — for injecting/resolving JS WebGPU objects */
  WebGPU?: {
    Internals: {
      jsObjectInsert(obj: unknown): number;
      jsObjects: Record<number, unknown>;
    };
    getJsObject(handle: number): unknown;
  };
}

export async function initEngine(options?: EngineInitOptions): Promise<EngineModule> {
  if (!navigator.gpu) {
    throw new Error('WebGPU is not supported in this browser. Use Chrome 113+ or Edge 113+.');
  }

  // MODULARIZE=1 + EXPORT_ES6=1 makes the Emscripten output an ESM factory function
  // @ts-expect-error -- Emscripten generated module, no type declarations
  const createEngineModule = (await import('../../engine/build-web/engine.js')).default;

  // When an external device is provided, tell the C++ main() to skip standalone
  // init. We do this via a preRun hook that fires before main().
  const moduleOptions: Record<string, unknown> = {};
  if (options?.device) {
    moduleOptions.preRun = [(mod: EngineModule) => {
      mod.setExternalDeviceMode();
    }];
  }

  const module = await createEngineModule(moduleOptions) as EngineModule;

  // If external device was provided, inject it into emdawnwebgpu's object table
  // and call C++ initWithExternalDevice(handle).
  if (options?.device && module.WebGPU?.Internals?.jsObjectInsert) {
    const handle = module.WebGPU.Internals.jsObjectInsert(options.device);
    module.initWithExternalDevice(handle);
  }

  return module;
}

export interface EngineModule {
  getEngine(): {
    resize(w: number, h: number): void;
    renderBackground(): void;
    setDpr(dpr: number): void;
    setPaused(paused: boolean): void;
    setReducedTransparency(enabled: boolean): void;
    setExternalTextureMode(enabled: boolean): void;
    update(deltaTime: number): void;
  } | null;
  destroyEngine(): void;

  // Lifecycle
  initWithExternalDevice(handle: number): void;

  // Image background upload
  uploadImageData(pixelPtr: number, width: number, height: number): void;
  setBackgroundMode(mode: number): void; // 0 = Image, 1 = Noise
  setExternalTextureMode(enabled: boolean): void;
  getSceneTextureHandle(): number;

  // Emscripten heap access for pixel data transfer
  _malloc(size: number): number;
  _free(ptr: number): void;
  HEAPU8: Uint8Array;

  /** emdawnwebgpu interop — for injecting/resolving JS WebGPU objects */
  WebGPU?: {
    Internals: {
      jsObjectInsert(ptr: number, obj: unknown): void;
      jsObjects: Record<number, unknown>;
    };
    importJsDevice(device: GPUDevice, parentPtr?: number): number;
    importJsTexture(texture: GPUTexture, parentPtr?: number): number;
    getJsObject(handle: number): unknown;
  };
}

export async function initEngine(device: GPUDevice): Promise<EngineModule> {
  if (!navigator.gpu) {
    throw new Error('WebGPU is not supported in this browser. Use Chrome 113+ or Edge 113+.');
  }

  // MODULARIZE=1 + EXPORT_ES6=1 makes the Emscripten output an ESM factory function
  // @ts-expect-error -- Emscripten generated module, no type declarations
  const createEngineModule = (await import('../../engine/build-web/engine.js')).default;

  // v3.0: always external device mode — JS owns the GPUDevice
  const module = await createEngineModule({ externalDeviceMode: true }) as EngineModule;

  const handle = module.WebGPU!.importJsDevice(device);
  module.initWithExternalDevice(handle);

  return module;
}

export function getSceneTexture(module: EngineModule): GPUTexture | null {
  const handle = module.getSceneTextureHandle();
  if (!handle) return null;
  return module.WebGPU!.getJsObject(handle) as GPUTexture;
}

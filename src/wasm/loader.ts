export interface EngineModule {
  getEngine(): {
    resize(w: number, h: number): void;
    setGlassRect(x: number, y: number, w: number, h: number): void;
    setGlassParams(cornerRadius: number, blur: number, opacity: number, refraction: number): void;
    setGlassTint(r: number, g: number, b: number): void;
  } | null;
  destroyEngine(): void;
}

export async function initEngine(): Promise<EngineModule> {
  if (!navigator.gpu) {
    throw new Error('WebGPU is not supported in this browser. Use Chrome 113+ or Edge 113+.');
  }

  // MODULARIZE=1 + EXPORT_ES6=1 makes the Emscripten output an ESM factory function
  // @ts-expect-error -- Emscripten generated module, no type declarations
  const createEngineModule = (await import('../../engine/build-web/engine.js')).default;
  const module = await createEngineModule();
  return module as EngineModule;
}

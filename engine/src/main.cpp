#include <iostream>
#include <string_view>
#include <webgpu/webgpu_cpp.h>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#include <emscripten/bind.h>
#endif

#include "background_engine.h"

// Global state
BackgroundEngine* g_engine = nullptr;

int main() {
    // v3.0: JS creates GPUDevice and calls initWithExternalDevice().
    // No standalone adapter/device creation. No main loop.
    return 0;
}

// --- Embind bindings ---
#ifdef __EMSCRIPTEN__

// Legacy embind shim — kept for API compatibility; the real flag is now
// Module.externalDeviceMode read in main() via EM_ASM.
void setExternalDeviceMode() {
    // no-op: flag is read directly from Module.externalDeviceMode in main()
}

// Called by JS after inserting the host device into emdawnwebgpu.
// The WGPUDevice handle comes from WebGPU.Internals.jsObjectInsert(gpuDevice).
void initWithExternalDevice(uintptr_t deviceHandle) {
    wgpu::Device device = wgpu::Device::Acquire(reinterpret_cast<WGPUDevice>(deviceHandle));
    g_engine = new BackgroundEngine();
    g_engine->init(device, 512, 512);
    std::cout << "BackgroundEngine initialized (external device)" << std::endl;
}

BackgroundEngine* getEngine() { return g_engine; }

void destroyEngine() {
    if (g_engine) {
        delete g_engine;
        g_engine = nullptr;
    }
}

void uploadImageDataJS(uintptr_t pixelPtr, uint32_t width, uint32_t height) {
    if (!g_engine) return;
    g_engine->uploadImageData(reinterpret_cast<const uint8_t*>(pixelPtr), width, height);
}

void setBackgroundModeJS(int mode) {
    if (!g_engine) return;
    g_engine->setBackgroundMode(static_cast<BackgroundMode>(mode));
}

void setExternalTextureModeJS(bool enabled) {
    if (!g_engine) return;
    g_engine->setExternalTextureMode(enabled);
}

// Returns the emdawnwebgpu handle for the offscreen scene texture.
// The JavaScript side resolves this via WebGPU.getJsObject(handle).
uintptr_t getSceneTextureHandleJS() {
    if (!g_engine) return 0;
    wgpu::Texture tex = g_engine->getSceneTexture();
    wgpu::Texture clone = tex;      // copy increments ref
    return reinterpret_cast<uintptr_t>(clone.MoveToCHandle());
}

EMSCRIPTEN_BINDINGS(background_engine) {
    emscripten::function("setExternalDeviceMode", &setExternalDeviceMode);
    emscripten::function("initWithExternalDevice", &initWithExternalDevice);
    emscripten::function("getEngine", &getEngine, emscripten::allow_raw_pointers());
    emscripten::function("destroyEngine", &destroyEngine);
    emscripten::function("uploadImageData", &uploadImageDataJS);
    emscripten::function("setBackgroundMode", &setBackgroundModeJS);
    emscripten::function("setExternalTextureMode", &setExternalTextureModeJS);
    emscripten::function("getSceneTextureHandle", &getSceneTextureHandleJS);
    emscripten::class_<BackgroundEngine>("BackgroundEngine")
        .function("resize", &BackgroundEngine::resize)
        .function("setDpr", &BackgroundEngine::setDpr)
        .function("setPaused", &BackgroundEngine::setPaused)
        .function("setReducedTransparency", &BackgroundEngine::setReducedTransparency)
        .function("setExternalTextureMode", &BackgroundEngine::setExternalTextureMode)
        .function("update", &BackgroundEngine::update)
        .function("renderBackground", &BackgroundEngine::renderBackground);
}
#endif

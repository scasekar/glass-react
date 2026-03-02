#include <iostream>
#include <string_view>
#include <webgpu/webgpu_cpp.h>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#include <emscripten/html5.h>
#include <emscripten/bind.h>
#endif

#include "background_engine.h"

// Global state
BackgroundEngine* g_engine = nullptr;
wgpu::Adapter g_adapter;

// Delta time tracking
static double lastTime = 0.0;

void MainLoop() {
    if (!g_engine) return;

    double now = emscripten_get_now();  // milliseconds
    if (lastTime == 0.0) {
        // First frame: initialize lastTime and skip to avoid huge dt
        lastTime = now;
        return;
    }

    float dt = static_cast<float>((now - lastTime) / 1000.0);  // convert to seconds
    lastTime = now;

    // Cap delta time to prevent jumps on tab switch
    if (dt > 0.1f) dt = 0.1f;

    g_engine->update(dt);
    g_engine->render();
}

void OnDeviceAcquired(wgpu::RequestDeviceStatus status, wgpu::Device device,
                      wgpu::StringView msg) {
    if (status != wgpu::RequestDeviceStatus::Success) {
        std::cerr << "RequestDevice failed: " << std::string_view(msg.data, msg.length) << "\n";
        return;
    }
    std::cout << "WebGPU device acquired successfully" << std::endl;

    // Create surface from canvas
    wgpu::Instance instance = wgpu::CreateInstance();
    wgpu::SurfaceDescriptor surfaceDesc{};
#ifdef __EMSCRIPTEN__
    wgpu::EmscriptenSurfaceSourceCanvasHTMLSelector canvasSource{};
    canvasSource.selector = "#gpu-canvas";
    surfaceDesc.nextInChain = &canvasSource;
#endif
    wgpu::Surface surface = instance.CreateSurface(&surfaceDesc);

    // Get surface format from adapter capabilities
    wgpu::SurfaceCapabilities capabilities;
    surface.GetCapabilities(g_adapter, &capabilities);
    wgpu::TextureFormat format = capabilities.formats[0];

    // Configure surface with initial dimensions
    wgpu::SurfaceConfiguration config{};
    config.device = device;
    config.format = format;
    config.width = 512;
    config.height = 512;
    surface.Configure(&config);

    // Create and initialize the background engine
    g_engine = new BackgroundEngine();
    g_engine->init(device, surface, format, 512, 512);

    std::cout << "BackgroundEngine initialized" << std::endl;
}

void OnAdapterAcquired(wgpu::RequestAdapterStatus status, wgpu::Adapter adapter,
                       wgpu::StringView msg) {
    if (status != wgpu::RequestAdapterStatus::Success) {
        std::cerr << "RequestAdapter failed: " << std::string_view(msg.data, msg.length) << "\n";
        return;
    }
    g_adapter = std::move(adapter);

    wgpu::DeviceDescriptor devDesc{};
    devDesc.SetUncapturedErrorCallback(
        [](const wgpu::Device&, wgpu::ErrorType type, wgpu::StringView msg) {
            std::cerr << "Device error: " << static_cast<int>(type)
                      << " - " << std::string_view(msg.data, msg.length) << "\n";
        });
    g_adapter.RequestDevice(&devDesc, wgpu::CallbackMode::AllowSpontaneous,
                            OnDeviceAcquired);
}

int main() {
    // Check if JS set Module.externalDeviceMode = true before initialization
    bool g_useExternalDevice = EM_ASM_INT({ return Module.externalDeviceMode ? 1 : 0; });
    if (g_useExternalDevice) {
        // External device mode: JS will call initWithExternalDevice() after
        // injecting the host GPUDevice into the emdawnwebgpu object table.
        // Just start the main loop; engine init happens later.
#ifdef __EMSCRIPTEN__
        emscripten_set_main_loop(MainLoop, 0, false);
#endif
        return 0;
    }

    // Standalone mode: create our own adapter/device
    wgpu::Instance instance = wgpu::CreateInstance();
    instance.RequestAdapter(nullptr, wgpu::CallbackMode::AllowSpontaneous,
                            OnAdapterAcquired);

#ifdef __EMSCRIPTEN__
    emscripten_set_main_loop(MainLoop, 0, false);
#endif
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
    // Convert handle to wgpu::Device via the C API bridge
    wgpu::Device device = wgpu::Device::Acquire(reinterpret_cast<WGPUDevice>(deviceHandle));

    // Create surface from the glass canvas
    wgpu::Instance instance = wgpu::CreateInstance();
    wgpu::SurfaceDescriptor surfaceDesc{};
    wgpu::EmscriptenSurfaceSourceCanvasHTMLSelector canvasSource{};
    canvasSource.selector = "#gpu-canvas";
    surfaceDesc.nextInChain = &canvasSource;
    wgpu::Surface surface = instance.CreateSurface(&surfaceDesc);

    // BGRA8Unorm is the standard WebGPU surface format
    wgpu::TextureFormat format = wgpu::TextureFormat::BGRA8Unorm;

    wgpu::SurfaceConfiguration config{};
    config.device = device;
    config.format = format;
    config.width = 512;
    config.height = 512;
    surface.Configure(&config);

    g_engine = new BackgroundEngine();
    g_engine->init(device, surface, format, 512, 512);

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

// Returns the emdawnwebgpu handle for the offscreen background texture.
// The JavaScript side resolves this via WebGPU.getJsObject(handle).
uintptr_t getBackgroundTextureHandleJS() {
    if (!g_engine) return 0;
    wgpu::Texture tex = g_engine->getBackgroundTexture();
    wgpu::Texture clone = tex;      // copy increments ref
    return reinterpret_cast<uintptr_t>(clone.MoveToCHandle());
}

// Inject an external background texture directly (no copy needed).
// The handle comes from JS via WebGPU.importJsTexture(gpuTexture).
void setExternalBackgroundTextureJS(uintptr_t textureHandle) {
    if (!g_engine) return;
    if (!textureHandle) {
        g_engine->setExternalBackgroundTexture(nullptr);
        return;
    }
    wgpu::Texture tex = wgpu::Texture::Acquire(reinterpret_cast<WGPUTexture>(textureHandle));
    g_engine->setExternalBackgroundTexture(tex);
}

EMSCRIPTEN_BINDINGS(background_engine) {
    emscripten::function("setExternalDeviceMode", &setExternalDeviceMode);
    emscripten::function("initWithExternalDevice", &initWithExternalDevice);
    emscripten::function("getEngine", &getEngine, emscripten::allow_raw_pointers());
    emscripten::function("destroyEngine", &destroyEngine);
    emscripten::function("uploadImageData", &uploadImageDataJS);
    emscripten::function("setBackgroundMode", &setBackgroundModeJS);
    emscripten::function("setExternalTextureMode", &setExternalTextureModeJS);
    emscripten::function("getBackgroundTextureHandle", &getBackgroundTextureHandleJS);
    emscripten::function("setExternalBackgroundTexture", &setExternalBackgroundTextureJS);
    emscripten::class_<BackgroundEngine>("BackgroundEngine")
        .function("resize", &BackgroundEngine::resize)
        .function("addGlassRegion", &BackgroundEngine::addGlassRegion)
        .function("removeGlassRegion", &BackgroundEngine::removeGlassRegion)
        .function("setRegionRect", &BackgroundEngine::setRegionRect)
        .function("setRegionParams", &BackgroundEngine::setRegionParams)
        .function("setRegionTint", &BackgroundEngine::setRegionTint)
        .function("setRegionAberration", &BackgroundEngine::setRegionAberration)
        .function("setRegionSpecular", &BackgroundEngine::setRegionSpecular)
        .function("setRegionRim", &BackgroundEngine::setRegionRim)
        .function("setRegionMode", &BackgroundEngine::setRegionMode)
        .function("setRegionMorphSpeed", &BackgroundEngine::setRegionMorphSpeed)
        .function("setRegionContrast", &BackgroundEngine::setRegionContrast)
        .function("setRegionSaturation", &BackgroundEngine::setRegionSaturation)
        .function("setRegionFresnelIOR", &BackgroundEngine::setRegionFresnelIOR)
        .function("setRegionFresnelExponent", &BackgroundEngine::setRegionFresnelExponent)
        .function("setRegionEnvReflectionStrength", &BackgroundEngine::setRegionEnvReflectionStrength)
        .function("setRegionGlareAngle", &BackgroundEngine::setRegionGlareAngle)
        .function("setRegionBlurRadius", &BackgroundEngine::setRegionBlurRadius)
        .function("setDpr", &BackgroundEngine::setDpr)
        .function("setPaused", &BackgroundEngine::setPaused)
        .function("setReducedTransparency", &BackgroundEngine::setReducedTransparency)
        .function("setExternalTextureMode", &BackgroundEngine::setExternalTextureMode)
        .function("update", &BackgroundEngine::update)
        .function("render", &BackgroundEngine::render);
}
#endif

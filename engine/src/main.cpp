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
BackgroundEngine* getEngine() { return g_engine; }

EMSCRIPTEN_BINDINGS(background_engine) {
    emscripten::function("getEngine", &getEngine, emscripten::allow_raw_pointers());
    emscripten::class_<BackgroundEngine>("BackgroundEngine")
        .function("resize", &BackgroundEngine::resize);
}
#endif

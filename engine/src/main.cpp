#include <iostream>
#include <string_view>
#include <webgpu/webgpu_cpp.h>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#include <emscripten/html5.h>
#endif

wgpu::Instance instance;
wgpu::Adapter adapter;
wgpu::Device device;
wgpu::Surface surface;
wgpu::TextureFormat format;
bool initComplete = false;

void Render() {
    wgpu::SurfaceTexture surfaceTexture;
    surface.GetCurrentTexture(&surfaceTexture);

    wgpu::RenderPassColorAttachment attachment{
        .view = surfaceTexture.texture.CreateView(),
        .loadOp = wgpu::LoadOp::Clear,
        .storeOp = wgpu::StoreOp::Store,
        .clearValue = {0.0f, 0.5f, 0.8f, 1.0f}
    };

    wgpu::RenderPassDescriptor renderpass{
        .colorAttachmentCount = 1,
        .colorAttachments = &attachment
    };

    wgpu::CommandEncoder encoder = device.CreateCommandEncoder();
    wgpu::RenderPassEncoder pass = encoder.BeginRenderPass(&renderpass);
    pass.End();
    wgpu::CommandBuffer commands = encoder.Finish();
    device.GetQueue().Submit(1, &commands);

#ifndef __EMSCRIPTEN__
    surface.Present();
    instance.ProcessEvents();
#endif
}

void InitGraphics() {
    wgpu::SurfaceDescriptor surfaceDesc{};
#ifdef __EMSCRIPTEN__
    wgpu::EmscriptenSurfaceSourceCanvasHTMLSelector canvasSource{};
    canvasSource.selector = "#gpu-canvas";
    surfaceDesc.nextInChain = &canvasSource;
#endif
    surface = instance.CreateSurface(&surfaceDesc);

    wgpu::SurfaceCapabilities capabilities;
    surface.GetCapabilities(adapter, &capabilities);
    format = capabilities.formats[0];

    wgpu::SurfaceConfiguration config{
        .device = device,
        .format = format,
        .width = 512,
        .height = 512
    };
    surface.Configure(&config);
}

void MainLoop() {
    if (!initComplete) {
        return;
    }
    Render();
}

void OnDeviceAcquired(wgpu::RequestDeviceStatus status, wgpu::Device d,
                      wgpu::StringView msg) {
    if (status != wgpu::RequestDeviceStatus::Success) {
        std::cerr << "RequestDevice failed: " << std::string_view(msg.data, msg.length) << "\n";
        return;
    }
    device = std::move(d);
    std::cout << "WebGPU device acquired successfully" << std::endl;
    InitGraphics();
    initComplete = true;
}

void OnAdapterAcquired(wgpu::RequestAdapterStatus status, wgpu::Adapter a,
                       wgpu::StringView msg) {
    if (status != wgpu::RequestAdapterStatus::Success) {
        std::cerr << "RequestAdapter failed: " << std::string_view(msg.data, msg.length) << "\n";
        return;
    }
    adapter = std::move(a);

    wgpu::DeviceDescriptor devDesc{};
    devDesc.SetUncapturedErrorCallback(
        [](const wgpu::Device&, wgpu::ErrorType type, wgpu::StringView msg) {
            std::cerr << "Device error: " << static_cast<int>(type)
                      << " - " << std::string_view(msg.data, msg.length) << "\n";
        });
    adapter.RequestDevice(&devDesc, wgpu::CallbackMode::AllowSpontaneous,
                          OnDeviceAcquired);
}

int main() {
    instance = wgpu::CreateInstance();
    instance.RequestAdapter(nullptr, wgpu::CallbackMode::AllowSpontaneous,
                            OnAdapterAcquired);

#ifdef __EMSCRIPTEN__
    emscripten_set_main_loop(MainLoop, 0, false);
#else
    while (true) { Render(); }
#endif
    return 0;
}

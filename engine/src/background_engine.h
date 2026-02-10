#pragma once
#include <webgpu/webgpu_cpp.h>
#include <cstdint>

struct Uniforms {
    float time;
    float _pad1;
    float resolutionX;
    float resolutionY;
};

class BackgroundEngine {
public:
    BackgroundEngine();
    ~BackgroundEngine();
    void init(wgpu::Device dev, wgpu::Surface surf, wgpu::TextureFormat fmt, uint32_t w, uint32_t h);
    void update(float deltaTime);
    void render();
    void resize(uint32_t newWidth, uint32_t newHeight);
private:
    void createPipeline();
    void createUniforms();
    wgpu::Device device;
    wgpu::Surface surface;
    wgpu::TextureFormat surfaceFormat;
    wgpu::ShaderModule shaderModule;
    wgpu::RenderPipeline pipeline;
    wgpu::BindGroupLayout bindGroupLayout;
    wgpu::BindGroup bindGroup;
    wgpu::Buffer uniformBuffer;
    uint32_t width = 0;
    uint32_t height = 0;
    float currentTime = 0.0f;
};

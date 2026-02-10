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
    void createNoisePipeline();
    void createUniforms();
    void createOffscreenTexture();
    void createBlitPipeline();
    void createBlitBindGroup();

    wgpu::Device device;
    wgpu::Surface surface;
    wgpu::TextureFormat surfaceFormat;
    uint32_t width = 0;
    uint32_t height = 0;
    float currentTime = 0.0f;

    // Noise pass (Pass 1: render noise to offscreen texture)
    wgpu::ShaderModule noiseShaderModule;
    wgpu::RenderPipeline noisePipeline;
    wgpu::BindGroupLayout noiseBindGroupLayout;
    wgpu::BindGroup noiseBindGroup;
    wgpu::Buffer uniformBuffer;

    // Offscreen texture (target for Pass 1, sampled by Pass 2)
    wgpu::Texture offscreenTexture;
    wgpu::TextureView offscreenTextureView;

    // Blit pass (Pass 2: blit offscreen texture to surface)
    wgpu::Sampler blitSampler;
    wgpu::ShaderModule blitShaderModule;
    wgpu::RenderPipeline blitPipeline;
    wgpu::BindGroupLayout blitBindGroupLayout;
    wgpu::BindGroup blitBindGroup;
};

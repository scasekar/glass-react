#pragma once
#include <webgpu/webgpu_cpp.h>
#include <cstdint>

struct Uniforms {
    float time;
    float _pad1;
    float resolutionX;
    float resolutionY;
};

struct GlassUniforms {
    float rectX, rectY, rectW, rectH;           // offset 0-15 (vec4f)
    float cornerRadius;                          // offset 16
    float blurIntensity;                         // offset 20
    float opacity;                               // offset 24
    float refractionStrength;                    // offset 28
    float tintR, tintG, tintB;                   // offset 32-43
    float aberration;                            // offset 44 — chromatic aberration (pixels)
    float resolutionX, resolutionY;              // offset 48-52
    float _pad2, _pad3;                          // offset 56-60
};
// Total: 64 bytes (4 x vec4f aligned)

class BackgroundEngine {
public:
    BackgroundEngine();
    ~BackgroundEngine();
    void init(wgpu::Device dev, wgpu::Surface surf, wgpu::TextureFormat fmt, uint32_t w, uint32_t h);
    void update(float deltaTime);
    void render();
    void resize(uint32_t newWidth, uint32_t newHeight);

    void setGlassRect(float x, float y, float w, float h);
    void setGlassParams(float cornerRadius, float blur, float opacity, float refraction);
    void setGlassTint(float r, float g, float b);

private:
    void createNoisePipeline();
    void createUniforms();
    void createOffscreenTexture();
    void createGlassPipeline();
    void createGlassBindGroup();

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

    // Glass pass (Pass 2: glass effect from offscreen texture to surface)
    wgpu::Sampler glassSampler;
    wgpu::ShaderModule glassShaderModule;
    wgpu::RenderPipeline glassPipeline;
    wgpu::BindGroupLayout glassBindGroupLayout;
    wgpu::BindGroup glassBindGroup;
    wgpu::Buffer glassUniformBuffer;
    GlassUniforms glassUniforms{};
};

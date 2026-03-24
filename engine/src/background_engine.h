#pragma once
#include <webgpu/webgpu_cpp.h>
#include <cstdint>
#include <cmath>

struct Uniforms {
    float time;
    float _pad1;
    float resolutionX;
    float resolutionY;
};

enum class BackgroundMode : int { Image = 0, Noise = 1 };

class BackgroundEngine {
public:
    BackgroundEngine();
    ~BackgroundEngine();
    void init(wgpu::Device dev, uint32_t w, uint32_t h);
    void update(float deltaTime);
    void renderBackground();
    void resize(uint32_t newWidth, uint32_t newHeight);

    void setPaused(bool paused);
    void setReducedTransparency(bool enabled);
    void setDpr(float dpr);

    void uploadImageData(const uint8_t* pixels, uint32_t imgWidth, uint32_t imgHeight);
    void setBackgroundMode(BackgroundMode mode);

    // External texture mode: host app provides background via getSceneTexture()
    void setExternalTextureMode(bool enabled);
    wgpu::Texture getSceneTexture() const { return offscreenTexture; }

private:
    void createNoisePipeline();
    void createImageBlitPipeline();
    void createImageBlitBindGroup();
    void createUniforms();
    void createOffscreenTexture();

    wgpu::Device device;
    uint32_t width = 0;
    uint32_t height = 0;
    float currentTime = 0.0f;

    // Noise pass (Pass 1: render noise to offscreen texture)
    wgpu::ShaderModule noiseShaderModule;
    wgpu::RenderPipeline noisePipeline;
    wgpu::BindGroupLayout noiseBindGroupLayout;
    wgpu::BindGroup noiseBindGroup;
    wgpu::Buffer uniformBuffer;

    // Offscreen texture (background render target)
    wgpu::Texture offscreenTexture;
    wgpu::TextureView offscreenTextureView;

    // Image mode (Pass 1 alternative: blit image texture to offscreen texture)
    BackgroundMode backgroundMode_ = BackgroundMode::Image;  // Image is the new default
    bool hasImageTexture_ = false;
    wgpu::Texture imageTexture_;
    wgpu::TextureView imageTextureView_;
    wgpu::ShaderModule imageBlitShaderModule_;
    wgpu::RenderPipeline imageBlitPipeline_;
    wgpu::BindGroupLayout imageBlitBindGroupLayout_;
    wgpu::BindGroup imageBlitBindGroup_;
    wgpu::Sampler imageBlitSampler_;

    float dpr_ = 1.0f;
    bool paused_ = false;
    bool reducedTransparency_ = false;
    bool externalTextureMode_ = false;
};

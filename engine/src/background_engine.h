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
    float resolutionX, resolutionY;              // offset 48-55
    float specularIntensity;                     // offset 56
    float rimIntensity;                          // offset 60
    // --- New 16-byte block ---
    float mode;                                  // offset 64 (0.0=standard, 1.0=prominent)
    float _pad4, _pad5, _pad6;                   // offset 68-79 (padding to 16-byte boundary)
};
// Total: 80 bytes (5 x vec4f aligned)

static constexpr uint32_t MAX_GLASS_REGIONS = 16;

struct GlassRegion {
    GlassUniforms uniforms{};
    bool active = false;
};

class BackgroundEngine {
public:
    BackgroundEngine();
    ~BackgroundEngine();
    void init(wgpu::Device dev, wgpu::Surface surf, wgpu::TextureFormat fmt, uint32_t w, uint32_t h);
    void update(float deltaTime);
    void render();
    void resize(uint32_t newWidth, uint32_t newHeight);

    int addGlassRegion();
    void removeGlassRegion(int id);
    void setRegionRect(int id, float x, float y, float w, float h);
    void setRegionParams(int id, float cornerRadius, float blur, float opacity, float refraction);
    void setRegionTint(int id, float r, float g, float b);
    void setRegionAberration(int id, float aberration);
    void setRegionSpecular(int id, float intensity);
    void setRegionRim(int id, float intensity);
    void setRegionMode(int id, float mode);

    void setPaused(bool paused);
    void setReducedTransparency(bool enabled);

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
    GlassRegion regions[MAX_GLASS_REGIONS]{};
    uint32_t uniformStride = 0;

    bool paused_ = false;
    bool reducedTransparency_ = false;
};

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
    // --- New vec4f block 6 (offset 80-95) ---
    float contrast;                              // offset 80: contrast multiplier (default 0.85)
    float saturation;                            // offset 84: saturation multiplier (default 1.4)
    float fresnelIOR;                            // offset 88: index of refraction (default 1.5)
    float fresnelExponent;                       // offset 92: Fresnel fall-off exponent (default 5.0)
    // --- New vec4f block 7 (offset 96-111) ---
    float envReflectionStrength;                 // offset 96: ambient reflection strength (default 0.12)
    float glareAngle;                            // offset 100: light direction in radians (default -PI/4)
    float blurRadius;                            // offset 104: blur radius in pixels (default 15.0)
    float _pad7;                                 // offset 108: padding to 112 bytes (7 x 16)
};
// Total: 112 bytes (7 x vec4f aligned)

static constexpr uint32_t MAX_GLASS_REGIONS = 16;

struct GlassRegion {
    GlassUniforms current{};   // What the shader reads this frame
    GlassUniforms target{};    // Where parameters are heading
    float morphSpeed = 8.0f;   // Lerp speed (0=instant, 8=default ~0.4s to 95%)
    bool active = false;
};

enum class BackgroundMode : int { Image = 0, Noise = 1 };

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
    void setRegionMorphSpeed(int id, float speed);
    void setRegionContrast(int id, float contrast);
    void setRegionSaturation(int id, float saturation);
    void setRegionFresnelIOR(int id, float ior);
    void setRegionFresnelExponent(int id, float exponent);
    void setRegionEnvReflectionStrength(int id, float strength);
    void setRegionGlareAngle(int id, float angle);
    void setRegionBlurRadius(int id, float radius);

    void setPaused(bool paused);
    void setReducedTransparency(bool enabled);

    void uploadImageData(const uint8_t* pixels, uint32_t imgWidth, uint32_t imgHeight);
    void setBackgroundMode(BackgroundMode mode);

    // External texture mode: host app provides background via getBackgroundTexture()
    void setExternalTextureMode(bool enabled);
    wgpu::Texture getBackgroundTexture() const { return offscreenTexture; }

private:
    static void lerpUniforms(GlassUniforms& current, const GlassUniforms& target, float t);
    void createNoisePipeline();
    void createImageBlitPipeline();
    void createImageBlitBindGroup();
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

    bool paused_ = false;
    bool reducedTransparency_ = false;
    bool externalTextureMode_ = false;
};

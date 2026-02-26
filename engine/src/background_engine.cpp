#include "background_engine.h"
#include "shaders/noise.wgsl.h"
#include "shaders/image_blit.wgsl.h"
#include "shaders/glass.wgsl.h"
#include <iostream>
#include <string_view>
#include <cmath>
#include <vector>
#include <cstring>

namespace {
inline uint32_t ceilToNextMultiple(uint32_t value, uint32_t alignment) {
    return (value + alignment - 1) / alignment * alignment;
}
} // anonymous namespace

BackgroundEngine::BackgroundEngine() = default;
BackgroundEngine::~BackgroundEngine() = default;

void BackgroundEngine::init(wgpu::Device dev, wgpu::Surface surf,
                            wgpu::TextureFormat fmt, uint32_t w, uint32_t h) {
    device = std::move(dev);
    surface = std::move(surf);
    surfaceFormat = fmt;
    width = w;
    height = h;
    // Query device limits for uniform buffer alignment
    wgpu::Limits limits;
    device.GetLimits(&limits);
    uniformStride = ceilToNextMultiple(
        static_cast<uint32_t>(sizeof(GlassUniforms)),
        static_cast<uint32_t>(limits.minUniformBufferOffsetAlignment)
    );

    createNoisePipeline();
    createImageBlitPipeline();
    createUniforms();
    createGlassPipeline();
    createOffscreenTexture();
}

void BackgroundEngine::createNoisePipeline() {
    // Shader module using wgpu::ShaderSourceWGSL (NOT old ShaderModuleWGSLDescriptor)
    wgpu::ShaderSourceWGSL wgslSource{};
    wgslSource.code = noiseShaderCode;

    wgpu::ShaderModuleDescriptor shaderDesc{};
    shaderDesc.nextInChain = &wgslSource;
    noiseShaderModule = device.CreateShaderModule(&shaderDesc);

    // Explicit bind group layout: one uniform buffer at binding 0
    wgpu::BindGroupLayoutEntry layoutEntry{};
    layoutEntry.binding = 0;
    layoutEntry.visibility = wgpu::ShaderStage::Vertex | wgpu::ShaderStage::Fragment;
    layoutEntry.buffer.type = wgpu::BufferBindingType::Uniform;
    layoutEntry.buffer.minBindingSize = sizeof(Uniforms);

    wgpu::BindGroupLayoutDescriptor bglDesc{};
    bglDesc.entryCount = 1;
    bglDesc.entries = &layoutEntry;
    noiseBindGroupLayout = device.CreateBindGroupLayout(&bglDesc);

    // Pipeline layout from bind group layout
    wgpu::PipelineLayoutDescriptor pipelineLayoutDesc{};
    pipelineLayoutDesc.bindGroupLayoutCount = 1;
    pipelineLayoutDesc.bindGroupLayouts = &noiseBindGroupLayout;
    wgpu::PipelineLayout pipelineLayout = device.CreatePipelineLayout(&pipelineLayoutDesc);

    // Color target matching surface format (offscreen texture uses same format)
    wgpu::ColorTargetState colorTarget{};
    colorTarget.format = surfaceFormat;
    colorTarget.writeMask = wgpu::ColorWriteMask::All;

    // Fragment state
    wgpu::FragmentState fragmentState{};
    fragmentState.module = noiseShaderModule;
    fragmentState.entryPoint = "fs_main";
    fragmentState.targetCount = 1;
    fragmentState.targets = &colorTarget;

    // Render pipeline descriptor
    wgpu::RenderPipelineDescriptor pipelineDesc{};
    pipelineDesc.layout = pipelineLayout;
    pipelineDesc.vertex.module = noiseShaderModule;
    pipelineDesc.vertex.entryPoint = "vs_main";
    pipelineDesc.fragment = &fragmentState;
    pipelineDesc.primitive.topology = wgpu::PrimitiveTopology::TriangleList;
    pipelineDesc.multisample.count = 1;
    pipelineDesc.multisample.mask = ~0u;

    noisePipeline = device.CreateRenderPipeline(&pipelineDesc);
}

void BackgroundEngine::createImageBlitPipeline() {
    // Shader module from image_blit.wgsl.h
    wgpu::ShaderSourceWGSL wgslSource{};
    wgslSource.code = imageBlitShaderCode;

    wgpu::ShaderModuleDescriptor shaderDesc{};
    shaderDesc.nextInChain = &wgslSource;
    imageBlitShaderModule_ = device.CreateShaderModule(&shaderDesc);

    // Bind group layout: sampler(0), texture(1)
    wgpu::BindGroupLayoutEntry entries[2]{};

    // Sampler
    entries[0].binding = 0;
    entries[0].visibility = wgpu::ShaderStage::Fragment;
    entries[0].sampler.type = wgpu::SamplerBindingType::Filtering;

    // Texture
    entries[1].binding = 1;
    entries[1].visibility = wgpu::ShaderStage::Fragment;
    entries[1].texture.sampleType = wgpu::TextureSampleType::Float;
    entries[1].texture.viewDimension = wgpu::TextureViewDimension::e2D;

    wgpu::BindGroupLayoutDescriptor bglDesc{};
    bglDesc.entryCount = 2;
    bglDesc.entries = entries;
    imageBlitBindGroupLayout_ = device.CreateBindGroupLayout(&bglDesc);

    // Pipeline layout
    wgpu::PipelineLayoutDescriptor plDesc{};
    plDesc.bindGroupLayoutCount = 1;
    plDesc.bindGroupLayouts = &imageBlitBindGroupLayout_;
    wgpu::PipelineLayout pipelineLayout = device.CreatePipelineLayout(&plDesc);

    // Sampler (linear filtering, clamp to edge)
    wgpu::SamplerDescriptor samplerDesc{};
    samplerDesc.label = "Image blit sampler";
    samplerDesc.addressModeU = wgpu::AddressMode::ClampToEdge;
    samplerDesc.addressModeV = wgpu::AddressMode::ClampToEdge;
    samplerDesc.magFilter = wgpu::FilterMode::Linear;
    samplerDesc.minFilter = wgpu::FilterMode::Linear;
    imageBlitSampler_ = device.CreateSampler(&samplerDesc);

    // Color target format = surfaceFormat (offscreen texture uses surfaceFormat)
    wgpu::ColorTargetState colorTarget{};
    colorTarget.format = surfaceFormat;
    colorTarget.writeMask = wgpu::ColorWriteMask::All;

    // Fragment state
    wgpu::FragmentState fragmentState{};
    fragmentState.module = imageBlitShaderModule_;
    fragmentState.entryPoint = "fs_main";
    fragmentState.targetCount = 1;
    fragmentState.targets = &colorTarget;

    // Render pipeline
    wgpu::RenderPipelineDescriptor pipelineDesc{};
    pipelineDesc.layout = pipelineLayout;
    pipelineDesc.vertex.module = imageBlitShaderModule_;
    pipelineDesc.vertex.entryPoint = "vs_main";
    pipelineDesc.fragment = &fragmentState;
    pipelineDesc.primitive.topology = wgpu::PrimitiveTopology::TriangleList;
    pipelineDesc.multisample.count = 1;
    pipelineDesc.multisample.mask = ~0u;

    imageBlitPipeline_ = device.CreateRenderPipeline(&pipelineDesc);
}

void BackgroundEngine::createImageBlitBindGroup() {
    // Guard: return early if texture not uploaded yet
    if (!hasImageTexture_) return;

    wgpu::BindGroupEntry entries[2]{};

    // Sampler at binding 0
    entries[0].binding = 0;
    entries[0].sampler = imageBlitSampler_;

    // Texture view at binding 1
    entries[1].binding = 1;
    entries[1].textureView = imageTextureView_;

    wgpu::BindGroupDescriptor bgDesc{};
    bgDesc.label = "Image blit bind group";
    bgDesc.layout = imageBlitBindGroupLayout_;
    bgDesc.entryCount = 2;
    bgDesc.entries = entries;
    imageBlitBindGroup_ = device.CreateBindGroup(&bgDesc);
}

void BackgroundEngine::uploadImageData(const uint8_t* pixels, uint32_t imgWidth, uint32_t imgHeight) {
    // Destroy old image texture if it exists (re-upload case)
    if (imageTexture_) {
        imageTexture_.Destroy();
    }

    // Create image texture — use RGBA8Unorm (not Srgb) so raw sRGB bytes pass through
    // without linearization. The rest of the pipeline (offscreen texture, surface) also
    // uses non-sRGB formats, so this keeps color space handling consistent.
    wgpu::TextureDescriptor texDesc{};
    texDesc.label = "Image background texture";
    texDesc.size = {imgWidth, imgHeight, 1};
    texDesc.format = wgpu::TextureFormat::RGBA8Unorm;
    texDesc.usage = wgpu::TextureUsage::TextureBinding | wgpu::TextureUsage::CopyDst;
    texDesc.dimension = wgpu::TextureDimension::e2D;
    texDesc.mipLevelCount = 1;
    texDesc.sampleCount = 1;

    imageTexture_ = device.CreateTexture(&texDesc);

    // Calculate bytes per row with 256-byte alignment for WriteTexture
    uint32_t unpadded = imgWidth * 4;
    uint32_t bytesPerRow = ceilToNextMultiple(unpadded, 256);

    // Upload pixel data -- pad rows if needed for alignment
    wgpu::TexelCopyTextureInfo dst{};
    dst.texture = imageTexture_;
    dst.mipLevel = 0;
    dst.origin = {0, 0, 0};
    dst.aspect = wgpu::TextureAspect::All;

    wgpu::TexelCopyBufferLayout layout{};
    layout.offset = 0;
    layout.bytesPerRow = bytesPerRow;
    layout.rowsPerImage = imgHeight;

    wgpu::Extent3D extent = {imgWidth, imgHeight, 1};

    if (bytesPerRow == unpadded) {
        // No padding needed -- upload directly
        device.GetQueue().WriteTexture(&dst, pixels, unpadded * imgHeight, &layout, &extent);
    } else {
        // Padding needed -- create padded buffer with correct row stride
        std::vector<uint8_t> padded(bytesPerRow * imgHeight, 0);
        for (uint32_t row = 0; row < imgHeight; row++) {
            memcpy(padded.data() + row * bytesPerRow, pixels + row * unpadded, unpadded);
        }
        device.GetQueue().WriteTexture(&dst, padded.data(), padded.size(), &layout, &extent);
    }

    // Create texture view
    imageTextureView_ = imageTexture_.CreateView();

    hasImageTexture_ = true;

    // (Re)create bind group with the new texture view
    createImageBlitBindGroup();
}

void BackgroundEngine::setBackgroundMode(BackgroundMode mode) {
    backgroundMode_ = mode;
}

void BackgroundEngine::createUniforms() {
    // Uniform buffer
    wgpu::BufferDescriptor bufDesc{};
    bufDesc.size = sizeof(Uniforms);
    bufDesc.usage = wgpu::BufferUsage::CopyDst | wgpu::BufferUsage::Uniform;
    uniformBuffer = device.CreateBuffer(&bufDesc);

    // Bind group
    wgpu::BindGroupEntry entry{};
    entry.binding = 0;
    entry.buffer = uniformBuffer;
    entry.offset = 0;
    entry.size = sizeof(Uniforms);

    wgpu::BindGroupDescriptor bgDesc{};
    bgDesc.layout = noiseBindGroupLayout;
    bgDesc.entryCount = 1;
    bgDesc.entries = &entry;
    noiseBindGroup = device.CreateBindGroup(&bgDesc);
}

void BackgroundEngine::createOffscreenTexture() {
    // Destroy old texture if it exists (resize case)
    if (offscreenTexture) {
        offscreenTexture.Destroy();
    }

    // Create offscreen texture with dual usage: render target + texture sampling
    wgpu::TextureDescriptor texDesc{};
    texDesc.label = "Background offscreen texture";
    texDesc.size = {width, height, 1};
    texDesc.format = surfaceFormat;
    texDesc.usage = wgpu::TextureUsage::RenderAttachment |
                    wgpu::TextureUsage::TextureBinding;
    texDesc.dimension = wgpu::TextureDimension::e2D;
    texDesc.mipLevelCount = 1;
    texDesc.sampleCount = 1;

    offscreenTexture = device.CreateTexture(&texDesc);
    offscreenTextureView = offscreenTexture.CreateView();

    // Recreate glass bind group (references the new texture view)
    createGlassBindGroup();
}

void BackgroundEngine::createGlassPipeline() {
    // Glass shader module
    wgpu::ShaderSourceWGSL wgslSource{};
    wgslSource.code = glassShaderCode;

    wgpu::ShaderModuleDescriptor shaderDesc{};
    shaderDesc.nextInChain = &wgslSource;
    glassShaderModule = device.CreateShaderModule(&shaderDesc);

    // Bind group layout: sampler(0), texture(1), uniform(2)
    wgpu::BindGroupLayoutEntry entries[3]{};

    // Sampler
    entries[0].binding = 0;
    entries[0].visibility = wgpu::ShaderStage::Fragment;
    entries[0].sampler.type = wgpu::SamplerBindingType::Filtering;

    // Texture
    entries[1].binding = 1;
    entries[1].visibility = wgpu::ShaderStage::Fragment;
    entries[1].texture.sampleType = wgpu::TextureSampleType::Float;
    entries[1].texture.viewDimension = wgpu::TextureViewDimension::e2D;

    // Uniform buffer (dynamic offset for multi-region rendering)
    entries[2].binding = 2;
    entries[2].visibility = wgpu::ShaderStage::Fragment;
    entries[2].buffer.type = wgpu::BufferBindingType::Uniform;
    entries[2].buffer.hasDynamicOffset = true;
    entries[2].buffer.minBindingSize = sizeof(GlassUniforms);

    wgpu::BindGroupLayoutDescriptor bglDesc{};
    bglDesc.entryCount = 3;
    bglDesc.entries = entries;
    glassBindGroupLayout = device.CreateBindGroupLayout(&bglDesc);

    // Pipeline layout
    wgpu::PipelineLayoutDescriptor plDesc{};
    plDesc.bindGroupLayoutCount = 1;
    plDesc.bindGroupLayouts = &glassBindGroupLayout;
    wgpu::PipelineLayout pipelineLayout = device.CreatePipelineLayout(&plDesc);

    // Sampler (linear filtering, clamp to edge)
    wgpu::SamplerDescriptor samplerDesc{};
    samplerDesc.label = "Glass sampler";
    samplerDesc.addressModeU = wgpu::AddressMode::ClampToEdge;
    samplerDesc.addressModeV = wgpu::AddressMode::ClampToEdge;
    samplerDesc.magFilter = wgpu::FilterMode::Linear;
    samplerDesc.minFilter = wgpu::FilterMode::Linear;
    glassSampler = device.CreateSampler(&samplerDesc);

    // Glass uniform buffer: one slot per region + one extra for background blit passthrough.
    // Slot MAX_GLASS_REGIONS is reserved for the passthrough (no active region uses it).
    wgpu::BufferDescriptor bufDesc{};
    bufDesc.size = uniformStride * (MAX_GLASS_REGIONS + 1);
    bufDesc.usage = wgpu::BufferUsage::CopyDst | wgpu::BufferUsage::Uniform;
    glassUniformBuffer = device.CreateBuffer(&bufDesc);

    // Color target with alpha blending for multi-region compositing.
    // Each region draws only within its mask; alpha blending preserves other regions.
    wgpu::BlendState blend{};
    blend.color.operation = wgpu::BlendOperation::Add;
    blend.color.srcFactor = wgpu::BlendFactor::SrcAlpha;
    blend.color.dstFactor = wgpu::BlendFactor::OneMinusSrcAlpha;
    blend.alpha.operation = wgpu::BlendOperation::Add;
    blend.alpha.srcFactor = wgpu::BlendFactor::One;
    blend.alpha.dstFactor = wgpu::BlendFactor::OneMinusSrcAlpha;

    wgpu::ColorTargetState colorTarget{};
    colorTarget.format = surfaceFormat;
    colorTarget.writeMask = wgpu::ColorWriteMask::All;
    colorTarget.blend = &blend;

    // Fragment state
    wgpu::FragmentState fragmentState{};
    fragmentState.module = glassShaderModule;
    fragmentState.entryPoint = "fs_main";
    fragmentState.targetCount = 1;
    fragmentState.targets = &colorTarget;

    // Render pipeline descriptor
    wgpu::RenderPipelineDescriptor pipelineDesc{};
    pipelineDesc.layout = pipelineLayout;
    pipelineDesc.vertex.module = glassShaderModule;
    pipelineDesc.vertex.entryPoint = "vs_main";
    pipelineDesc.fragment = &fragmentState;
    pipelineDesc.primitive.topology = wgpu::PrimitiveTopology::TriangleList;
    pipelineDesc.multisample.count = 1;
    pipelineDesc.multisample.mask = ~0u;

    glassPipeline = device.CreateRenderPipeline(&pipelineDesc);
}

void BackgroundEngine::createGlassBindGroup() {
    wgpu::BindGroupEntry entries[3]{};

    // Sampler at binding 0
    entries[0].binding = 0;
    entries[0].sampler = glassSampler;

    // Texture view at binding 1
    entries[1].binding = 1;
    entries[1].textureView = offscreenTextureView;

    // Uniform buffer at binding 2
    entries[2].binding = 2;
    entries[2].buffer = glassUniformBuffer;
    entries[2].offset = 0;
    entries[2].size = sizeof(GlassUniforms);

    wgpu::BindGroupDescriptor bgDesc{};
    bgDesc.label = "Glass bind group";
    bgDesc.layout = glassBindGroupLayout;
    bgDesc.entryCount = 3;
    bgDesc.entries = entries;
    glassBindGroup = device.CreateBindGroup(&bgDesc);
}

void BackgroundEngine::lerpUniforms(GlassUniforms& current, const GlassUniforms& target, float t) {
    // Visual parameters only -- rect and resolution are set directly
    current.cornerRadius += (target.cornerRadius - current.cornerRadius) * t;
    current.blurIntensity += (target.blurIntensity - current.blurIntensity) * t;
    current.opacity += (target.opacity - current.opacity) * t;
    current.refractionStrength += (target.refractionStrength - current.refractionStrength) * t;
    current.tintR += (target.tintR - current.tintR) * t;
    current.tintG += (target.tintG - current.tintG) * t;
    current.tintB += (target.tintB - current.tintB) * t;
    current.aberration += (target.aberration - current.aberration) * t;
    current.specularIntensity += (target.specularIntensity - current.specularIntensity) * t;
    current.rimIntensity += (target.rimIntensity - current.rimIntensity) * t;
    current.mode += (target.mode - current.mode) * t;
}

void BackgroundEngine::update(float deltaTime) {
    if (deltaTime > 0.1f) deltaTime = 0.1f;

    // Time update (only when not paused)
    if (!paused_) {
        currentTime += deltaTime;
    }

    // Morph interpolation (always runs -- morphing should happen even when background is frozen)
    for (uint32_t i = 0; i < MAX_GLASS_REGIONS; i++) {
        if (!regions[i].active) continue;
        if (regions[i].morphSpeed <= 0.0f) {
            // Instant mode: copy target visual params to current
            lerpUniforms(regions[i].current, regions[i].target, 1.0f);
        } else {
            float t = 1.0f - expf(-regions[i].morphSpeed * deltaTime);
            lerpUniforms(regions[i].current, regions[i].target, t);
        }
    }
}

void BackgroundEngine::setPaused(bool paused) {
    paused_ = paused;
}

void BackgroundEngine::setReducedTransparency(bool enabled) {
    reducedTransparency_ = enabled;
}

void BackgroundEngine::render() {
    // Update uniform buffer with current time and resolution
    Uniforms uniforms{currentTime, 0.0f, static_cast<float>(width), static_cast<float>(height)};
    device.GetQueue().WriteBuffer(uniformBuffer, 0, &uniforms, sizeof(Uniforms));

    wgpu::CommandEncoder encoder = device.CreateCommandEncoder();

    // === PASS 1: Render background to offscreen texture ===
    {
        wgpu::RenderPassColorAttachment attachment{};
        attachment.view = offscreenTextureView;
        attachment.loadOp = wgpu::LoadOp::Clear;
        attachment.storeOp = wgpu::StoreOp::Store;
        attachment.clearValue = {0.0f, 0.0f, 0.0f, 1.0f};

        wgpu::RenderPassDescriptor passDesc{};
        passDesc.colorAttachmentCount = 1;
        passDesc.colorAttachments = &attachment;

        wgpu::RenderPassEncoder pass = encoder.BeginRenderPass(&passDesc);

        if (backgroundMode_ == BackgroundMode::Image && hasImageTexture_) {
            // Image mode: blit image texture to offscreen
            pass.SetPipeline(imageBlitPipeline_);
            pass.SetBindGroup(0, imageBlitBindGroup_);
        } else {
            // Noise mode (or image not loaded yet -- fallback to noise)
            pass.SetPipeline(noisePipeline);
            pass.SetBindGroup(0, noiseBindGroup);
        }
        pass.Draw(3);
        pass.End();
    }

    // === PASS 2: Glass pass -- offscreen texture to surface (multi-region) ===
    {
        wgpu::SurfaceTexture surfaceTexture;
        surface.GetCurrentTexture(&surfaceTexture);

        wgpu::RenderPassColorAttachment attachment{};
        attachment.view = surfaceTexture.texture.CreateView();
        attachment.loadOp = wgpu::LoadOp::Clear;
        attachment.storeOp = wgpu::StoreOp::Store;
        attachment.clearValue = {0.0f, 0.0f, 0.0f, 1.0f};

        wgpu::RenderPassDescriptor passDesc{};
        passDesc.colorAttachmentCount = 1;
        passDesc.colorAttachments = &attachment;

        wgpu::RenderPassEncoder pass = encoder.BeginRenderPass(&passDesc);
        pass.SetPipeline(glassPipeline);

        // Step 1: Always draw a background blit first (rectW=0 → shader outputs
        // bgColor with alpha=1, writing clean background over the cleared surface).
        // Uses slot MAX_GLASS_REGIONS (reserved, no active region writes here)
        // to avoid being overwritten by region WriteBuffer calls below.
        {
            GlassUniforms passthrough{};
            passthrough.resolutionX = static_cast<float>(width);
            passthrough.resolutionY = static_cast<float>(height);
            uint32_t blitOffset = MAX_GLASS_REGIONS * uniformStride;
            device.GetQueue().WriteBuffer(glassUniformBuffer, blitOffset,
                                          &passthrough, sizeof(GlassUniforms));
            pass.SetBindGroup(0, glassBindGroup, 1, &blitOffset);
            pass.Draw(3);
        }

        // Step 2: Composite each active glass region on top via alpha blending.
        // The shader outputs glassColor with alpha=mask, so only the glass area
        // overwrites the background; surrounding pixels are preserved.
        for (uint32_t i = 0; i < MAX_GLASS_REGIONS; i++) {
            if (!regions[i].active) continue;
            regions[i].current.resolutionX = static_cast<float>(width);
            regions[i].current.resolutionY = static_cast<float>(height);
            device.GetQueue().WriteBuffer(glassUniformBuffer, i * uniformStride,
                                          &regions[i].current, sizeof(GlassUniforms));
            uint32_t dynamicOffset = i * uniformStride;
            pass.SetBindGroup(0, glassBindGroup, 1, &dynamicOffset);
            pass.Draw(3);
        }

        pass.End();
    }

    // Store in variable before taking address (avoid UB from Phase 2 lesson)
    wgpu::CommandBuffer commands = encoder.Finish();
    device.GetQueue().Submit(1, &commands);
}

void BackgroundEngine::resize(uint32_t newWidth, uint32_t newHeight) {
    // Guard against 0 dimensions (minimized window)
    if (newWidth == 0 || newHeight == 0) return;
    width = newWidth;
    height = newHeight;

    // Reconfigure surface with new dimensions
    wgpu::SurfaceConfiguration config{};
    config.device = device;
    config.format = surfaceFormat;
    config.width = width;
    config.height = height;
    surface.Configure(&config);

    // Recreate offscreen texture at new size (also recreates glass bind group)
    createOffscreenTexture();
}

int BackgroundEngine::addGlassRegion() {
    for (uint32_t i = 0; i < MAX_GLASS_REGIONS; i++) {
        if (!regions[i].active) {
            regions[i].active = true;
            GlassUniforms defaults{};
            defaults.cornerRadius = 24.0f;
            defaults.blurIntensity = 0.5f;
            defaults.opacity = 0.05f;
            defaults.refractionStrength = 0.15f;
            defaults.tintR = 1.0f;
            defaults.tintG = 1.0f;
            defaults.tintB = 1.0f;
            defaults.aberration = 3.0f;
            defaults.specularIntensity = 0.2f;
            defaults.rimIntensity = 0.15f;
            defaults.mode = 0.0f;
            regions[i].current = defaults;
            regions[i].target = defaults;
            regions[i].morphSpeed = 8.0f;
            return static_cast<int>(i);
        }
    }
    return -1; // All slots full
}

void BackgroundEngine::removeGlassRegion(int id) {
    if (id < 0 || id >= static_cast<int>(MAX_GLASS_REGIONS)) return;
    regions[id].active = false;
}

void BackgroundEngine::setRegionRect(int id, float x, float y, float w, float h) {
    if (id < 0 || id >= static_cast<int>(MAX_GLASS_REGIONS)) return;
    // Write to BOTH current and target -- position tracks DOM instantly, no lerp
    regions[id].current.rectX = x; regions[id].target.rectX = x;
    regions[id].current.rectY = y; regions[id].target.rectY = y;
    regions[id].current.rectW = w; regions[id].target.rectW = w;
    regions[id].current.rectH = h; regions[id].target.rectH = h;
}

void BackgroundEngine::setRegionParams(int id, float cornerRadius, float blur, float opacity, float refraction) {
    if (id < 0 || id >= static_cast<int>(MAX_GLASS_REGIONS)) return;
    regions[id].target.cornerRadius = cornerRadius;
    regions[id].target.blurIntensity = blur;
    regions[id].target.opacity = opacity;
    regions[id].target.refractionStrength = refraction;
}

void BackgroundEngine::setRegionTint(int id, float r, float g, float b) {
    if (id < 0 || id >= static_cast<int>(MAX_GLASS_REGIONS)) return;
    regions[id].target.tintR = r;
    regions[id].target.tintG = g;
    regions[id].target.tintB = b;
}

void BackgroundEngine::setRegionAberration(int id, float aberration) {
    if (id < 0 || id >= static_cast<int>(MAX_GLASS_REGIONS)) return;
    regions[id].target.aberration = aberration;
}

void BackgroundEngine::setRegionSpecular(int id, float intensity) {
    if (id < 0 || id >= static_cast<int>(MAX_GLASS_REGIONS)) return;
    regions[id].target.specularIntensity = intensity;
}

void BackgroundEngine::setRegionRim(int id, float intensity) {
    if (id < 0 || id >= static_cast<int>(MAX_GLASS_REGIONS)) return;
    regions[id].target.rimIntensity = intensity;
}

void BackgroundEngine::setRegionMode(int id, float mode) {
    if (id < 0 || id >= static_cast<int>(MAX_GLASS_REGIONS)) return;
    regions[id].target.mode = mode;
}

void BackgroundEngine::setRegionMorphSpeed(int id, float speed) {
    if (id < 0 || id >= static_cast<int>(MAX_GLASS_REGIONS)) return;
    regions[id].morphSpeed = speed;
}

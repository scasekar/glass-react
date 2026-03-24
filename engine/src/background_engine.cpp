#include "background_engine.h"
#include "shaders/noise.wgsl.h"
#include "shaders/image_blit.wgsl.h"
#include <iostream>
#include <string_view>
#include <cmath>
#include <vector>
#include <cstring>
#include <algorithm>

namespace {
inline uint32_t ceilToNextMultiple(uint32_t value, uint32_t alignment) {
    return (value + alignment - 1) / alignment * alignment;
}
} // anonymous namespace

static constexpr wgpu::TextureFormat kOffscreenFormat = wgpu::TextureFormat::RGBA8Unorm;

BackgroundEngine::BackgroundEngine() = default;
BackgroundEngine::~BackgroundEngine() = default;

void BackgroundEngine::init(wgpu::Device dev, uint32_t w, uint32_t h) {
    device = std::move(dev);
    width = w;
    height = h;

    createNoisePipeline();
    createImageBlitPipeline();
    createUniforms();
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

    // Color target matching offscreen format
    wgpu::ColorTargetState colorTarget{};
    colorTarget.format = kOffscreenFormat;
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

    // Color target format = kOffscreenFormat (RGBA8Unorm)
    wgpu::ColorTargetState colorTarget{};
    colorTarget.format = kOffscreenFormat;
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
    texDesc.format = kOffscreenFormat;
    texDesc.usage = wgpu::TextureUsage::RenderAttachment |
                    wgpu::TextureUsage::TextureBinding |
                    wgpu::TextureUsage::CopyDst;
    texDesc.dimension = wgpu::TextureDimension::e2D;
    texDesc.mipLevelCount = 1;
    texDesc.sampleCount = 1;

    offscreenTexture = device.CreateTexture(&texDesc);
    offscreenTextureView = offscreenTexture.CreateView();
}

void BackgroundEngine::update(float deltaTime) {
    if (deltaTime > 0.1f) deltaTime = 0.1f;

    // Time update (only when not paused)
    if (!paused_) {
        currentTime += deltaTime;
    }
}

void BackgroundEngine::setPaused(bool paused) {
    paused_ = paused;
}

void BackgroundEngine::setReducedTransparency(bool enabled) {
    reducedTransparency_ = enabled;
}

void BackgroundEngine::setDpr(float dpr) {
    dpr_ = dpr;
}

void BackgroundEngine::setExternalTextureMode(bool enabled) {
    externalTextureMode_ = enabled;
}

void BackgroundEngine::renderBackground() {
    // Update uniform buffer with current time and resolution
    Uniforms uniforms{currentTime, 0.0f, static_cast<float>(width), static_cast<float>(height)};
    device.GetQueue().WriteBuffer(uniformBuffer, 0, &uniforms, sizeof(Uniforms));

    if (externalTextureMode_) return;  // host manages background externally

    wgpu::CommandEncoder encoder = device.CreateCommandEncoder();

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
        pass.SetPipeline(imageBlitPipeline_);
        pass.SetBindGroup(0, imageBlitBindGroup_);
    } else {
        pass.SetPipeline(noisePipeline);
        pass.SetBindGroup(0, noiseBindGroup);
    }
    pass.Draw(3);
    pass.End();

    wgpu::CommandBuffer commands = encoder.Finish();
    device.GetQueue().Submit(1, &commands);
}

void BackgroundEngine::resize(uint32_t newWidth, uint32_t newHeight) {
    // Guard against 0 dimensions (minimized window)
    if (newWidth == 0 || newHeight == 0) return;
    width = newWidth;
    height = newHeight;

    // Recreate offscreen texture at new size
    createOffscreenTexture();
}

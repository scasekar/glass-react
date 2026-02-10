#include "background_engine.h"
#include "shaders/noise.wgsl.h"
#include "shaders/blit.wgsl.h"
#include <iostream>
#include <string_view>

BackgroundEngine::BackgroundEngine() = default;
BackgroundEngine::~BackgroundEngine() = default;

void BackgroundEngine::init(wgpu::Device dev, wgpu::Surface surf,
                            wgpu::TextureFormat fmt, uint32_t w, uint32_t h) {
    device = std::move(dev);
    surface = std::move(surf);
    surfaceFormat = fmt;
    width = w;
    height = h;
    createNoisePipeline();
    createUniforms();
    createBlitPipeline();
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

    // Recreate blit bind group (references the new texture view)
    createBlitBindGroup();
}

void BackgroundEngine::createBlitPipeline() {
    // Blit shader module
    wgpu::ShaderSourceWGSL wgslSource{};
    wgslSource.code = blitShaderCode;

    wgpu::ShaderModuleDescriptor shaderDesc{};
    shaderDesc.nextInChain = &wgslSource;
    blitShaderModule = device.CreateShaderModule(&shaderDesc);

    // Bind group layout: sampler at binding 0, texture at binding 1
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
    blitBindGroupLayout = device.CreateBindGroupLayout(&bglDesc);

    // Pipeline layout
    wgpu::PipelineLayoutDescriptor plDesc{};
    plDesc.bindGroupLayoutCount = 1;
    plDesc.bindGroupLayouts = &blitBindGroupLayout;
    wgpu::PipelineLayout pipelineLayout = device.CreatePipelineLayout(&plDesc);

    // Sampler (linear filtering, clamp to edge)
    wgpu::SamplerDescriptor samplerDesc{};
    samplerDesc.label = "Blit sampler";
    samplerDesc.addressModeU = wgpu::AddressMode::ClampToEdge;
    samplerDesc.addressModeV = wgpu::AddressMode::ClampToEdge;
    samplerDesc.magFilter = wgpu::FilterMode::Linear;
    samplerDesc.minFilter = wgpu::FilterMode::Linear;
    blitSampler = device.CreateSampler(&samplerDesc);

    // Color target matching surface format
    wgpu::ColorTargetState colorTarget{};
    colorTarget.format = surfaceFormat;
    colorTarget.writeMask = wgpu::ColorWriteMask::All;

    // Fragment state
    wgpu::FragmentState fragmentState{};
    fragmentState.module = blitShaderModule;
    fragmentState.entryPoint = "fs_main";
    fragmentState.targetCount = 1;
    fragmentState.targets = &colorTarget;

    // Render pipeline descriptor
    wgpu::RenderPipelineDescriptor pipelineDesc{};
    pipelineDesc.layout = pipelineLayout;
    pipelineDesc.vertex.module = blitShaderModule;
    pipelineDesc.vertex.entryPoint = "vs_main";
    pipelineDesc.fragment = &fragmentState;
    pipelineDesc.primitive.topology = wgpu::PrimitiveTopology::TriangleList;
    pipelineDesc.multisample.count = 1;
    pipelineDesc.multisample.mask = ~0u;

    blitPipeline = device.CreateRenderPipeline(&pipelineDesc);
}

void BackgroundEngine::createBlitBindGroup() {
    wgpu::BindGroupEntry entries[2]{};

    // Sampler at binding 0
    entries[0].binding = 0;
    entries[0].sampler = blitSampler;

    // Texture view at binding 1
    entries[1].binding = 1;
    entries[1].textureView = offscreenTextureView;

    wgpu::BindGroupDescriptor bgDesc{};
    bgDesc.label = "Blit bind group";
    bgDesc.layout = blitBindGroupLayout;
    bgDesc.entryCount = 2;
    bgDesc.entries = entries;
    blitBindGroup = device.CreateBindGroup(&bgDesc);
}

void BackgroundEngine::update(float deltaTime) {
    // Cap deltaTime to prevent huge jumps on tab switch
    if (deltaTime > 0.1f) {
        deltaTime = 0.1f;
    }
    currentTime += deltaTime;
}

void BackgroundEngine::render() {
    // Update uniform buffer with current time and resolution
    Uniforms uniforms{currentTime, 0.0f, static_cast<float>(width), static_cast<float>(height)};
    device.GetQueue().WriteBuffer(uniformBuffer, 0, &uniforms, sizeof(Uniforms));

    wgpu::CommandEncoder encoder = device.CreateCommandEncoder();

    // === PASS 1: Render noise to offscreen texture ===
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
        pass.SetPipeline(noisePipeline);
        pass.SetBindGroup(0, noiseBindGroup);
        pass.Draw(3);
        pass.End();
    }

    // === PASS 2: Blit offscreen texture to surface ===
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
        pass.SetPipeline(blitPipeline);
        pass.SetBindGroup(0, blitBindGroup);
        pass.Draw(3);
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

    // Recreate offscreen texture at new size (also recreates blit bind group)
    createOffscreenTexture();
}

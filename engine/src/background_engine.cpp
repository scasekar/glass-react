#include "background_engine.h"
#include "shaders/noise.wgsl.h"
#include "shaders/glass.wgsl.h"
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
    createGlassPipeline();
    createOffscreenTexture();

    // Initialize default glass uniform values
    glassUniforms.rectX = 0.25f;  glassUniforms.rectY = 0.25f;
    glassUniforms.rectW = 0.5f;   glassUniforms.rectH = 0.5f;
    glassUniforms.cornerRadius = 20.0f;
    glassUniforms.blurIntensity = 0.5f;
    glassUniforms.opacity = 0.15f;
    glassUniforms.refractionStrength = 0.02f;
    glassUniforms.tintR = 1.0f; glassUniforms.tintG = 1.0f; glassUniforms.tintB = 1.0f;
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

    // Uniform buffer
    entries[2].binding = 2;
    entries[2].visibility = wgpu::ShaderStage::Fragment;
    entries[2].buffer.type = wgpu::BufferBindingType::Uniform;
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

    // Glass uniform buffer
    wgpu::BufferDescriptor bufDesc{};
    bufDesc.size = sizeof(GlassUniforms);
    bufDesc.usage = wgpu::BufferUsage::CopyDst | wgpu::BufferUsage::Uniform;
    glassUniformBuffer = device.CreateBuffer(&bufDesc);

    // Color target matching surface format (no blend -- shader does compositing)
    wgpu::ColorTargetState colorTarget{};
    colorTarget.format = surfaceFormat;
    colorTarget.writeMask = wgpu::ColorWriteMask::All;

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

    // === PASS 2: Glass pass -- offscreen texture to surface ===
    {
        // Update glass uniforms with current resolution
        glassUniforms.resolutionX = static_cast<float>(width);
        glassUniforms.resolutionY = static_cast<float>(height);
        device.GetQueue().WriteBuffer(glassUniformBuffer, 0, &glassUniforms, sizeof(GlassUniforms));

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
        pass.SetBindGroup(0, glassBindGroup);
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

    // Recreate offscreen texture at new size (also recreates glass bind group)
    createOffscreenTexture();
}

void BackgroundEngine::setGlassRect(float x, float y, float w, float h) {
    glassUniforms.rectX = x; glassUniforms.rectY = y;
    glassUniforms.rectW = w; glassUniforms.rectH = h;
}

void BackgroundEngine::setGlassParams(float cornerRadius, float blur, float opacity, float refraction) {
    glassUniforms.cornerRadius = cornerRadius;
    glassUniforms.blurIntensity = blur;
    glassUniforms.opacity = opacity;
    glassUniforms.refractionStrength = refraction;
}

void BackgroundEngine::setGlassTint(float r, float g, float b) {
    glassUniforms.tintR = r; glassUniforms.tintG = g; glassUniforms.tintB = b;
}

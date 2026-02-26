#pragma once

// WGSL image blit shader as C++ raw string literal
// Fullscreen triangle that samples an sRGB image texture and outputs to offscreen texture
// Used as Pass 1 alternative in image background mode (replaces noise pass)
// The image texture uses rgba8unorm-srgb format which handles sRGB-to-linear conversion
// automatically on sample -- no manual pow(2.2) gamma correction needed

const char* imageBlitShaderCode = R"(

@group(0) @binding(0) var texSampler: sampler;
@group(0) @binding(1) var texImage: texture_2d<f32>;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
};

// Fullscreen triangle: 3 hardcoded vertices covering clip space [-1,1]
@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    let pos = array<vec2f, 3>(
        vec2f(-1.0, -1.0),
        vec2f( 3.0, -1.0),
        vec2f(-1.0,  3.0),
    );
    var output: VertexOutput;
    output.position = vec4f(pos[vertexIndex], 0.0, 1.0);
    // Flip Y for correct orientation (clip space Y is up, texture V is down)
    output.uv = vec2f(output.position.x * 0.5 + 0.5, 1.0 - (output.position.y * 0.5 + 0.5));
    return output;
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
    return textureSample(texImage, texSampler, uv);
}

)";

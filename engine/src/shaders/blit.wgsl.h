#pragma once

// WGSL blit shader as C++ raw string literal
// Fullscreen triangle that samples an offscreen texture and outputs to surface
// Used as Pass 2 in two-pass render architecture (noise -> offscreen, blit -> surface)

const char* blitShaderCode = R"(

@group(0) @binding(0) var texSampler: sampler;
@group(0) @binding(1) var texSource: texture_2d<f32>;

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
    return textureSample(texSource, texSampler, uv);
}

)";

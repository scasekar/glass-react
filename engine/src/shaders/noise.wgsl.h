#pragma once

// WGSL noise shader as C++ raw string literal
// Simplex noise 2D from munrocket/noise-algorithms (MIT License)
// Based on Stefan Gustavson's "Simplex noise demystified"

const char* noiseShaderCode = R"(

struct Uniforms {
    time: f32,
    _pad: f32,
    resolution: vec2f,
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

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
    output.uv = output.position.xy * 0.5 + 0.5;
    return output;
}

// --- Simplex Noise 2D ---
// Source: https://gist.github.com/munrocket/236ed5ba7e409b8bdf1ff6eca5dcdc39

fn mod289_2(x: vec2f) -> vec2f {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn mod289_3(x: vec3f) -> vec3f {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn permute3(x: vec3f) -> vec3f {
    return mod289_3(((x * 34.0) + 1.0) * x);
}

fn simplexNoise2(v: vec2f) -> f32 {
    let C = vec4f(0.211324865405187, 0.366025403784439,
                  -0.577350269189626, 0.024390243902439);
    var i = floor(v + dot(v, C.yy));
    let x0 = v - i + dot(i, C.xx);
    var i1 = select(vec2f(0.0, 1.0), vec2f(1.0, 0.0), x0.x > x0.y);
    var x12 = x0.xyxy + C.xxzz;
    x12 = vec4f(x12.x - i1.x, x12.y - i1.y, x12.z, x12.w);
    i = mod289_2(i);
    var p = permute3(permute3(i.y + vec3f(0.0, i1.y, 1.0)) + i.x + vec3f(0.0, i1.x, 1.0));
    var m = max(0.5 - vec3f(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), vec3f(0.0));
    m *= m;
    m *= m;
    let x = 2.0 * fract(p * C.www) - 1.0;
    let h = abs(x) - 0.5;
    let ox = floor(x + 0.5);
    let a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    let g = vec3f(a0.x * x0.x + h.x * x0.y,
                  a0.yz * x12.xz + h.yz * x12.yw);
    return 130.0 * dot(m, g);
}

// --- Fractional Brownian Motion ---
// Source: https://thebookofshaders.com/13/ (adapted to WGSL)

fn fbm(st: vec2f, time: f32) -> f32 {
    var value: f32 = 0.0;
    var amplitude: f32 = 0.5;
    var frequency: f32 = 1.0;
    // 6 octaves for good detail
    for (var i: u32 = 0u; i < 6u; i++) {
        value += amplitude * simplexNoise2(st * frequency + time * 0.15);
        frequency *= 2.0;     // lacunarity
        amplitude *= 0.5;     // persistence
    }
    return value;
}

// --- Fragment Shader ---

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
    // Normalize UVs by aspect ratio
    let st = uv * uniforms.resolution / min(uniforms.resolution.x, uniforms.resolution.y);
    // Compute fBM noise, remap from [-1,1] to [0,1]
    let n = fbm(st * 3.0, uniforms.time) * 0.5 + 0.5;
    // Blue/teal color ramp: dark blue to teal gradient
    let color = vec3f(n * 0.15, n * 0.3 + 0.05, n * 0.6 + 0.1);
    return vec4f(color, 1.0);
}

)";

#pragma once

// WGSL glass shader as C++ raw string literal
// Glass effect: SDF rounded rect masking, UV distortion (refraction),
// 9-tap blur (frosted glass), tint compositing over background texture.
// Used as Pass 2 in two-pass render architecture (noise -> offscreen, glass -> surface)

const char* glassShaderCode = R"(

struct GlassUniforms {
    rect: vec4f,              // x, y, w, h in normalized [0,1] UV coords
    cornerRadius: f32,        // in pixels
    blurIntensity: f32,       // 0.0 = sharp, 1.0 = max frosted
    opacity: f32,             // 0.0 = invisible glass, 1.0 = solid tint
    refractionStrength: f32,  // UV distortion magnitude
    tint: vec3f,              // RGB tint color
    _pad: f32,
    resolution: vec2f,        // canvas pixel dimensions
    _pad2: vec2f,
};

@group(0) @binding(0) var texSampler: sampler;
@group(0) @binding(1) var texBackground: texture_2d<f32>;
@group(0) @binding(2) var<uniform> glass: GlassUniforms;

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

// SDF for rounded rectangle (Inigo Quilez)
// p: point relative to box center
// b: box half-dimensions
// r: corner radius
fn sdRoundedBox(p: vec2f, b: vec2f, r: f32) -> f32 {
    let q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, vec2f(0.0))) - r;
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
    // 1. Sample background at current UV (passthrough for pixels outside glass)
    let bgColor = textureSample(texBackground, texSampler, uv);

    // 2. Convert UV to pixel space for SDF computation
    let pixelPos = uv * glass.resolution;
    let rectCenter = (glass.rect.xy + glass.rect.zw * 0.5) * glass.resolution;
    let rectHalf = glass.rect.zw * 0.5 * glass.resolution;

    // Compute SDF distance (negative = inside)
    let dist = sdRoundedBox(pixelPos - rectCenter, rectHalf, glass.cornerRadius);

    // 3. Anti-alias the SDF mask: 1.0 inside, 0.0 outside, smooth at edge
    let w = fwidth(dist);
    let mask = smoothstep(w, -w, dist);

    // 4. Early return if outside glass region
    if (mask < 0.001) {
        return bgColor;
    }

    // --- Inside glass region ---

    // 5. Compute distorted UV using barrel distortion from glass center
    let glassCenter = glass.rect.xy + glass.rect.zw * 0.5;
    let offset = uv - glassCenter;
    let d = length(offset / (glass.rect.zw * 0.5));
    let distortedUV = uv + offset * glass.refractionStrength * (1.0 - d);

    // 6. 9-tap (3x3) weighted blur sampling at distorted UV
    let texelSize = 1.0 / glass.resolution;
    let blurRadius = glass.blurIntensity * 4.0;
    var blurColor = vec4f(0.0);
    var totalWeight = 0.0;

    for (var x = -1; x <= 1; x++) {
        for (var y = -1; y <= 1; y++) {
            let sampleOffset = vec2f(f32(x), f32(y)) * texelSize * blurRadius;
            let weight = 1.0 / (1.0 + f32(x * x + y * y));
            blurColor += textureSample(texBackground, texSampler,
                                       distortedUV + sampleOffset) * weight;
            totalWeight += weight;
        }
    }
    blurColor /= totalWeight;

    // 7. Mix blurred color with tint
    let glassColor = mix(blurColor, vec4f(glass.tint, 1.0), glass.opacity);

    // 8. Composite glass over background using mask
    return mix(bgColor, glassColor, mask);
}

)";

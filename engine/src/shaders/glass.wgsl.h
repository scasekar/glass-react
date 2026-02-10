#pragma once

// WGSL glass shader — liquid glass effect
// Technique based on SDF lens displacement, chromatic aberration,
// Gaussian blur, Fresnel specular highlights, and tint compositing.
// References: atlaspuplabs.com, rdev/liquid-glass-react

const char* glassShaderCode = R"(

struct GlassUniforms {
    rect: vec4f,              // x, y, w, h in normalized [0,1] UV coords
    cornerRadius: f32,        // in pixels
    blurIntensity: f32,       // 0.0 = sharp, 1.0 = max frosted
    opacity: f32,             // tint mix: 0.0 = transparent, 1.0 = solid tint
    refractionStrength: f32,  // lens magnification at edges (0.0–0.3)
    tint: vec3f,              // RGB tint color
    aberration: f32,          // chromatic aberration intensity (pixels)
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

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    let pos = array<vec2f, 3>(
        vec2f(-1.0, -1.0),
        vec2f( 3.0, -1.0),
        vec2f(-1.0,  3.0),
    );
    var output: VertexOutput;
    output.position = vec4f(pos[vertexIndex], 0.0, 1.0);
    output.uv = vec2f(output.position.x * 0.5 + 0.5, 1.0 - (output.position.y * 0.5 + 0.5));
    return output;
}

fn sdRoundedBox(p: vec2f, b: vec2f, r: f32) -> f32 {
    let q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, vec2f(0.0))) - r;
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
    let bgColor = textureSample(texBackground, texSampler, uv);

    // --- SDF mask (pixel space) ---
    let pixelPos = uv * glass.resolution;
    let rectCenter = (glass.rect.xy + glass.rect.zw * 0.5) * glass.resolution;
    let rectHalf = glass.rect.zw * 0.5 * glass.resolution;
    let dist = sdRoundedBox(pixelPos - rectCenter, rectHalf, glass.cornerRadius);

    let fw = fwidth(dist);
    let mask = smoothstep(fw, -fw, dist);

    // --- Lens displacement (SDF-based edge compression) ---
    // Matches reference: smoothstep(edgeZone, 0, sdfDist) creates a factor
    // that is 1.0 deep inside (identity UV) and 0.0 at edges (max distortion).
    // UVs are scaled toward center at edges = convex lens magnification.
    let glassCenter = glass.rect.xy + glass.rect.zw * 0.5;
    let localPos = uv - glassCenter;

    let glassMinHalf = min(rectHalf.x, rectHalf.y);
    let innerZone = glassMinHalf * 0.4;
    let displacementFactor = smoothstep(0.0, innerZone, -dist);

    // Per-channel UV scaling for chromatic aberration
    // At center (factor=1): all channels = 1.0 (identity, no aberration)
    // At edges (factor=0): channels diverge (R wider, B narrower)
    let aberrationNorm = glass.aberration * 0.003;
    let rScale = mix(1.0 - glass.refractionStrength - aberrationNorm, 1.0, displacementFactor);
    let gScale = mix(1.0 - glass.refractionStrength, 1.0, displacementFactor);
    let bScale = mix(1.0 - glass.refractionStrength + aberrationNorm, 1.0, displacementFactor);

    let rUV = localPos * rScale + glassCenter;
    let gUV = localPos * gScale + glassCenter;
    let bUV = localPos * bScale + glassCenter;

    // --- 25-tap (5x5) Gaussian blur at green UV + 2 aberration samples ---
    let texelSize = 1.0 / glass.resolution;
    let blurRadius = glass.blurIntensity * 8.0;

    var blurColor = vec4f(0.0);
    var totalWeight = 0.0;

    for (var x = -2; x <= 2; x++) {
        for (var y = -2; y <= 2; y++) {
            let r2 = f32(x * x + y * y);
            let weight = exp(-r2 * 0.5);
            let sampleUV = gUV + vec2f(f32(x), f32(y)) * texelSize * blurRadius;
            blurColor += textureSample(texBackground, texSampler, sampleUV) * weight;
            totalWeight += weight;
        }
    }
    blurColor /= totalWeight;

    // Chromatic aberration (edge-only, 2 extra samples)
    let rSample = textureSample(texBackground, texSampler, rUV);
    let bSample = textureSample(texBackground, texSampler, bUV);

    let aberrationEdge = 1.0 - displacementFactor;
    let aberrationBlend = aberrationEdge * aberrationEdge * 0.6;

    let aberratedColor = vec3f(
        mix(blurColor.r, rSample.r, aberrationBlend),
        blurColor.g,
        mix(blurColor.b, bSample.b, aberrationBlend)
    );

    // --- Contrast reduction + saturation boost ---
    // Reference: backdrop-filter: contrast(85%) saturate(140%)
    let luminance = dot(aberratedColor, vec3f(0.299, 0.587, 0.114));
    let saturated = mix(vec3f(luminance), aberratedColor, 1.4);
    let contrasted = mix(vec3f(0.5), saturated, 0.85);

    // --- Tint ---
    let tinted = mix(contrasted, glass.tint, glass.opacity);

    // --- Directional Fresnel specular ---
    // Reference uses paired inset box-shadows: cool blue top-left, warm bottom-right
    let innerDist = max(-dist, 0.0);
    let broadGlow = exp(-innerDist * 0.08);

    let halfSize = glass.rect.zw * 0.5;
    let normPos = localPos / halfSize;
    let normLen = max(length(normPos), 0.001);
    let normDir = normPos / normLen;

    // Light from upper-left
    let lightDot = dot(normDir, vec2f(-0.707, -0.707));
    let topLeftFactor = clamp(lightDot * 0.5 + 0.5, 0.0, 1.0);

    let coolSpec = broadGlow * topLeftFactor * 0.2;
    let coolColor = vec3f(0.6, 0.75, 1.0);

    let warmSpec = broadGlow * (1.0 - topLeftFactor) * 0.1;
    let warmColor = vec3f(0.95, 1.0, 0.75);

    // Sharp rim at glass boundary
    let rimGlow = exp(-dist * dist / 3.0) * 0.15;

    let specular = coolSpec * coolColor + warmSpec * warmColor + vec3f(rimGlow);

    // --- Final composite ---
    let glassColor = vec4f(clamp(tinted + specular, vec3f(0.0), vec3f(1.0)), 1.0);
    return mix(bgColor, glassColor, mask);
}

)";


struct GlassUniforms {
    rect: vec4f,              // x, y, w, h in normalized [0,1] UV coords
    cornerRadius: f32,        // in pixels
    blurIntensity: f32,       // 0.0 = sharp, 1.0 = max frosted
    opacity: f32,             // tint mix: 0.0 = transparent, 1.0 = solid tint
    refractionStrength: f32,  // lens magnification at edges (0.0–0.3)
    tint: vec3f,              // RGB tint color
    aberration: f32,          // chromatic aberration intensity (pixels)
    resolution: vec2f,        // canvas pixel dimensions
    specularIntensity: f32,   // specular highlight brightness (0–1)
    rimIntensity: f32,        // rim lighting intensity (0–1)
    mode: f32,                // 0.0 = standard, 1.0 = prominent
    _pad4: f32,
    _pad5: f32,
    _pad6: f32,
    // --- New block at byte offset 80 ---
    contrast: f32,               // offset 80
    saturation: f32,             // offset 84
    fresnelIOR: f32,             // offset 88
    fresnelExponent: f32,        // offset 92
    // --- New block at byte offset 96 ---
    envReflectionStrength: f32,  // offset 96
    glareAngle: f32,             // offset 100
    blurRadius: f32,             // offset 104
    dpr: f32,                    // offset 108: device pixel ratio
};

@group(0) @binding(0) var texSampler: sampler;
@group(0) @binding(1) var texBackground: texture_2d<f32>;
@group(1) @binding(0) var<uniform> glass: GlassUniforms;

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
    let dpr = max(glass.dpr, 1.0);
    let clampedRadius = min(glass.cornerRadius * dpr, min(rectHalf.x, rectHalf.y));
    let dist = sdRoundedBox(pixelPos - rectCenter, rectHalf, clampedRadius);

    let fw = fwidth(dist);
    let mask = smoothstep(fw, -fw, dist);

    // Mode-dependent multipliers (0.0 = standard, 1.0 = prominent)
    let modeF = glass.mode;
    let refractionMul = mix(1.0, 1.8, modeF);
    let specularMul = mix(1.0, 1.5, modeF);
    let rimSpread = mix(3.0, 6.0, modeF);
    let aberrationMul = mix(1.0, 1.5, modeF);

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
    let aberrationNorm = glass.aberration * 0.008;
    let effectiveRefraction = glass.refractionStrength * refractionMul;
    let rScale = mix(1.0 - effectiveRefraction - aberrationNorm * aberrationMul, 1.0, displacementFactor);
    let gScale = mix(1.0 - effectiveRefraction, 1.0, displacementFactor);
    let bScale = mix(1.0 - effectiveRefraction + aberrationNorm * aberrationMul, 1.0, displacementFactor);

    let rUV = localPos * rScale + glassCenter;
    let gUV = localPos * gScale + glassCenter;
    let bUV = localPos * bScale + glassCenter;

    // --- 81-tap (9x9) Gaussian blur at green UV + 2 aberration samples ---
    // Sample spacing is derived from the background texture's actual dimensions
    // (via textureDimensions), NOT glass.resolution. When the scene texture is
    // lower-res than the glass canvas (e.g. renderer at CSS pixels, glass at
    // device pixels), using glass.resolution would make samples land within the
    // same source texel, producing blocky blur.
    // blurRadius is in CSS pixels which matches source texture texels (no DPR
    // multiplier needed). Step = blurRadius/4 so the outermost tap (index ±4)
    // lands exactly ±blurRadius source texels from center.
    let bgDims = vec2f(textureDimensions(texBackground));
    let texelSize = 1.0 / bgDims;
    let sampleStep = glass.blurRadius / 4.0;

    var blurColor = vec4f(0.0);
    var totalWeight = 0.0;

    for (var x = -4; x <= 4; x++) {
        for (var y = -4; y <= 4; y++) {
            let r2 = f32(x * x + y * y);
            let weight = exp(-r2 * 0.125);  // sigma=2 matches old Gaussian profile
            let sampleUV = gUV + vec2f(f32(x), f32(y)) * texelSize * sampleStep;
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
    let saturated = mix(vec3f(luminance), aberratedColor, glass.saturation);
    let contrasted = mix(vec3f(0.5), saturated, glass.contrast);

    // --- Tint ---
    let tinted = mix(contrasted, glass.tint, glass.opacity);

    // --- Directional Fresnel specular ---
    // Reference uses paired inset box-shadows: cool blue top-left, warm bottom-right
    // Use CSS-pixel-space distance so effects look the same at any DPR
    let cssDist = dist / dpr;
    let innerDist = max(-cssDist, 0.0);
    let broadGlow = exp(-innerDist * 0.08);

    let halfSize = glass.rect.zw * 0.5;
    let normPos = localPos / halfSize;
    let normLen = max(length(normPos), 0.001);
    let normDir = normPos / normLen;

    // Light direction from glareAngle uniform (replaces hardcoded upper-left)
    let lightDir = vec2f(cos(glass.glareAngle), sin(glass.glareAngle));
    let lightDot = dot(normDir, lightDir);
    let topLeftFactor = clamp(lightDot * 0.5 + 0.5, 0.0, 1.0);

    let coolSpec = broadGlow * topLeftFactor * glass.specularIntensity * specularMul;
    let coolColor = vec3f(0.6, 0.75, 1.0);

    let warmSpec = broadGlow * (1.0 - topLeftFactor) * glass.specularIntensity * 0.5 * specularMul;
    let warmColor = vec3f(0.95, 1.0, 0.75);

    // Fresnel edge reflection (IOR-based)
    let fresnelBase = 1.0 - clamp(abs(lightDot), 0.0, 1.0);
    let fresnelTerm = pow(fresnelBase, glass.fresnelExponent);
    let envRef = fresnelTerm * glass.envReflectionStrength;

    // Sharp rim at glass boundary
    let rimGlow = exp(-cssDist * cssDist / rimSpread) * glass.rimIntensity;

    let specular = coolSpec * coolColor + warmSpec * warmColor + vec3f(rimGlow);

    // --- Final composite ---
    // For background blit (rectW=0): mask=0, isBlit=true → output bgColor with alpha=1.
    // For glass regions: output glass color with alpha=mask so alpha blending
    // composites only the glass area over the previously drawn background.
    let isBlit = glass.rect.z <= 0.0;
    var glassColor = tinted + specular;
    glassColor += envRef;
    let glassRgb = clamp(glassColor, vec3f(0.0), vec3f(1.0));
    let outColor = select(glassRgb, bgColor.rgb, isBlit);
    let outAlpha = select(mask, 1.0, isBlit);
    return vec4f(outColor, outAlpha);
}

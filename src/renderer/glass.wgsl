
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

    // --- Plano-convex dome refraction (Apple Liquid Glass model) ---
    // Simulates a glass dome: flat back, curved front like a water droplet.
    // SDF depth = glass thickness. Center is deep (thick, flat surface = no
    // refraction). Edges are shallow (steep surface = maximum refraction).
    // Uses Snell's law: offset = -surfaceNormal * tan(θt - θi)
    let glassCenter = glass.rect.xy + glass.rect.zw * 0.5;
    let localPos = uv - glassCenter;

    let glassMinHalf = min(rectHalf.x, rectHalf.y);

    // SDF gradient = surface normal direction (via central differences)
    let gradX = sdRoundedBox((pixelPos + vec2f(1.0, 0.0)) - rectCenter, rectHalf, clampedRadius)
              - sdRoundedBox((pixelPos - vec2f(1.0, 0.0)) - rectCenter, rectHalf, clampedRadius);
    let gradY = sdRoundedBox((pixelPos + vec2f(0.0, 1.0)) - rectCenter, rectHalf, clampedRadius)
              - sdRoundedBox((pixelPos - vec2f(0.0, 1.0)) - rectCenter, rectHalf, clampedRadius);
    let surfaceNormal = vec2f(gradX, gradY) * 0.5;  // central diff → divide by 2
    let normalLen = length(surfaceNormal);

    // Glass dome thickness: 0 at edge (SDF=0), increases toward center
    let glassThickness = glassMinHalf * glass.refractionStrength;
    let normalizedDepth = clamp(-dist / glassThickness, 0.0, 1.0);

    // Snell's law on the dome surface:
    // incidentAngle from depth ratio (quadratic ramp for natural droplet shape)
    let depthRatio = 1.0 - normalizedDepth;  // 1 at edge, 0 at center
    let incidentAngle = asin(clamp(depthRatio * depthRatio, 0.0, 0.999));
    let ior = glass.fresnelIOR;
    let transmittedAngle = asin(clamp(sin(incidentAngle) / ior, -0.999, 0.999));

    // Edge shift: tangent of angle difference (how much the ray bends)
    let edgeShift = -tan(transmittedAngle - incidentAngle);

    // UV offset: surface normal direction × shift × dome thickness
    // surfaceNormal has magnitude ~1 (unit normal from SDF gradient).
    // edgeShift is the tangent of the angle difference (dimensionless).
    // Multiplying by glassThickness converts to pixel-scale displacement
    // proportional to the dome size — larger glass = more refraction.
    let refractPixels = surfaceNormal * edgeShift * glassThickness * 0.5;
    let refractOffset = refractPixels / glass.resolution;

    // Chromatic aberration: different IOR per channel (dispersion)
    let aberrationNorm = glass.aberration * 0.002 * aberrationMul;
    let rUV = uv + refractOffset * (1.0 + aberrationNorm);
    let gUV = uv + refractOffset;
    let bUV = uv + refractOffset * (1.0 - aberrationNorm);

    // displacementFactor for specular/aberration blend (1=center, 0=edge)
    let displacementFactor = normalizedDepth;

    // --- 81-tap (9x9) Gaussian blur at REFRACTED UV ---
    // Blur is applied at the refracted position so the frosted glass effect
    // shows through the dome displacement. Each blur sample is offset by
    // refractOffset so the entire blurred patch is displaced, not averaged away.
    let bgDims = vec2f(textureDimensions(texBackground));
    let texelSize = 1.0 / bgDims;
    let sampleStep = glass.blurRadius / 4.0;

    var blurColor = vec4f(0.0);
    var totalWeight = 0.0;

    // Blur centered on the refracted UV (gUV = uv + refractOffset)
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

    // Chromatic aberration: sample sharp (unblurred) at dispersed UVs
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

export interface GlassUniforms {
  rect: { x: number; y: number; w: number; h: number };
  cornerRadius: number;
  blurIntensity: number;
  opacity: number;
  refractionStrength: number;
  tint: { r: number; g: number; b: number };
  aberration: number;
  resolution: { x: number; y: number };
  specularIntensity: number;
  rimIntensity: number;
  mode: number; // 0 = standard, 1 = prominent
  contrast: number;
  saturation: number;
  fresnelIOR: number;
  fresnelExponent: number;
  envReflectionStrength: number;
  glareAngle: number;
  blurRadius: number;
  dpr: number;
}

export interface GlassRegionState {
  id: number;
  element: HTMLElement;
  current: GlassUniforms;
  target: GlassUniforms;
  morphSpeed: number;
}

export const DEFAULT_GLASS_UNIFORMS: GlassUniforms = {
  rect: { x: 0, y: 0, w: 0, h: 0 },
  cornerRadius: 12,
  blurIntensity: 0.5,
  opacity: 0.15,
  refractionStrength: 0.08,
  tint: { r: 1, g: 1, b: 1 },
  aberration: 1.0,
  resolution: { x: 1920, y: 1080 },
  specularIntensity: 0.8,
  rimIntensity: 0.6,
  mode: 0,
  contrast: 1.0,
  saturation: 1.0,
  fresnelIOR: 1.45,
  fresnelExponent: 2.5,
  envReflectionStrength: 0.4,
  glareAngle: 45,
  blurRadius: 9,
  dpr: 1,
};

/**
 * Build a 28-element Float32Array (112 bytes) matching the C++ GlassUniforms struct layout.
 * Uses EXPLICIT index assignments keyed to documented byte offsets.
 * NEVER use positional fill — one off-by-one shifts all subsequent fields silently.
 */
export function buildGlassUniformData(u: GlassUniforms): Float32Array {
  const data = new Float32Array(28); // 28 x 4 = 112 bytes

  // rect: vec4f — indices 0-3 (bytes 0-15)
  data[0] = u.rect.x;
  data[1] = u.rect.y;
  data[2] = u.rect.w; // rect.z in WGSL; 0 = isBlit sentinel
  data[3] = u.rect.h;

  // scalar fields — indices 4-7 (bytes 16-31)
  data[4] = u.cornerRadius;
  data[5] = u.blurIntensity;
  data[6] = u.opacity;
  data[7] = u.refractionStrength;

  // tint: vec3f padded to 16 bytes — indices 8-11 (bytes 32-47)
  // WGSL vec3f alignment: tint occupies slots 8,9,10; aberration occupies slot 11
  // (the 4th float of the 16-byte aligned vec3f slot)
  data[8]  = u.tint.r;
  data[9]  = u.tint.g;
  data[10] = u.tint.b;
  data[11] = u.aberration; // aberration follows tint's padding slot

  // resolution: vec2f — indices 12-13 (bytes 48-55)
  data[12] = u.resolution.x;
  data[13] = u.resolution.y;

  // specular/rim/mode — indices 14-16 (bytes 56-67)
  data[14] = u.specularIntensity;
  data[15] = u.rimIntensity;
  data[16] = u.mode;

  // explicit padding — indices 17-19 (bytes 68-79) — MUST be zero
  data[17] = 0; // _pad4
  data[18] = 0; // _pad5
  data[19] = 0; // _pad6

  // new block — indices 20-27 (bytes 80-111)
  data[20] = u.contrast;
  data[21] = u.saturation;
  data[22] = u.fresnelIOR;
  data[23] = u.fresnelExponent;
  data[24] = u.envReflectionStrength;
  data[25] = u.glareAngle;
  data[26] = u.blurRadius;
  data[27] = u.dpr;

  return data;
}

/**
 * Exponential decay lerp for smooth glass transitions.
 * Updates `current` in place toward `target`.
 * speed: 0 = instant snap, 1 = very slow
 */
export function morphLerp(current: GlassUniforms, target: GlassUniforms, dt: number, morphSpeed: number): void {
  const decay = Math.exp(-morphSpeed * dt);
  const lerp = (a: number, b: number) => a + (b - a) * (1 - decay);

  current.cornerRadius = lerp(current.cornerRadius, target.cornerRadius);
  current.blurIntensity = lerp(current.blurIntensity, target.blurIntensity);
  current.opacity = lerp(current.opacity, target.opacity);
  current.refractionStrength = lerp(current.refractionStrength, target.refractionStrength);
  current.tint.r = lerp(current.tint.r, target.tint.r);
  current.tint.g = lerp(current.tint.g, target.tint.g);
  current.tint.b = lerp(current.tint.b, target.tint.b);
  current.aberration = lerp(current.aberration, target.aberration);
  current.specularIntensity = lerp(current.specularIntensity, target.specularIntensity);
  current.rimIntensity = lerp(current.rimIntensity, target.rimIntensity);
  current.mode = lerp(current.mode, target.mode);
  current.contrast = lerp(current.contrast, target.contrast);
  current.saturation = lerp(current.saturation, target.saturation);
  current.fresnelIOR = lerp(current.fresnelIOR, target.fresnelIOR);
  current.fresnelExponent = lerp(current.fresnelExponent, target.fresnelExponent);
  current.envReflectionStrength = lerp(current.envReflectionStrength, target.envReflectionStrength);
  current.glareAngle = lerp(current.glareAngle, target.glareAngle);
  current.blurRadius = lerp(current.blurRadius, target.blurRadius);
  // rect and resolution are set directly per frame (not lerped)
}

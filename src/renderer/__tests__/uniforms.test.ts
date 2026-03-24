import { describe, it, expect } from 'vitest';
import { buildGlassUniformData, type GlassUniforms } from '../GlassRegionState';

const DEFAULT: GlassUniforms = {
  rect: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
  cornerRadius: 10,
  blurIntensity: 0.5,
  opacity: 0.8,
  refractionStrength: 0.1,
  tint: { r: 0.2, g: 0.4, b: 0.6 },
  aberration: 1.5,
  resolution: { x: 1920, y: 1080 },
  specularIntensity: 0.7,
  rimIntensity: 0.3,
  mode: 0,
  contrast: 1.1,
  saturation: 1.2,
  fresnelIOR: 1.4,
  fresnelExponent: 2.0,
  envReflectionStrength: 0.5,
  glareAngle: 45,
  blurRadius: 9,
  dpr: 2,
};

describe('buildGlassUniformData', () => {
  it('returns Float32Array of exactly 112 bytes (28 floats)', () => {
    const data = buildGlassUniformData(DEFAULT);
    expect(data).toBeInstanceOf(Float32Array);
    expect(data.byteLength).toBe(112);
    expect(data.length).toBe(28);
  });

  it('rect fields at indices 0-3', () => {
    const data = buildGlassUniformData(DEFAULT);
    expect(data[0]).toBeCloseTo(0.1);
    expect(data[1]).toBeCloseTo(0.2);
    expect(data[2]).toBeCloseTo(0.3); // rect.w (also rect.z in WGSL vec4f; 0 = isBlit)
    expect(data[3]).toBeCloseTo(0.4);
  });

  it('tint at indices 8-10, aberration at index 11', () => {
    const data = buildGlassUniformData(DEFAULT);
    expect(data[8]).toBeCloseTo(0.2);   // tint.r
    expect(data[9]).toBeCloseTo(0.4);   // tint.g
    expect(data[10]).toBeCloseTo(0.6);  // tint.b
    expect(data[11]).toBeCloseTo(1.5);  // aberration (NOT padding)
  });

  it('resolution at indices 12-13', () => {
    const data = buildGlassUniformData(DEFAULT);
    expect(data[12]).toBeCloseTo(1920);
    expect(data[13]).toBeCloseTo(1080);
  });

  it('padding indices 17-19 are zero', () => {
    const data = buildGlassUniformData(DEFAULT);
    expect(data[17]).toBe(0); // _pad4
    expect(data[18]).toBe(0); // _pad5
    expect(data[19]).toBe(0); // _pad6
  });

  it('new block at indices 20-27', () => {
    const data = buildGlassUniformData(DEFAULT);
    expect(data[20]).toBeCloseTo(1.1); // contrast
    expect(data[21]).toBeCloseTo(1.2); // saturation
    expect(data[22]).toBeCloseTo(1.4); // fresnelIOR
    expect(data[23]).toBeCloseTo(2.0); // fresnelExponent
    expect(data[24]).toBeCloseTo(0.5); // envReflectionStrength
    expect(data[25]).toBeCloseTo(45);  // glareAngle
    expect(data[26]).toBeCloseTo(9);   // blurRadius
    expect(data[27]).toBeCloseTo(2);   // dpr
  });

  it('rect.w = 0 produces isBlit sentinel at data[2]', () => {
    const blit = { ...DEFAULT, rect: { x: 0, y: 0, w: 0, h: 0 } };
    const data = buildGlassUniformData(blit);
    expect(data[2]).toBe(0); // rect.z = 0 = isBlit in shader
  });
});

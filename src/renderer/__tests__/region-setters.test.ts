import { describe, it, expect } from 'vitest';
import { GlassRenderer, MAX_GLASS_REGIONS } from '../GlassRenderer';
import { DEFAULT_GLASS_UNIFORMS, type GlassRegionState } from '../GlassRegionState';

/** Stub element -- no real DOM needed for setter tests */
const stubEl = {
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 50 }),
} as unknown as HTMLElement;

function makeRenderer(): { renderer: GlassRenderer; region: GlassRegionState } {
  const renderer = new GlassRenderer();
  const id = 1;
  const region: GlassRegionState = {
    id,
    element: stubEl,
    current: {
      ...DEFAULT_GLASS_UNIFORMS,
      tint: { ...DEFAULT_GLASS_UNIFORMS.tint },
      rect: { ...DEFAULT_GLASS_UNIFORMS.rect },
      resolution: { ...DEFAULT_GLASS_UNIFORMS.resolution },
    },
    target: {
      ...DEFAULT_GLASS_UNIFORMS,
      tint: { ...DEFAULT_GLASS_UNIFORMS.tint },
      rect: { ...DEFAULT_GLASS_UNIFORMS.rect },
      resolution: { ...DEFAULT_GLASS_UNIFORMS.resolution },
    },
    morphSpeed: 8,
  };
  (renderer as any)['regions'].set(id, region);
  return { renderer, region };
}

describe('GlassRenderer region setters', () => {
  it('setRegionParams mutates target cornerRadius, blurIntensity, opacity, refractionStrength', () => {
    const { renderer, region } = makeRenderer();
    renderer.setRegionParams(1, 20, 0.9, 0.5, 0.2);
    expect(region.target.cornerRadius).toBe(20);
    expect(region.target.blurIntensity).toBe(0.9);
    expect(region.target.opacity).toBe(0.5);
    expect(region.target.refractionStrength).toBe(0.2);
  });

  it('setRegionTint mutates target.tint r, g, b', () => {
    const { renderer, region } = makeRenderer();
    renderer.setRegionTint(1, 0.1, 0.2, 0.3);
    expect(region.target.tint.r).toBe(0.1);
    expect(region.target.tint.g).toBe(0.2);
    expect(region.target.tint.b).toBe(0.3);
  });

  it('setRegionAberration mutates target.aberration', () => {
    const { renderer, region } = makeRenderer();
    renderer.setRegionAberration(1, 2.5);
    expect(region.target.aberration).toBe(2.5);
  });

  it('setRegionSpecular mutates target.specularIntensity', () => {
    const { renderer, region } = makeRenderer();
    renderer.setRegionSpecular(1, 0.3);
    expect(region.target.specularIntensity).toBe(0.3);
  });

  it('setRegionRim mutates target.rimIntensity', () => {
    const { renderer, region } = makeRenderer();
    renderer.setRegionRim(1, 0.9);
    expect(region.target.rimIntensity).toBe(0.9);
  });

  it('setRegionMode mutates target.mode', () => {
    const { renderer, region } = makeRenderer();
    renderer.setRegionMode(1, 1);
    expect(region.target.mode).toBe(1);
  });

  it('setRegionMorphSpeed mutates region.morphSpeed (not target)', () => {
    const { renderer, region } = makeRenderer();
    renderer.setRegionMorphSpeed(1, 16);
    expect(region.morphSpeed).toBe(16);
  });

  it('setRegionContrast mutates target.contrast', () => {
    const { renderer, region } = makeRenderer();
    renderer.setRegionContrast(1, 1.5);
    expect(region.target.contrast).toBe(1.5);
  });

  it('setRegionSaturation mutates target.saturation', () => {
    const { renderer, region } = makeRenderer();
    renderer.setRegionSaturation(1, 0.7);
    expect(region.target.saturation).toBe(0.7);
  });

  it('setRegionBlurRadius mutates target.blurRadius', () => {
    const { renderer, region } = makeRenderer();
    renderer.setRegionBlurRadius(1, 15);
    expect(region.target.blurRadius).toBe(15);
  });

  it('setRegionFresnelIOR mutates target.fresnelIOR', () => {
    const { renderer, region } = makeRenderer();
    renderer.setRegionFresnelIOR(1, 1.8);
    expect(region.target.fresnelIOR).toBe(1.8);
  });

  it('setRegionFresnelExponent mutates target.fresnelExponent', () => {
    const { renderer, region } = makeRenderer();
    renderer.setRegionFresnelExponent(1, 3.0);
    expect(region.target.fresnelExponent).toBe(3.0);
  });

  it('setRegionEnvReflectionStrength mutates target.envReflectionStrength', () => {
    const { renderer, region } = makeRenderer();
    renderer.setRegionEnvReflectionStrength(1, 0.8);
    expect(region.target.envReflectionStrength).toBe(0.8);
  });

  it('setRegionGlareAngle mutates target.glareAngle', () => {
    const { renderer, region } = makeRenderer();
    renderer.setRegionGlareAngle(1, 90);
    expect(region.target.glareAngle).toBe(90);
  });

  it('calling any setter with unknown id does NOT throw', () => {
    const { renderer } = makeRenderer();
    const unknownId = 999;
    expect(() => renderer.setRegionParams(unknownId, 1, 1, 1, 1)).not.toThrow();
    expect(() => renderer.setRegionTint(unknownId, 1, 1, 1)).not.toThrow();
    expect(() => renderer.setRegionAberration(unknownId, 1)).not.toThrow();
    expect(() => renderer.setRegionSpecular(unknownId, 1)).not.toThrow();
    expect(() => renderer.setRegionRim(unknownId, 1)).not.toThrow();
    expect(() => renderer.setRegionMode(unknownId, 1)).not.toThrow();
    expect(() => renderer.setRegionMorphSpeed(unknownId, 1)).not.toThrow();
    expect(() => renderer.setRegionContrast(unknownId, 1)).not.toThrow();
    expect(() => renderer.setRegionSaturation(unknownId, 1)).not.toThrow();
    expect(() => renderer.setRegionBlurRadius(unknownId, 1)).not.toThrow();
    expect(() => renderer.setRegionFresnelIOR(unknownId, 1)).not.toThrow();
    expect(() => renderer.setRegionFresnelExponent(unknownId, 1)).not.toThrow();
    expect(() => renderer.setRegionEnvReflectionStrength(unknownId, 1)).not.toThrow();
    expect(() => renderer.setRegionGlareAngle(unknownId, 1)).not.toThrow();
  });

  it('setters do NOT mutate region.current (only target)', () => {
    const { renderer, region } = makeRenderer();
    const originalCornerRadius = region.current.cornerRadius;
    const originalTintR = region.current.tint.r;
    const originalAberration = region.current.aberration;

    renderer.setRegionParams(1, 99, 0.99, 0.99, 0.99);
    renderer.setRegionTint(1, 0.99, 0.99, 0.99);
    renderer.setRegionAberration(1, 99);

    expect(region.current.cornerRadius).toBe(originalCornerRadius);
    expect(region.current.tint.r).toBe(originalTintR);
    expect(region.current.aberration).toBe(originalAberration);
  });
});

describe('addRegion overflow guard', () => {
  it('MAX_GLASS_REGIONS equals 32', () => {
    expect(MAX_GLASS_REGIONS).toBe(32);
  });

  it('addRegion() throws Error when regions.size >= 32', () => {
    const renderer = new GlassRenderer();
    const regions = (renderer as any)['regions'] as Map<number, GlassRegionState>;

    // Fill 32 stub regions using keys 100-131 to avoid colliding with nextId
    for (let i = 0; i < 32; i++) {
      regions.set(100 + i, {
        id: 100 + i,
        element: stubEl,
        current: { ...DEFAULT_GLASS_UNIFORMS, tint: { ...DEFAULT_GLASS_UNIFORMS.tint }, rect: { ...DEFAULT_GLASS_UNIFORMS.rect }, resolution: { ...DEFAULT_GLASS_UNIFORMS.resolution } },
        target: { ...DEFAULT_GLASS_UNIFORMS, tint: { ...DEFAULT_GLASS_UNIFORMS.tint }, rect: { ...DEFAULT_GLASS_UNIFORMS.rect }, resolution: { ...DEFAULT_GLASS_UNIFORMS.resolution } },
        morphSpeed: 8,
      });
    }

    expect(regions.size).toBe(32);
    expect(() => renderer.addRegion(stubEl)).toThrowError(/MAX_GLASS_REGIONS/);
  });

  it('addRegion() succeeds when regions.size is 31 (just under the limit)', () => {
    const renderer = new GlassRenderer();
    const regions = (renderer as any)['regions'] as Map<number, GlassRegionState>;

    // Fill 31 stub regions using keys 100-130 to avoid colliding with nextId
    for (let i = 0; i < 31; i++) {
      regions.set(100 + i, {
        id: 100 + i,
        element: stubEl,
        current: { ...DEFAULT_GLASS_UNIFORMS, tint: { ...DEFAULT_GLASS_UNIFORMS.tint }, rect: { ...DEFAULT_GLASS_UNIFORMS.rect }, resolution: { ...DEFAULT_GLASS_UNIFORMS.resolution } },
        target: { ...DEFAULT_GLASS_UNIFORMS, tint: { ...DEFAULT_GLASS_UNIFORMS.tint }, rect: { ...DEFAULT_GLASS_UNIFORMS.rect }, resolution: { ...DEFAULT_GLASS_UNIFORMS.resolution } },
        morphSpeed: 8,
      });
    }

    expect(regions.size).toBe(31);
    expect(() => renderer.addRegion(stubEl)).not.toThrow();
    expect(regions.size).toBe(32);
  });

  it('after removing a region (reducing size below 32), addRegion() succeeds again', () => {
    const renderer = new GlassRenderer();
    const regions = (renderer as any)['regions'] as Map<number, GlassRegionState>;

    // Fill 32 stub regions using keys 100-131 to avoid colliding with nextId
    for (let i = 0; i < 32; i++) {
      regions.set(100 + i, {
        id: 100 + i,
        element: stubEl,
        current: { ...DEFAULT_GLASS_UNIFORMS, tint: { ...DEFAULT_GLASS_UNIFORMS.tint }, rect: { ...DEFAULT_GLASS_UNIFORMS.rect }, resolution: { ...DEFAULT_GLASS_UNIFORMS.resolution } },
        target: { ...DEFAULT_GLASS_UNIFORMS, tint: { ...DEFAULT_GLASS_UNIFORMS.tint }, rect: { ...DEFAULT_GLASS_UNIFORMS.rect }, resolution: { ...DEFAULT_GLASS_UNIFORMS.resolution } },
        morphSpeed: 8,
      });
    }

    // At limit -- should throw
    expect(() => renderer.addRegion(stubEl)).toThrowError(/MAX_GLASS_REGIONS/);

    // Remove one region
    renderer.removeRegion(100);
    expect(regions.size).toBe(31);

    // Now addRegion should succeed
    expect(() => renderer.addRegion(stubEl)).not.toThrow();
    expect(regions.size).toBe(32);
  });
});

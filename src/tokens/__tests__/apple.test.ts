import { describe, it, expect } from 'vitest';
import { APPLE_SPACING, APPLE_RADII, APPLE_CONTROL_SIZES } from '../apple';

describe('APPLE_SPACING', () => {
  it('has correct spacing values', () => {
    expect(APPLE_SPACING.xs).toBe(4);
    expect(APPLE_SPACING.sm).toBe(8);
    expect(APPLE_SPACING.md).toBe(16);
    expect(APPLE_SPACING.lg).toBe(20);
    expect(APPLE_SPACING.xl).toBe(24);
    expect(APPLE_SPACING.xxl).toBe(32);
    expect(APPLE_SPACING.xxxl).toBe(48);
  });

  it('is frozen to prevent mutation', () => {
    expect(Object.isFrozen(APPLE_SPACING)).toBe(true);
  });
});

describe('APPLE_RADII', () => {
  it('has correct radius values', () => {
    expect(APPLE_RADII.sm).toBe(8);
    expect(APPLE_RADII.md).toBe(14);
    expect(APPLE_RADII.lg).toBe(20);
    expect(APPLE_RADII.xl).toBe(28);
    expect(APPLE_RADII.pill).toBe(9999);
  });

  it('is frozen to prevent mutation', () => {
    expect(Object.isFrozen(APPLE_RADII)).toBe(true);
  });
});

describe('APPLE_CONTROL_SIZES', () => {
  it('has correct toggle dimensions', () => {
    expect(APPLE_CONTROL_SIZES.toggleWidth).toBe(51);
    expect(APPLE_CONTROL_SIZES.toggleHeight).toBe(31);
    expect(APPLE_CONTROL_SIZES.toggleThumbSize).toBe(27);
    expect(APPLE_CONTROL_SIZES.toggleThumbInset).toBe(2);
  });

  it('has correct slider dimensions', () => {
    expect(APPLE_CONTROL_SIZES.sliderTrackHeight).toBe(4);
    expect(APPLE_CONTROL_SIZES.sliderThumbSize).toBe(28);
  });

  it('has correct segmented control dimensions', () => {
    expect(APPLE_CONTROL_SIZES.segmentedHeight).toBe(32);
    expect(APPLE_CONTROL_SIZES.segmentedPadding).toBe(2);
  });

  it('has correct minimum tap target', () => {
    expect(APPLE_CONTROL_SIZES.minTapTarget).toBe(44);
  });

  it('is frozen to prevent mutation', () => {
    expect(Object.isFrozen(APPLE_CONTROL_SIZES)).toBe(true);
  });
});

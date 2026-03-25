/**
 * Apple design tokens for Liquid Glass controls.
 *
 * Values sourced from Apple HIG reference dimensions and community implementations.
 * LOW confidence on exact values -- pending iOS Simulator calibration against
 * the ios-reference app using Xcode view debugger at 1x logical resolution.
 *
 * All values are in logical pixels (CSS px).
 */

/**
 * Spacing scale based on Apple HIG layout guidelines.
 * Used for padding, margins, and gaps between glass controls.
 *
 * Source: Apple HIG spacing conventions, calibrated against iOS Simulator.
 */
export const APPLE_SPACING = Object.freeze({
  xs:    4,
  sm:    8,
  md:   16,
  lg:   20,
  xl:   24,
  xxl:  32,
  xxxl: 48,
} as const);

/**
 * Corner radii for glass surfaces at different scales.
 * Matches Apple's continuous (squircle) corner radius values.
 *
 * Source: Apple HIG corner radius specifications, calibrated against iOS Simulator.
 */
export const APPLE_RADII = Object.freeze({
  /** Chip, badge */
  sm:   8,
  /** Button, toggle track */
  md:   14,
  /** Card, sheet header */
  lg:   20,
  /** Modal, bottom sheet */
  xl:   28,
  /** Full-capsule elements (pill shape) */
  pill: 9999,
} as const);

/**
 * Control dimensions for Apple-native glass controls.
 * All values in logical pixels (CSS px) at 1x resolution.
 *
 * Source: Apple HIG control specifications and community reference implementations
 * (conorluddy/LiquidGlassReference, WWDC25 session screenshots).
 * LOW confidence -- verify against iOS Simulator before finalizing.
 */
export const APPLE_CONTROL_SIZES = Object.freeze({
  // Toggle / Switch (iOS UISwitch)
  toggleWidth:      51,
  toggleHeight:     31,
  toggleThumbSize:  27,
  toggleThumbInset:  2,

  // Slider
  sliderTrackHeight:  4,
  sliderThumbSize:   28,

  // Segmented Control
  segmentedHeight:   32,
  segmentedPadding:   2,

  // Standard tap target minimum (Apple HIG accessibility)
  minTapTarget:      44,
} as const);

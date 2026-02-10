/**
 * WCAG 2.1 contrast ratio utilities.
 * Implements W3C relative luminance and contrast ratio formulas
 * for evaluating text readability on glass surfaces.
 */

/**
 * Convert an sRGB component (0-1) to linear light.
 * Per W3C spec: if C <= 0.04045 then C/12.92 else ((C+0.055)/1.055)^2.4
 */
function sRGBtoLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Compute relative luminance of an sRGB color.
 * Per W3C: L = 0.2126 * R_lin + 0.7152 * G_lin + 0.0722 * B_lin
 * @param r Red component in [0, 1]
 * @param g Green component in [0, 1]
 * @param b Blue component in [0, 1]
 * @returns Relative luminance in [0, 1]
 */
export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * sRGBtoLinear(r) + 0.7152 * sRGBtoLinear(g) + 0.0722 * sRGBtoLinear(b);
}

/**
 * Compute WCAG contrast ratio between two luminance values.
 * Formula: (lighter + 0.05) / (darker + 0.05)
 * @param l1 Luminance of first color
 * @param l2 Luminance of second color
 * @returns Contrast ratio (1 to 21)
 */
export function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if a text/background color pair meets WCAG 2.1 AA for normal text.
 * Requires contrast ratio >= 4.5:1.
 * @param textColor RGB tuple [r, g, b] in [0, 1]
 * @param bgColor RGB tuple [r, g, b] in [0, 1]
 * @returns true if the pair meets WCAG AA
 */
export function meetsWCAG_AA(
  textColor: [number, number, number],
  bgColor: [number, number, number]
): boolean {
  const textLum = relativeLuminance(textColor[0], textColor[1], textColor[2]);
  const bgLum = relativeLuminance(bgColor[0], bgColor[1], bgColor[2]);
  return contrastRatio(textLum, bgLum) >= 4.5;
}

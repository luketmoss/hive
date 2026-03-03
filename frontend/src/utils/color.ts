/**
 * Contrast-aware text color utility.
 *
 * Uses the W3C relative-luminance formula (sRGB) to decide whether text
 * on a given background hex color should be white or black, targeting
 * WCAG AA contrast ratio (4.5:1).
 */

/**
 * Parse a hex color string into [r, g, b] in 0-255 range.
 * Supports "#RGB", "#RRGGBB", "RGB", and "RRGGBB" formats.
 */
export function parseHex(hex: string): [number, number, number] {
  let h = hex.replace(/^#/, '');

  // Expand shorthand (#ABC → AABBCC)
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }

  if (h.length !== 6) {
    return [0, 0, 0]; // fallback for invalid input
  }

  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);

  return [r, g, b];
}

/**
 * Compute the relative luminance of an sRGB color per WCAG 2.1.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 *
 * @returns luminance in [0, 1] where 0 = black, 1 = white
 */
export function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Return 'white' or 'black' depending on which provides better contrast
 * against the given hex background color.
 *
 * Uses the WCAG contrast-ratio formula:
 *   ratio = (L1 + 0.05) / (L2 + 0.05)
 *
 * We pick whichever text color yields a ratio >= 4.5:1.
 * In practice, a luminance threshold of ~0.179 maps correctly.
 */
export function getContrastTextColor(hexColor: string): 'white' | 'black' {
  const [r, g, b] = parseHex(hexColor);
  const lum = relativeLuminance(r, g, b);

  // Compare contrast ratios against white (luminance=1) and black (luminance=0)
  const contrastWithBlack = (lum + 0.05) / (0 + 0.05);
  const contrastWithWhite = (1 + 0.05) / (lum + 0.05);

  return contrastWithBlack >= contrastWithWhite ? 'black' : 'white';
}

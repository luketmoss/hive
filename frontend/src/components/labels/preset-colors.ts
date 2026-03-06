/**
 * Curated preset color palette for labels.
 * Each swatch includes a hex color and a human-readable name for
 * aria-label and tooltip (colorblind accessibility).
 */
export interface PresetColor {
  hex: string;
  name: string;
}

export const PRESET_COLORS: PresetColor[] = [
  { hex: '#E74C3C', name: 'Tomato Red' },
  { hex: '#F39C12', name: 'Sunset Orange' },
  { hex: '#F1C40F', name: 'Sunflower Yellow' },
  { hex: '#2ECC71', name: 'Emerald Green' },
  { hex: '#3498DB', name: 'Ocean Blue' },
  { hex: '#9B59B6', name: 'Royal Purple' },
  { hex: '#95A5A6', name: 'Slate Gray' },
  { hex: '#E91E63', name: 'Hot Pink' },
  { hex: '#00BCD4', name: 'Teal' },
  { hex: '#795548', name: 'Brown' },
];

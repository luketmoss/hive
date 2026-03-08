/**
 * Tests for ColorPicker and IconPicker preset values (issue #74).
 */
import { describe, it, expect } from 'vitest';
import { BOARD_COLORS } from './color-picker';
import { BOARD_ICONS } from './icon-picker';

describe('BOARD_COLORS', () => {
  it('has exactly 8 preset colors', () => {
    expect(BOARD_COLORS).toHaveLength(8);
  });

  it('all colors have a value (hex) and label', () => {
    for (const c of BOARD_COLORS) {
      expect(c.value).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.label.length).toBeGreaterThan(0);
    }
  });

  it('all color values are unique', () => {
    const values = BOARD_COLORS.map(c => c.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('BOARD_ICONS', () => {
  it('has 8–12 preset icons', () => {
    expect(BOARD_ICONS.length).toBeGreaterThanOrEqual(8);
    expect(BOARD_ICONS.length).toBeLessThanOrEqual(12);
  });

  it('all icons are non-empty strings', () => {
    for (const icon of BOARD_ICONS) {
      expect(typeof icon).toBe('string');
      expect(icon.length).toBeGreaterThan(0);
    }
  });

  it('all icons are unique', () => {
    expect(new Set(BOARD_ICONS).size).toBe(BOARD_ICONS.length);
  });
});

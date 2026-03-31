/**
 * Tests for IconPicker preset values (issue #74).
 */
import { describe, it, expect } from 'vitest';
import { BOARD_ICONS } from './icon-picker';

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

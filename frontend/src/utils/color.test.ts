import { describe, it, expect } from 'vitest';
import { parseHex, relativeLuminance, getContrastTextColor } from './color';

describe('parseHex', () => {
  it('parses 6-digit hex with hash', () => {
    expect(parseHex('#FF0000')).toEqual([255, 0, 0]);
    expect(parseHex('#00FF00')).toEqual([0, 255, 0]);
    expect(parseHex('#0000FF')).toEqual([0, 0, 255]);
  });

  it('parses 6-digit hex without hash', () => {
    expect(parseHex('FF8800')).toEqual([255, 136, 0]);
  });

  it('expands 3-digit shorthand', () => {
    expect(parseHex('#F00')).toEqual([255, 0, 0]);
    expect(parseHex('#ABC')).toEqual([170, 187, 204]);
  });

  it('handles lowercase hex', () => {
    expect(parseHex('#ff0000')).toEqual([255, 0, 0]);
    expect(parseHex('#abcdef')).toEqual([171, 205, 239]);
  });

  it('returns [0,0,0] for invalid input', () => {
    expect(parseHex('')).toEqual([0, 0, 0]);
    expect(parseHex('#GG0000')).toEqual([NaN, 0, 0]);
    expect(parseHex('#12')).toEqual([0, 0, 0]);
  });
});

describe('relativeLuminance', () => {
  it('returns 0 for black', () => {
    expect(relativeLuminance(0, 0, 0)).toBe(0);
  });

  it('returns 1 for white', () => {
    expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1, 4);
  });

  it('returns expected luminance for pure red', () => {
    // 0.2126 * linearize(255) = 0.2126
    expect(relativeLuminance(255, 0, 0)).toBeCloseTo(0.2126, 3);
  });

  it('returns expected luminance for pure green', () => {
    expect(relativeLuminance(0, 255, 0)).toBeCloseTo(0.7152, 3);
  });

  it('returns expected luminance for pure blue', () => {
    expect(relativeLuminance(0, 0, 255)).toBeCloseTo(0.0722, 3);
  });
});

describe('getContrastTextColor', () => {
  // AC1: Light backgrounds should get dark text
  it('returns "black" for white background', () => {
    expect(getContrastTextColor('#FFFFFF')).toBe('black');
  });

  it('returns "black" for yellow background (light)', () => {
    expect(getContrastTextColor('#FFFF00')).toBe('black');
  });

  it('returns "black" for light green background', () => {
    expect(getContrastTextColor('#90EE90')).toBe('black');
  });

  it('returns "black" for light blue background', () => {
    expect(getContrastTextColor('#ADD8E6')).toBe('black');
  });

  // AC1: Dark backgrounds should get white text
  it('returns "white" for black background', () => {
    expect(getContrastTextColor('#000000')).toBe('white');
  });

  it('returns "white" for navy background (dark)', () => {
    expect(getContrastTextColor('#000080')).toBe('white');
  });

  it('returns "white" for dark red background', () => {
    expect(getContrastTextColor('#8B0000')).toBe('white');
  });

  it('returns "white" for dark green background', () => {
    expect(getContrastTextColor('#006400')).toBe('white');
  });

  // AC4: Works for all stored hex colors (automatic calculation)
  it('handles shorthand hex colors', () => {
    expect(getContrastTextColor('#FFF')).toBe('black');
    expect(getContrastTextColor('#000')).toBe('white');
  });

  it('handles hex without hash prefix', () => {
    expect(getContrastTextColor('FFFFFF')).toBe('black');
    expect(getContrastTextColor('000000')).toBe('white');
  });

  // Mid-range colors
  it('returns correct contrast for mid-range gray (#808080)', () => {
    // Gray #808080 has luminance ~0.216; contrast with black (5.3:1) beats white (3.9:1)
    expect(getContrastTextColor('#808080')).toBe('black');
  });

  it('returns correct contrast for lighter gray (#C0C0C0)', () => {
    expect(getContrastTextColor('#C0C0C0')).toBe('black');
  });

  // Common label colors
  it('returns "black" for pastel pink (#FFB6C1)', () => {
    expect(getContrastTextColor('#FFB6C1')).toBe('black');
  });

  it('returns "white" for purple (#800080)', () => {
    expect(getContrastTextColor('#800080')).toBe('white');
  });

  it('returns "black" for orange (#FFA500)', () => {
    expect(getContrastTextColor('#FFA500')).toBe('black');
  });

  it('returns "white" for dark blue (#1976d2)', () => {
    expect(getContrastTextColor('#1976d2')).toBe('white');
  });

  // The default fallback color
  it('returns "white" for the default #999', () => {
    expect(getContrastTextColor('#999')).toBe('black');
  });
});

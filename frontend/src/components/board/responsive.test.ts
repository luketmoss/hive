import { describe, it, expect } from 'vitest';

// Read the global CSS to verify responsive rules are present.
// jsdom does not support media queries or computed styles from stylesheets,
// so we validate the CSS source directly via Node fs (available in vitest).
// @ts-ignore -- Node builtins available at test runtime, no @types/node in this project
import { readFileSync } from 'fs';
// @ts-ignore
import { resolve } from 'path';

// @ts-ignore -- __dirname available in vitest CJS context
const cssPath = resolve(__dirname, '../../global.css');
const css = readFileSync(cssPath, 'utf-8');

/**
 * Extract the content of a @media (max-width: 768px) block from CSS source.
 */
function extractMobileBlock(source: string): string {
  const re = /@media\s*\(\s*max-width:\s*768px\s*\)\s*\{/g;
  const match = re.exec(source);
  if (!match) return '';

  let depth = 1;
  let i = match.index + match[0].length;
  const start = i;
  while (i < source.length && depth > 0) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') depth--;
    i++;
  }
  return source.slice(start, i - 1);
}

const mobileBlock = extractMobileBlock(css);

describe('Responsive CSS (Issue #10)', () => {
  it('mobile media query block is found', () => {
    expect(mobileBlock.length).toBeGreaterThan(0);
  });

  // AC1: Filter selects have proper touch targets on mobile
  describe('AC1: Filter selects have 44px height and 16px font on mobile', () => {
    it('mobile media query sets min-height: 44px on filter-bar select', () => {
      expect(mobileBlock).toContain('.filter-bar select');
      expect(mobileBlock).toContain('min-height: 44px');
    });

    it('mobile media query sets font-size: 16px on filter-bar select', () => {
      expect(mobileBlock).toContain('font-size: 16px');
    });
  });

  // AC2: Columns fill available desktop width
  describe('AC2: Columns fill available desktop width', () => {
    it('column uses flex: 1 instead of fixed width', () => {
      expect(css).toMatch(/\.column\s*\{[^}]*flex:\s*1\s+1\s+0%/);
    });

    it('column has a max-width to prevent excessive stretching', () => {
      expect(css).toMatch(/\.column\s*\{[^}]*max-width:\s*600px/);
    });

    it('column has a min-width for readability', () => {
      expect(css).toMatch(/\.column\s*\{[^}]*min-width:\s*280px/);
    });

    it('mobile columns revert to fixed width for horizontal scroll', () => {
      expect(mobileBlock).toContain('.column');
      expect(mobileBlock).toMatch(/\.column\s*\{[^}]*flex:\s*0 0 280px/);
    });
  });

  // AC3: Drag handle CSS exists
  describe('AC3: Drag handle styles exist', () => {
    it('drag-handle class is defined with cursor: grab', () => {
      expect(css).toMatch(/\.drag-handle\s*\{[^}]*cursor:\s*grab/);
    });

    it('drag-handle-dots class exists for the grip icon', () => {
      expect(css).toContain('.drag-handle-dots');
    });

    it('card cursor changed from grab to default (only handle has grab)', () => {
      expect(css).toMatch(/\.card\s*\{[^}]*cursor:\s*default/);
    });
  });

  // AC4: touch-action: none on drag handle
  describe('AC4: Drag handle has touch-action none', () => {
    it('drag-handle has touch-action: none CSS property', () => {
      expect(css).toMatch(/\.drag-handle\s*\{[^}]*touch-action:\s*none/);
    });
  });

  // AC5: Mobile card spacing >= 10px gap
  describe('AC5: Mobile card spacing is touch-friendly', () => {
    it('mobile media query sets column-cards gap to at least 10px', () => {
      expect(mobileBlock).toContain('.column-cards');
      // Extract the gap value from the mobile block
      const gapMatch = mobileBlock.match(/\.column-cards\s*\{[^}]*gap:\s*(\d+)px/);
      expect(gapMatch).not.toBeNull();
      const gapValue = parseInt(gapMatch![1], 10);
      expect(gapValue).toBeGreaterThanOrEqual(10);
    });
  });
});

import { describe, it, expect } from 'vitest';

// Read the global CSS to verify dark-mode background rules are present.
// jsdom does not support computed styles from stylesheets,
// so we validate the CSS source directly via Node fs (available in vitest).
// @ts-ignore -- Node builtins available at test runtime
import { readFileSync } from 'fs';
// @ts-ignore
import { resolve } from 'path';

// @ts-ignore -- __dirname available in vitest CJS context
const cssPath = resolve(__dirname, '../../global.css');
const css = readFileSync(cssPath, 'utf-8');

/**
 * Extract the CSS block for a given selector (top-level, not inside media queries).
 * Returns the content between the braces.
 */
function extractRuleBlock(source: string, selector: string): string {
  // Escape dots in class selectors for regex
  const escaped = selector.replace(/\./g, '\\.');
  const re = new RegExp(escaped + '\\s*\\{', 'g');
  let match;
  while ((match = re.exec(source)) !== null) {
    // Skip matches inside @media blocks by checking for unbalanced braces before this point
    let depth = 0;
    for (let i = 0; i < match.index; i++) {
      if (source[i] === '{') depth++;
      if (source[i] === '}') depth--;
    }
    // depth > 0 means we're inside a nested block (e.g. @media)
    if (depth > 0) continue;

    // Extract the block content
    let braceDepth = 1;
    let j = match.index + match[0].length;
    const start = j;
    while (j < source.length && braceDepth > 0) {
      if (source[j] === '{') braceDepth++;
      if (source[j] === '}') braceDepth--;
      j++;
    }
    return source.slice(start, j - 1);
  }
  return '';
}

describe('Dark mode subtask input backgrounds (Issue #111)', () => {
  // AC1: Subtask title input has background: var(--color-surface)
  describe('AC1: .subtask-add-input has explicit background', () => {
    it('.subtask-add-input rule sets background: var(--color-surface)', () => {
      const block = extractRuleBlock(css, '.subtask-add-input');
      expect(block).toContain('background: var(--color-surface)');
    });
  });

  // AC2: Subtask date-edit input has background: var(--color-surface)
  describe('AC2: .subtask-date-input has explicit background', () => {
    it('.subtask-date-input rule sets background: var(--color-surface)', () => {
      const block = extractRuleBlock(css, '.subtask-date-input');
      expect(block).toContain('background: var(--color-surface)');
    });
  });

  // AC3: Light mode uses --color-surface which is #ffffff — verified by token definition
  describe('AC3: Light mode --color-surface is white', () => {
    it(':root defines --color-surface: #ffffff', () => {
      expect(css).toMatch(/:root\s*\{[^}]*--color-surface:\s*#ffffff/);
    });
  });

  // AC-133-3: .subtask-title-input has explicit color: var(--color-text)
  describe('AC3 (#133): .subtask-title-input has explicit color token', () => {
    it('.subtask-title-input rule sets color: var(--color-text)', () => {
      const block = extractRuleBlock(css, '.subtask-title-input');
      expect(block).toContain('color: var(--color-text)');
    });
  });

  // AC-133-5: .subtask-title-input:focus has box-shadow: var(--focus-ring)
  describe('AC5 (#133): .subtask-title-input:focus has visible focus ring', () => {
    it('.subtask-title-input:focus rule sets box-shadow: var(--focus-ring)', () => {
      const block = extractRuleBlock(css, '.subtask-title-input:focus');
      expect(block).toContain('box-shadow: var(--focus-ring)');
    });
  });

  // AC4: Dark mode contrast — --color-text on --color-surface meets WCAG AA
  describe('AC4: Dark mode tokens meet WCAG AA contrast', () => {
    it('dark theme defines --color-surface: #1e1e1e', () => {
      expect(css).toMatch(/\[data-theme="dark"\]\s*\{[^}]*--color-surface:\s*#1e1e1e/s);
    });

    it('dark theme defines --color-text: #e8eaed', () => {
      expect(css).toMatch(/\[data-theme="dark"\]\s*\{[^}]*--color-text:\s*#e8eaed/s);
    });

    it('contrast ratio of #e8eaed on #1e1e1e is >= 4.5:1 (WCAG AA)', () => {
      // Calculate WCAG 2.1 contrast ratio
      function sRGBtoLinear(c: number): number {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      }
      function luminance(r: number, g: number, b: number): number {
        return 0.2126 * sRGBtoLinear(r) + 0.7152 * sRGBtoLinear(g) + 0.0722 * sRGBtoLinear(b);
      }

      // #e8eaed text
      const textL = luminance(0xe8, 0xea, 0xed);
      // #1e1e1e background
      const bgL = luminance(0x1e, 0x1e, 0x1e);

      const ratio = (Math.max(textL, bgL) + 0.05) / (Math.min(textL, bgL) + 0.05);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });
});

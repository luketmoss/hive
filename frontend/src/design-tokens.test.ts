import { describe, it, expect } from 'vitest';

// @ts-ignore -- Node builtins available at test runtime
import { readFileSync } from 'fs';
// @ts-ignore
import { resolve } from 'path';

// @ts-ignore -- __dirname available in vitest CJS context
const cssPath = resolve(__dirname, 'global.css');
const css = readFileSync(cssPath, 'utf-8');

/**
 * Extract the content of the :root block from CSS source.
 */
function extractRootBlock(source: string): string {
  const re = /:root\s*\{/g;
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

const rootBlock = extractRootBlock(css);

describe('Design token: --color-primary-light (Issue #104)', () => {
  // AC1: Token defined in :root
  describe('AC1: Token defined in :root', () => {
    it('--color-primary-light is defined in :root', () => {
      expect(rootBlock).toContain('--color-primary-light');
    });

    it('uses color-mix with 8% primary', () => {
      expect(rootBlock).toMatch(
        /--color-primary-light:\s*color-mix\(in srgb,\s*var\(--color-primary\)\s+8%,\s*transparent\)/
      );
    });

    it('no dark-mode override for --color-primary-light', () => {
      const darkThemeMatch = css.match(/\[data-theme=["']dark["']\]\s*\{([^}]*)\}/);
      if (darkThemeMatch) {
        expect(darkThemeMatch[1]).not.toContain('--color-primary-light');
      }
    });
  });

  // AC2: Ad-hoc primary tints unified under the token
  describe('AC2: Ad-hoc tints replaced with var(--color-primary-light)', () => {
    it('.share-btn:hover uses var(--color-primary-light)', () => {
      const match = css.match(/\.share-btn:hover\s*\{[^}]*\}/);
      expect(match).not.toBeNull();
      expect(match![0]).toContain('var(--color-primary-light)');
      expect(match![0]).not.toContain('rgba(var(--color-primary-rgb)');
    });

    it('.share-member-highlight uses var(--color-primary-light)', () => {
      const match = css.match(/\.share-member-highlight\s*\{[^}]*\}/);
      expect(match).not.toBeNull();
      expect(match![0]).toContain('var(--color-primary-light)');
      expect(match![0]).not.toContain('rgba(var(--color-primary-rgb)');
    });

    it('.quick-date-chip:hover uses var(--color-primary-light)', () => {
      const match = css.match(/\.quick-date-chip:hover\s*\{[^}]*\}/);
      expect(match).not.toBeNull();
      expect(match![0]).toContain('var(--color-primary-light)');
      expect(match![0]).not.toContain('color-mix(in srgb, var(--color-primary) 8%');
    });

    it('.btn-icon-danger:hover no longer has transparent primary-rgb fallback', () => {
      const match = css.match(/\.btn-icon-danger:hover\s*\{[^}]*\}/);
      expect(match).not.toBeNull();
      expect(match![0]).not.toContain('rgba(var(--color-primary-rgb)');
    });

    it('@keyframes share-fade retains 15% primary-rgb value', () => {
      const match = css.match(/@keyframes share-fade\s*\{[^}]*from\s*\{[^}]*\}[^}]*\}/);
      expect(match).not.toBeNull();
      expect(match![0]).toContain('rgba(var(--color-primary-rgb), 0.15)');
    });
  });
});

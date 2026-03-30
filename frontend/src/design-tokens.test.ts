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

// Helper: extract [data-theme="dark"] block
function extractDarkBlock(source: string): string {
  const re = /\[data-theme=["']dark["']\]\s*\{/g;
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

const darkBlock = extractDarkBlock(css);

describe('Design tokens: shared vocabulary (Issue #191)', () => {
  describe('AC1: Spacing scale tokens', () => {
    it.each([
      ['--space-xs', '4px'],
      ['--space-sm', '8px'],
      ['--space-md', '16px'],
      ['--space-lg', '24px'],
      ['--space-xl', '32px'],
      ['--space-2xl', '48px'],
    ])('%s equals %s in :root', (token, value) => {
      expect(rootBlock).toMatch(new RegExp(`${token}:\\s*${value}`));
    });
  });

  describe('AC2: Typography scale and font-stack tokens', () => {
    it.each([
      ['--text-xs', '0.75rem'],
      ['--text-sm', '0.875rem'],
      ['--text-base', '1rem'],
      ['--text-lg', '1.125rem'],
      ['--text-xl', '1.25rem'],
      ['--text-2xl', '1.5rem'],
    ])('%s equals %s in :root', (token, value) => {
      expect(rootBlock).toMatch(new RegExp(`${token}:\\s*${value}`));
    });

    it('--font-sans is defined in :root', () => {
      expect(rootBlock).toMatch(/--font-sans:/);
    });

    it('--font-mono is defined in :root', () => {
      expect(rootBlock).toMatch(/--font-mono:/);
    });
  });

  describe('AC3: Transition tokens', () => {
    it('--transition-fast equals 150ms ease', () => {
      expect(rootBlock).toMatch(/--transition-fast:\s*150ms ease/);
    });

    it('--transition-normal equals 250ms ease', () => {
      expect(rootBlock).toMatch(/--transition-normal:\s*250ms ease/);
    });
  });

  describe('AC4: Surface and text colour tokens', () => {
    it('--color-surface-raised is #f8f9fa in :root', () => {
      expect(rootBlock).toMatch(/--color-surface-raised:\s*#f8f9fa/);
    });

    it('--color-border-light is #969696 in :root', () => {
      expect(rootBlock).toMatch(/--color-border-light:\s*#969696/);
    });

    it('--color-text-muted is #767676 in :root', () => {
      expect(rootBlock).toMatch(/--color-text-muted:\s*#767676/);
    });

    it('--color-surface-raised is #2a2a2a in [data-theme="dark"]', () => {
      expect(darkBlock).toMatch(/--color-surface-raised:\s*#2a2a2a/);
    });

    it('--color-border-light is #787878 in [data-theme="dark"]', () => {
      expect(darkBlock).toMatch(/--color-border-light:\s*#787878/);
    });

    it('--color-text-muted is #8b8b8b in [data-theme="dark"]', () => {
      expect(darkBlock).toMatch(/--color-text-muted:\s*#8b8b8b/);
    });
  });

  describe('AC5: Border radius tokens', () => {
    it('--radius-md is defined in :root', () => {
      expect(rootBlock).toMatch(/--radius-md:/);
    });

    it('--radius-lg equals 16px in :root', () => {
      expect(rootBlock).toMatch(/--radius-lg:\s*16px/);
    });

    it('--radius-full equals 9999px in :root', () => {
      expect(rootBlock).toMatch(/--radius-full:\s*9999px/);
    });

    it('existing --radius remains 8px', () => {
      expect(rootBlock).toMatch(/--radius:\s*8px/);
    });

    it('existing --radius-sm remains 4px', () => {
      expect(rootBlock).toMatch(/--radius-sm:\s*4px/);
    });
  });
});

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

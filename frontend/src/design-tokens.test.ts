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

describe('Design tokens: gold color scheme (Issue #190)', () => {
  describe('AC1: Gold primary tokens in light mode', () => {
    it('--color-primary is #C49200 in :root', () => {
      expect(rootBlock).toMatch(/--color-primary:\s*#C49200/);
    });
    it('--color-primary-hover is #A67B00 in :root', () => {
      expect(rootBlock).toMatch(/--color-primary-hover:\s*#A67B00/);
    });
    it('--color-primary-rgb is 196, 146, 0 in :root', () => {
      expect(rootBlock).toMatch(/--color-primary-rgb:\s*196, 146, 0/);
    });
    it('--color-focus is #C49200 in :root', () => {
      expect(rootBlock).toMatch(/--color-focus:\s*#C49200/);
    });
  });

  describe('AC2: Gold primary tokens in dark mode', () => {
    it('--color-primary is #F5B700 in dark mode', () => {
      expect(darkBlock).toMatch(/--color-primary:\s*#F5B700/);
    });
    it('--color-primary-hover is #FFD54F in dark mode', () => {
      expect(darkBlock).toMatch(/--color-primary-hover:\s*#FFD54F/);
    });
    it('--color-primary-rgb is 245, 183, 0 in dark mode', () => {
      expect(darkBlock).toMatch(/--color-primary-rgb:\s*245, 183, 0/);
    });
    it('--color-focus is #F5B700 in dark mode', () => {
      expect(darkBlock).toMatch(/--color-focus:\s*#F5B700/);
    });
  });

  describe('AC3: Accent token for logo/branding', () => {
    it('--color-accent is #F5B700 in :root', () => {
      expect(rootBlock).toMatch(/--color-accent:\s*#F5B700/);
    });
    it('--color-accent is #F5B700 in dark mode', () => {
      expect(darkBlock).toMatch(/--color-accent:\s*#F5B700/);
    });
  });

  describe('AC4: WCAG AA contrast for interactive elements', () => {
    it('.btn-primary uses dark text (#1f1f1f) not white', () => {
      const match = css.match(/\.btn-primary\s*\{[^}]*\}/);
      expect(match).not.toBeNull();
      expect(match![0]).toContain('color: #1f1f1f');
      expect(match![0]).not.toContain('color: white');
    });
  });

  describe('AC5: No blue primary remnants', () => {
    it('no #1976d2 in global.css', () => {
      expect(css).not.toContain('#1976d2');
    });
    it('no #90caf9 in global.css', () => {
      expect(css).not.toContain('#90caf9');
    });
    it('no #1565c0 in global.css', () => {
      expect(css).not.toContain('#1565c0');
    });
    it('no #64b5f6 in global.css', () => {
      expect(css).not.toContain('#64b5f6');
    });
    it('.column-sort-active SVG uses gold fill in light mode', () => {
      const match = css.match(/\.column-sort-active\s*\{[^}]*\}/);
      expect(match).not.toBeNull();
      expect(match![0]).toContain("fill='%23C49200'");
    });
    it('[data-theme="dark"] .column-sort-active SVG uses gold fill', () => {
      const match = css.match(/\[data-theme="dark"\]\s*\.column-sort-active\s*\{[^}]*\}/);
      expect(match).not.toBeNull();
      expect(match![0]).toContain("fill='%23F5B700'");
    });
  });

  describe('AC6: Semantic and neutral tokens unchanged', () => {
    it('--color-bg is #f0f2f5', () => {
      expect(rootBlock).toMatch(/--color-bg:\s*#f0f2f5/);
    });
    it('--color-surface is #ffffff', () => {
      expect(rootBlock).toMatch(/--color-surface:\s*#ffffff/);
    });
    it('--color-border is #dadce0', () => {
      expect(rootBlock).toMatch(/--color-border:\s*#dadce0/);
    });
    it('--color-text is #1f1f1f', () => {
      expect(rootBlock).toMatch(/--color-text:\s*#1f1f1f/);
    });
    it('--color-text-secondary is #5f6368', () => {
      expect(rootBlock).toMatch(/--color-text-secondary:\s*#5f6368/);
    });
  });
});

describe('UX alignment (Issue #192)', () => {
  describe('AC1: Login card styling', () => {
    it('login-card has max-width 400px', () => {
      const match = css.match(/\.login-card\s*\{[^}]*\}/);
      expect(match).not.toBeNull();
      expect(match![0]).toContain('max-width: 400px');
    });
    it('login-card has border-radius var(--radius-lg)', () => {
      const match = css.match(/\.login-card\s*\{[^}]*\}/);
      expect(match![0]).toContain('border-radius: var(--radius-lg)');
    });
    it('login-card has width 100%', () => {
      const match = css.match(/\.login-card\s*\{[^}]*\}/);
      expect(match![0]).toContain('width: 100%');
    });
    it('login-screen has padding var(--space-lg)', () => {
      const match = css.match(/\.login-screen\s*\{[^}]*\}/);
      expect(match![0]).toContain('padding: var(--space-lg)');
    });
    it('login-card h1 uses var(--text-2xl)', () => {
      const match = css.match(/\.login-card h1\s*\{[^}]*\}/);
      expect(match![0]).toContain('var(--text-2xl)');
    });
    it('login-btn has width 100% and font-weight 600', () => {
      const match = css.match(/\.login-btn\s*\{[^}]*\}/);
      expect(match![0]).toContain('width: 100%');
      expect(match![0]).toContain('font-weight: 600');
    });
  });

  describe('AC2: Button touch targets', () => {
    it('.btn has min-height 48px', () => {
      const match = css.match(/\.btn\s*\{[^}]*\}/);
      expect(match![0]).toContain('min-height: 48px');
    });
    it('.btn has font-weight 600', () => {
      const match = css.match(/\.btn\s*\{[^}]*\}/);
      expect(match![0]).toContain('font-weight: 600');
    });
    it('.btn has border-radius var(--radius)', () => {
      const match = css.match(/\.btn\s*\{[^}]*\}/);
      expect(match![0]).toContain('border-radius: var(--radius)');
    });
  });

  describe('AC3: Form input styling', () => {
    it('form inputs have padding 12px 16px', () => {
      const match = css.match(/\.form-field input,[\s\S]*?\.form-field textarea\s*\{[^}]*\}/);
      expect(match).not.toBeNull();
      expect(match![0]).toContain('padding: 12px 16px');
    });
    it('form inputs have min-height 48px', () => {
      const match = css.match(/\.form-field input,[\s\S]*?\.form-field textarea\s*\{[^}]*\}/);
      expect(match![0]).toContain('min-height: 48px');
    });
    it('form inputs have font-size 16px', () => {
      const match = css.match(/\.form-field input,[\s\S]*?\.form-field textarea\s*\{[^}]*\}/);
      expect(match![0]).toContain('font-size: 16px');
    });
    it('form inputs have border-radius var(--radius)', () => {
      const match = css.match(/\.form-field input,[\s\S]*?\.form-field textarea\s*\{[^}]*\}/);
      expect(match![0]).toContain('border-radius: var(--radius)');
    });
    it('form inputs use var(--color-surface-raised) background', () => {
      const match = css.match(/\.form-field input,[\s\S]*?\.form-field textarea\s*\{[^}]*\}/);
      expect(match![0]).toContain('var(--color-surface-raised)');
    });
  });

  describe('AC4: Modal styling', () => {
    it('overlay uses rgba(0,0,0,0.4) via --overlay-4xl', () => {
      expect(rootBlock).toMatch(/--overlay-4xl:\s*rgba\(0,\s*0,\s*0,\s*0\.4\)/);
    });
    it('.modal has border-radius var(--radius-lg)', () => {
      const match = css.match(/\.modal\s*\{[^}]*\}/);
      expect(match![0]).toContain('border-radius: var(--radius-lg)');
    });
  });

  describe('AC5: Toast at top-center', () => {
    it('.toast uses top positioning', () => {
      const match = css.match(/\.toast\s*\{[^}]*\}/);
      expect(match![0]).toContain('top: calc(var(--header-height');
      expect(match![0]).not.toContain('bottom:');
    });
    it('toast-in animates from translateY(-16px)', () => {
      const match = css.match(/@keyframes toast-in\s*\{[^}]*from\s*\{[^}]*\}/);
      expect(match).not.toBeNull();
      expect(match![0]).toContain('translateY(-16px)');
    });
  });

  describe('AC6: Theme toggle surface-elevate style', () => {
    it('.theme-toggle-active uses surface background', () => {
      const match = css.match(/\.theme-toggle-active\s*\{[^}]*\}/);
      expect(match![0]).toContain('var(--color-surface)');
      expect(match![0]).not.toContain('var(--color-primary)');
    });
    it('.theme-toggle-active uses color: var(--color-text)', () => {
      const match = css.match(/\.theme-toggle-active\s*\{[^}]*\}/);
      expect(match![0]).toContain('color: var(--color-text)');
      expect(match![0]).not.toContain('color: white');
    });
    it('.theme-toggle-active has box-shadow', () => {
      const match = css.match(/\.theme-toggle-active\s*\{[^}]*\}/);
      expect(match![0]).toContain('box-shadow:');
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

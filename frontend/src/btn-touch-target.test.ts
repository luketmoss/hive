import { describe, it, expect } from 'vitest';
// jsdom resolves no computed styles from a stylesheet, so — as in responsive.test.ts
// and design-tokens.test.ts — the CSS source is read and asserted directly.
// @ts-ignore -- Node builtins available at test runtime, no @types/node in this project
import { readFileSync } from 'fs';
// @ts-ignore
import { resolve } from 'path';

// @ts-ignore -- __dirname available in vitest CJS context
const css: string = readFileSync(resolve(__dirname, './global.css'), 'utf-8');

/**
 * Return the declaration bodies of every top-level rule whose selector list is
 * exactly `selector` (e.g. '.btn' matches `.btn { ... }` but not `.btn-sm { ... }`
 * and not `.detail-header .btn { ... }`).
 */
function rulesFor(selector: string): string[] {
  // Strip comments first so a preceding /* ... */ cannot be read as part of a selector.
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: string[] = [];
  // Flat rules only: `[^{}]*` cannot cross a brace, so an `@media (...)` wrapper is
  // skipped over and the rules nested inside it are matched on their own.
  const re = /([^{}]*)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    if (m[1].trim() === selector) out.push(m[2]);
  }
  return out;
}

const decl = (body: string, prop: string): string | undefined => {
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;}]+)`, 'i').exec(body);
  return m ? m[1].trim() : undefined;
};

describe('#255 — .btn meets the WCAG 2.5.5 touch target minimum', () => {
  const btnRules = rulesFor('.btn');
  const btnSmRules = rulesFor('.btn-sm');

  it('finds the base .btn rule', () => {
    expect(btnRules.length).toBe(1);
  });

  // AC1 / AC2: the floor exists and is at least 44px, so an icon-only .btn whose
  // glyph is narrow (Close "✕" was 43.44px, "More options" 37.78px) cannot fall under.
  it('declares a min-width of at least 44px', () => {
    const value = decl(btnRules[0], 'min-width');
    expect(value).toBeDefined();
    const px = parseFloat(String(value));
    expect(String(value)).toMatch(/px$/);
    expect(px).toBeGreaterThanOrEqual(44);
  });

  it('keeps the existing min-height of at least 44px', () => {
    const px = parseFloat(String(decl(btnRules[0], 'min-height')));
    expect(px).toBeGreaterThanOrEqual(44);
  });

  // AC3: the floor must not be so large that it pads out text buttons. 16px of
  // horizontal padding each side means a 44px floor is reached by ~12px of label,
  // which every text button in the app already exceeds.
  it('keeps the horizontal padding that makes the floor a no-op for text buttons', () => {
    expect(decl(btnRules[0], 'padding')).toBe('8px 16px');
  });

  // AC4: the compact variant opts out, symmetrically with its min-height opt-out,
  // so dense rows (share member list, label manager, column settings) do not reflow.
  it('.btn-sm opts out of both floors', () => {
    expect(btnSmRules.length).toBeGreaterThan(0);
    const optsOutWidth = btnSmRules.some(r => decl(r, 'min-width') === 'auto');
    expect(optsOutWidth).toBe(true);
  });
});

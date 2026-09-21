import { describe, it, expect } from 'vitest';
// jsdom resolves no computed styles from a stylesheet, so — as in btn-touch-target.test.ts
// (#255) and responsive.test.ts — the CSS source is read and asserted directly.
// @ts-ignore -- Node builtins available at test runtime, no @types/node in this project
import { readFileSync } from 'fs';
// @ts-ignore
import { resolve } from 'path';

// @ts-ignore -- __dirname available in vitest CJS context
const css: string = readFileSync(resolve(__dirname, './global.css'), 'utf-8');

/** Top-level rules (outside any @media) whose selector is exactly `selector`. */
function topLevelRulesFor(selector: string): string[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  let selectorStart = 0;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') {
      if (depth === 0) {
        const sel = source.slice(selectorStart, i).trim();
        start = i + 1;
        if (sel === selector) {
          // find the matching close brace of this flat rule
          const end = source.indexOf('}', start);
          out.push(source.slice(start, end));
        }
      }
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) selectorStart = i + 1;
    } else if (ch === ';' && depth === 0) {
      selectorStart = i + 1; // e.g. @import
    }
  }
  return out;
}

const decl = (body: string, prop: string): string | undefined => {
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;}]+)`, 'i').exec(body);
  return m ? m[1].trim() : undefined;
};

describe('#259 — .filter-toggle meets the WCAG 2.5.5 touch target minimum', () => {
  const rules = topLevelRulesFor('.filter-toggle');

  it('finds the base .filter-toggle rule outside any media query', () => {
    expect(rules.length).toBe(1);
  });

  // The floor sits on the base rule, not only the 768px block, so it cannot be
  // lost if the toggle is ever shown at another breakpoint. It is inert on
  // desktop, where the base rule keeps the toggle display: none.
  it.each(['min-height', 'min-width'])('declares %s of at least 44px', (prop) => {
    const value = decl(rules[0], prop);
    expect(value).toBeDefined();
    expect(String(value)).toMatch(/px$/);
    expect(parseFloat(String(value))).toBeGreaterThanOrEqual(44);
  });

  it('stays hidden on desktop', () => {
    expect(decl(rules[0], 'display')).toBe('none');
  });
});

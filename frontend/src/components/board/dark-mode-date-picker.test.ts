import { describe, it, expect } from 'vitest';

// @ts-ignore -- Node builtins available at test runtime
import { readFileSync } from 'fs';
// @ts-ignore
import { resolve } from 'path';

// @ts-ignore -- __dirname available in vitest CJS context
const cssPath = resolve(__dirname, '../../global.css');
const css = readFileSync(cssPath, 'utf-8');

describe('Dark mode date picker icon visibility (Issue #167)', () => {
  // AC1 + AC2: Date inputs in dark mode get color-scheme: dark
  // This single rule covers all date inputs — card detail modal, subtask inline editor,
  // subtask creation row, and create-item modal.
  describe('AC1/AC2: dark mode date inputs have color-scheme: dark', () => {
    it('[data-theme="dark"] input[type="date"] sets color-scheme: dark', () => {
      // Match the selector and its block content
      const re = /\[data-theme="dark"\]\s+input\[type="date"\]\s*\{([^}]*)\}/;
      const match = css.match(re);
      expect(match).not.toBeNull();
      expect(match![1]).toContain('color-scheme: dark');
    });
  });

  // AC3: Light mode unaffected — no color-scheme override on :root date inputs
  describe('AC3: light mode date inputs have no color-scheme override', () => {
    it(':root does not set color-scheme on input[type="date"]', () => {
      // Ensure there is no :root input[type="date"] { color-scheme } rule
      const re = /:root\s+input\[type="date"\]\s*\{[^}]*color-scheme/;
      expect(css).not.toMatch(re);
    });
  });
});

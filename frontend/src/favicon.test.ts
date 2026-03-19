import { describe, it, expect } from 'vitest';

// @ts-ignore -- Node builtins available at test runtime
import { readFileSync } from 'fs';
// @ts-ignore
import { resolve } from 'path';

// @ts-ignore -- __dirname available in vitest CJS context
const indexPath = resolve(__dirname, '../index.html');
// @ts-ignore
const logoPath = resolve(__dirname, '../public/logo.svg');

describe('Favicon (Issue #30 AC2)', () => {
  it('index.html references hive-favicon.svg as the favicon', () => {
    const html = readFileSync(indexPath, 'utf-8');
    expect(html).toContain('rel="icon"');
    expect(html).toContain('href="hive-favicon.svg"');
  });

  it('does not contain the old bee emoji favicon', () => {
    const html = readFileSync(indexPath, 'utf-8');
    expect(html).not.toContain('🐝');
  });

  it('logo.svg exists in the public directory', () => {
    const svg = readFileSync(logoPath, 'utf-8');
    expect(svg).toContain('<svg');
    expect(svg).toContain('#1976d2');
  });
});

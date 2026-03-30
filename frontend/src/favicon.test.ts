import { describe, it, expect } from 'vitest';

// @ts-ignore -- Node builtins available at test runtime
import { readFileSync } from 'fs';
// @ts-ignore
import { resolve } from 'path';

// @ts-ignore -- __dirname available in vitest CJS context
const indexPath = resolve(__dirname, '../index.html');
// @ts-ignore
const logoPath = resolve(__dirname, '../public/logo.svg');

// @ts-ignore
const faviconPath = resolve(__dirname, '../public/hive-favicon.svg');
// @ts-ignore
const manifestPath = resolve(__dirname, '../public/manifest.json');

const iconFiles = [
  'hive-icon-192.svg',
  'hive-icon-192-maskable.svg',
  'hive-icon-512.svg',
  'hive-icon-512-maskable.svg',
];

describe('Gold icon branding (Issue #188)', () => {
  it('AC4: favicon SVG uses gold fill #F5B700', () => {
    const svg = readFileSync(faviconPath, 'utf-8');
    expect(svg).toContain('#F5B700');
    expect(svg).not.toContain('#1976d2');
  });

  it.each(iconFiles)('AC5: %s uses gold rect fill #F5B700', (file) => {
    // @ts-ignore
    const svg = readFileSync(resolve(__dirname, '../public', file), 'utf-8');
    expect(svg).toContain('fill="#F5B700"');
    expect(svg).not.toContain('#1976d2');
  });

  it('AC5: manifest.json theme_color is #F5B700', () => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    expect(manifest.theme_color).toBe('#F5B700');
  });

  it('AC5: manifest.json background_color is #F5B700', () => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    expect(manifest.background_color).toBe('#F5B700');
  });
});

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
    expect(svg).toContain('#F5B700');
  });
});

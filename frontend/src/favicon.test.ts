import { describe, it, expect } from 'vitest';

// @ts-ignore -- Node builtins available at test runtime
import { readFileSync, existsSync } from 'fs';
// @ts-ignore
import { resolve } from 'path';

// The icon family follows Keel's ui/docs/design/app-icons.md: the mark small,
// the tile large, one ground colour for theme_color.

// @ts-ignore -- __dirname available in vitest CJS context
const pub = (file: string) => resolve(__dirname, '../public', file);
// @ts-ignore
const html = readFileSync(resolve(__dirname, '../index.html'), 'utf-8');
const manifest = JSON.parse(readFileSync(pub('manifest.webmanifest'), 'utf-8'));
const tile = readFileSync(pub('hive-app-icon.svg'), 'utf-8');
const maskable = readFileSync(pub('hive-app-icon-maskable.svg'), 'utf-8');

const GROUND = '#2a1a0a';

describe('Hive app icons', () => {
  it.each([
    'hive-mark.svg',
    'hive-app-icon.svg',
    'hive-app-icon-maskable.svg',
    'hive-app-icon-180.png',
    'hive-app-icon-192.png',
    'hive-app-icon-512.png',
    'hive-app-icon-maskable-512.png',
    'favicon.ico',
  ])('%s exists in public/', (file) => {
    expect(existsSync(pub(file))).toBe(true);
  });

  it('the mark is on transparency and uses the gold accent', () => {
    const mark = readFileSync(pub('hive-mark.svg'), 'utf-8');
    expect(mark).not.toMatch(/<rect/);
    expect(mark).toContain('#f5b700');
  });

  it('the tile is a rounded rect of the ground, with the template sun', () => {
    expect(tile).toContain(`<rect width="1024" height="1024" rx="220" fill="${GROUND}"/>`);
    expect(tile).toContain('r="105"');
    expect(tile).toContain('scale(2.95)');
  });

  it('the maskable is full bleed and scaled to 86%', () => {
    expect(maskable).toContain(`<rect width="1024" height="1024" fill="${GROUND}"/>`);
    expect(maskable).not.toContain('rx=');
    expect(maskable).toContain('scale(.86)');
  });

  it('theme_color, background_color and the meta tag are the ground colour', () => {
    expect(manifest.theme_color).toBe(GROUND);
    expect(manifest.background_color).toBe(GROUND);
    expect(html).toContain(`<meta name="theme-color" content="${GROUND}" />`);
  });

  it('no manifest icon is both any and maskable', () => {
    const any = manifest.icons.filter((i: any) => i.purpose === 'any').map((i: any) => i.src);
    const mask = manifest.icons.filter((i: any) => i.purpose === 'maskable').map((i: any) => i.src);
    expect(mask).toEqual(['hive-app-icon-maskable-512.png']);
    expect(any.some((s: string) => mask.includes(s))).toBe(false);
  });

  it('start_url and scope are relative', () => {
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
  });

  it('index.html declares every icon through %BASE_URL%', () => {
    expect(html).toContain('<link rel="icon" href="%BASE_URL%favicon.ico" sizes="32x32" />');
    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="%BASE_URL%hive-mark.svg" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="%BASE_URL%hive-app-icon-180.png" />');
    expect(html).toContain('<link rel="manifest" href="%BASE_URL%manifest.webmanifest" />');
  });

  it('does not contain the old bee emoji favicon', () => {
    expect(html).not.toContain('🐝');
  });
});

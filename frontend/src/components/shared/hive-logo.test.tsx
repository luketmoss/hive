import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/preact';
import { HiveLogo } from './hive-logo';

describe('HiveLogo (Issue #30 AC1)', () => {
  it('renders an SVG element with aria-hidden="true"', () => {
    const { container } = render(<HiveLogo />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('aria-hidden')).toBe('true');
  });

  it('defaults to size 24', () => {
    const { container } = render(<HiveLogo />);
    const svg = container.querySelector('svg');
    expect(svg!.getAttribute('width')).toBe('24');
    expect(svg!.getAttribute('height')).toBe('24');
  });

  it('accepts a custom size prop', () => {
    const { container } = render(<HiveLogo size={48} />);
    const svg = container.querySelector('svg');
    expect(svg!.getAttribute('width')).toBe('48');
    expect(svg!.getAttribute('height')).toBe('48');
  });

  it('forwards the class prop to the root SVG', () => {
    const { container } = render(<HiveLogo class="my-class" />);
    const svg = container.querySelector('svg');
    expect(svg!.classList.contains('my-class')).toBe(true);
  });

  it('uses var(--color-primary) as the fill colour', () => {
    const { container } = render(<HiveLogo />);
    const polygon = container.querySelector('polygon');
    expect(polygon).not.toBeNull();
    expect(polygon!.getAttribute('fill')).toBe('var(--color-primary)');
  });

  it('contains the hexagon and checkmark shapes', () => {
    const { container } = render(<HiveLogo />);
    const polygon = container.querySelector('polygon');
    const path = container.querySelector('path');
    expect(polygon).not.toBeNull();
    expect(path).not.toBeNull();
    expect(path!.getAttribute('stroke')).toBe('white');
  });
});

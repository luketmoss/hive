import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/preact';
import { HiveLogo } from './hive-logo';

describe('HiveLogo', () => {
  it('renders the hive mark as a decorative image', () => {
    const { container } = render(<HiveLogo />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toMatch(/hive-mark\.svg$/);
    expect(img!.getAttribute('alt')).toBe('');
  });

  it('defaults to size 24', () => {
    const { container } = render(<HiveLogo />);
    const img = container.querySelector('img');
    expect(img!.getAttribute('width')).toBe('24');
    expect(img!.getAttribute('height')).toBe('24');
  });

  it('accepts a custom size prop', () => {
    const { container } = render(<HiveLogo size={48} />);
    const img = container.querySelector('img');
    expect(img!.getAttribute('width')).toBe('48');
    expect(img!.getAttribute('height')).toBe('48');
  });

  it('forwards the class prop', () => {
    const { container } = render(<HiveLogo class="my-class" />);
    expect(container.querySelector('img')!.classList.contains('my-class')).toBe(true);
  });
});

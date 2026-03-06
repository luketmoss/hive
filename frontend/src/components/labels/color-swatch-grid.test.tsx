import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/preact';
import { ColorSwatchGrid } from './color-swatch-grid';
import { PRESET_COLORS } from './preset-colors';

// Scenario 6: Color selection via preset swatch grid

describe('ColorSwatchGrid', () => {
  it('renders 10 color swatches', () => {
    const { container } = render(
      <ColorSwatchGrid selectedColor="#E74C3C" onSelect={() => {}} />
    );
    const swatches = container.querySelectorAll('[role="radio"]');
    expect(swatches.length).toBe(PRESET_COLORS.length);
    expect(swatches.length).toBeGreaterThanOrEqual(10);
  });

  it('uses role="radiogroup" on the container', () => {
    const { container } = render(
      <ColorSwatchGrid selectedColor="#E74C3C" onSelect={() => {}} />
    );
    const grid = container.querySelector('[role="radiogroup"]');
    expect(grid).toBeTruthy();
    expect(grid!.getAttribute('aria-label')).toBe('Label color');
  });

  it('marks the selected color with aria-checked="true"', () => {
    const { container } = render(
      <ColorSwatchGrid selectedColor="#E74C3C" onSelect={() => {}} />
    );
    const swatches = container.querySelectorAll('[role="radio"]');
    const selected = Array.from(swatches).find(
      s => s.getAttribute('aria-checked') === 'true'
    );
    expect(selected).toBeTruthy();
    expect(selected!.getAttribute('data-color')).toBe('#E74C3C');
  });

  it('unselected swatches have aria-checked="false"', () => {
    const { container } = render(
      <ColorSwatchGrid selectedColor="#E74C3C" onSelect={() => {}} />
    );
    const swatches = container.querySelectorAll('[role="radio"]');
    const unselected = Array.from(swatches).filter(
      s => s.getAttribute('aria-checked') === 'false'
    );
    expect(unselected.length).toBe(PRESET_COLORS.length - 1);
  });

  it('each swatch has an aria-label with the color name', () => {
    const { container } = render(
      <ColorSwatchGrid selectedColor="" onSelect={() => {}} />
    );
    const swatches = container.querySelectorAll('[role="radio"]');
    swatches.forEach((swatch, i) => {
      expect(swatch.getAttribute('aria-label')).toBe(PRESET_COLORS[i].name);
    });
  });

  it('each swatch has a title tooltip with the color name', () => {
    const { container } = render(
      <ColorSwatchGrid selectedColor="" onSelect={() => {}} />
    );
    const swatches = container.querySelectorAll('[role="radio"]');
    swatches.forEach((swatch, i) => {
      expect(swatch.getAttribute('title')).toBe(PRESET_COLORS[i].name);
    });
  });

  it('each swatch is at least 32x32px (has color-swatch class)', () => {
    const { container } = render(
      <ColorSwatchGrid selectedColor="" onSelect={() => {}} />
    );
    const swatches = container.querySelectorAll('.color-swatch');
    expect(swatches.length).toBe(PRESET_COLORS.length);
  });

  it('calls onSelect when a swatch is clicked', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <ColorSwatchGrid selectedColor="" onSelect={onSelect} />
    );
    const swatches = container.querySelectorAll('[role="radio"]');
    (swatches[2] as HTMLElement).click();
    expect(onSelect).toHaveBeenCalledWith(PRESET_COLORS[2].hex);
  });

  it('selected swatch has tabindex=0, others have tabindex=-1', () => {
    const { container } = render(
      <ColorSwatchGrid selectedColor="#3498DB" onSelect={() => {}} />
    );
    const swatches = container.querySelectorAll('[role="radio"]');
    swatches.forEach(swatch => {
      if (swatch.getAttribute('data-color') === '#3498DB') {
        expect(swatch.getAttribute('tabindex')).toBe('0');
      } else {
        expect(swatch.getAttribute('tabindex')).toBe('-1');
      }
    });
  });

  it('first swatch gets tabindex=0 when no color is selected', () => {
    const { container } = render(
      <ColorSwatchGrid selectedColor="" onSelect={() => {}} />
    );
    const swatches = container.querySelectorAll('[role="radio"]');
    expect(swatches[0].getAttribute('tabindex')).toBe('0');
    for (let i = 1; i < swatches.length; i++) {
      expect(swatches[i].getAttribute('tabindex')).toBe('-1');
    }
  });
});

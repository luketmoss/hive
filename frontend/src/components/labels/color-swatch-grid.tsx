import { useRef, useCallback } from 'preact/hooks';
import { PRESET_COLORS } from './preset-colors';

interface Props {
  selectedColor: string;
  onSelect: (hex: string) => void;
}

const COLUMNS = 5;

/**
 * Accessible color swatch grid with role="radiogroup" and arrow key navigation.
 * Each swatch is role="radio" with aria-checked and aria-label.
 */
export function ColorSwatchGrid({ selectedColor, onSelect }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const container = gridRef.current;
    if (!container) return;

    const swatches = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    const currentIndex = swatches.findIndex(s => s === document.activeElement);
    if (currentIndex === -1) return;

    let nextIndex = currentIndex;
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        nextIndex = (currentIndex + 1) % swatches.length;
        break;
      case 'ArrowLeft':
        e.preventDefault();
        nextIndex = (currentIndex - 1 + swatches.length) % swatches.length;
        break;
      case 'ArrowDown':
        e.preventDefault();
        nextIndex = Math.min(currentIndex + COLUMNS, swatches.length - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        nextIndex = Math.max(currentIndex - COLUMNS, 0);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        onSelect(swatches[currentIndex].dataset.color!);
        return;
      default:
        return;
    }
    swatches[nextIndex].focus();
  }, [onSelect]);

  return (
    <div
      ref={gridRef}
      class="color-swatch-grid"
      role="radiogroup"
      aria-label="Label color"
      onKeyDown={handleKeyDown}
    >
      {PRESET_COLORS.map((pc, i) => {
        const isSelected = selectedColor.toUpperCase() === pc.hex.toUpperCase();
        return (
          <button
            key={pc.hex}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={pc.name}
            title={pc.name}
            class={`color-swatch ${isSelected ? 'color-swatch-selected' : ''}`}
            style={{ backgroundColor: pc.hex }}
            data-color={pc.hex}
            tabIndex={isSelected || (selectedColor === '' && i === 0) ? 0 : -1}
            onClick={() => onSelect(pc.hex)}
          />
        );
      })}
    </div>
  );
}

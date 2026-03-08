// Preset emoji icons for board icon selection.
// Single-select, optional — empty string means "no icon".

export const BOARD_ICONS = ['🏠', '🏢', '👨‍👩‍👧', '🛒', '📚', '🎮', '🏋️', '🎵', '✈️', '🎯'];

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  return (
    <div class="picker-row" role="radiogroup" aria-label="Board icon">
      {BOARD_ICONS.map(icon => (
        <button
          key={icon}
          type="button"
          class={`icon-swatch ${value === icon ? 'icon-swatch-selected' : ''}`}
          aria-label={icon}
          aria-pressed={value === icon}
          onClick={() => onChange(value === icon ? '' : icon)}
          title={icon}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

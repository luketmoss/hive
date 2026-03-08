// Preset color swatches for board color coding.
// Single-select, optional — empty string means "no color".

export const BOARD_COLORS = [
  { value: '#1976d2', label: 'Blue' },
  { value: '#388e3c', label: 'Green' },
  { value: '#d32f2f', label: 'Red' },
  { value: '#f57c00', label: 'Orange' },
  { value: '#7b1fa2', label: 'Purple' },
  { value: '#00796b', label: 'Teal' },
  { value: '#c2185b', label: 'Pink' },
  { value: '#616161', label: 'Gray' },
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div class="picker-row" role="radiogroup" aria-label="Board color">
      {BOARD_COLORS.map(c => (
        <button
          key={c.value}
          type="button"
          class={`color-swatch ${value === c.value ? 'color-swatch-selected' : ''}`}
          style={`background: ${c.value};`}
          aria-label={c.label}
          aria-pressed={value === c.value}
          onClick={() => onChange(value === c.value ? '' : c.value)}
          title={c.label}
        />
      ))}
    </div>
  );
}

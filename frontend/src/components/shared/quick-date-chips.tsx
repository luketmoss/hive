import { DATE_SHORTCUTS, resolveDate, matchShortcut } from '../../utils/date-shortcuts';
import type { DateShortcut } from '../../utils/date-shortcuts';

interface QuickDateChipsProps {
  /** Current date value in YYYY-MM-DD format */
  value: string;
  /** Called when a chip is tapped. Receives the resolved YYYY-MM-DD string, or '' to clear. */
  onChange: (date: string) => void;
}

export function QuickDateChips({ value, onChange }: QuickDateChipsProps) {
  const activeShortcut = matchShortcut(value);

  const handleClick = (shortcut: DateShortcut) => {
    if (activeShortcut === shortcut) {
      // AC4: tapping active chip clears the date
      onChange('');
    } else {
      onChange(resolveDate(shortcut));
    }
  };

  return (
    <div class="quick-date-chips" role="group" aria-label="Quick date shortcuts">
      {DATE_SHORTCUTS.map(s => (
        <button
          key={s}
          type="button"
          class={`quick-date-chip${activeShortcut === s ? ' quick-date-chip-active' : ''}`}
          aria-pressed={activeShortcut === s}
          onClick={() => handleClick(s)}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

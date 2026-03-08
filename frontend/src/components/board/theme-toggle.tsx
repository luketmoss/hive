import type { Theme } from '../../state/board-store';
import { theme, setTheme } from '../../state/board-store';

/** Icons for each theme option — shown at all viewport widths; labels hidden at <=600px. */
const THEME_OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: '☀' },
  { value: 'dark',  label: 'Dark',  icon: '🌙' },
  { value: 'system', label: 'System', icon: '⚙' },
];

/**
 * Three-way theme toggle: Light / Dark / System.
 *
 * AC2: role="group" + aria-label="Theme" wrapper; each button uses aria-pressed.
 * AC2: At <=600px viewport shows icon only (text visually hidden), 44px min-height.
 */
export function ThemeToggle() {
  const current = theme.value;

  return (
    <div
      role="group"
      aria-label="Theme"
      class="theme-toggle"
      data-testid="theme-toggle"
    >
      {THEME_OPTIONS.map(opt => (
        <button
          key={opt.value}
          class={`theme-toggle-btn${current === opt.value ? ' theme-toggle-active' : ''}`}
          aria-pressed={current === opt.value}
          title={opt.label}
          onClick={() => setTheme(opt.value)}
        >
          <span class="theme-toggle-icon" aria-hidden="true">{opt.icon}</span>
          <span class="theme-toggle-label">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

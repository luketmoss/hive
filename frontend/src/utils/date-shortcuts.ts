/** Quick date shortcut resolution logic for issue #82. */

export type DateShortcut = 'Today' | 'This Fri' | 'Next Mon' | 'Next Month';

export const DATE_SHORTCUTS: DateShortcut[] = ['Today', 'This Fri', 'Next Mon', 'Next Month'];

/**
 * Resolve a date shortcut to a YYYY-MM-DD string.
 * @param shortcut - The shortcut label to resolve.
 * @param ref - Reference date (defaults to today). Used for testing.
 */
export function resolveDate(shortcut: DateShortcut, ref: Date = new Date()): string {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());

  switch (shortcut) {
    case 'Today':
      break;
    case 'This Fri': {
      const day = d.getDay(); // 0=Sun..6=Sat
      const diff = day <= 5 ? 5 - day : 6; // if Sat (6), next Fri is 6 days away
      d.setDate(d.getDate() + diff);
      break;
    }
    case 'Next Mon': {
      const day = d.getDay();
      const diff = day === 0 ? 1 : 8 - day; // Sun=1 day, Mon=7, Tue=6, ..., Sat=2
      d.setDate(d.getDate() + diff);
      break;
    }
    case 'Next Month':
      d.setDate(1); // set day first to avoid month overflow (e.g. Jan 31 → Mar 3)
      d.setMonth(d.getMonth() + 1);
      break;
  }

  return formatDate(d);
}

/**
 * Check which shortcut (if any) matches a given date string.
 * Returns the matching shortcut or null.
 */
export function matchShortcut(dateStr: string, ref: Date = new Date()): DateShortcut | null {
  if (!dateStr) return null;
  for (const s of DATE_SHORTCUTS) {
    if (resolveDate(s, ref) === dateStr) return s;
  }
  return null;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

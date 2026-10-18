import { describe, it, expect } from 'vitest';
import { withLocalDate, localYmdOf, isFutureLocalDate, isOutsideDoneWindow, completedRelativeLabel, toLocalYmd } from './completed-date';

describe('completed-date helpers (#280)', () => {
  it('withLocalDate keeps local time of day and lands on the picked local date', () => {
    const prev = new Date(2026, 9, 14, 18, 30, 0).toISOString();
    const out = withLocalDate(prev, '2026-10-10')!;
    const d = new Date(out);
    expect(out).toMatch(/Z$/);
    expect(localYmdOf(out)).toBe('2026-10-10');
    expect(d.getHours()).toBe(18);
    expect(d.getMinutes()).toBe(30);
  });
  it('withLocalDate rejects malformed or impossible dates', () => {
    const prev = new Date().toISOString();
    expect(withLocalDate(prev, '')).toBeNull();
    expect(withLocalDate(prev, '2026-02-31')).toBeNull();
  });
  it('isFutureLocalDate compares in local time', () => {
    const now = new Date(2026, 9, 18, 23, 59);
    expect(isFutureLocalDate('2026-10-18', now)).toBe(false);
    expect(isFutureLocalDate('2026-10-19', now)).toBe(true);
  });
  it('isOutsideDoneWindow uses 7 days', () => {
    const now = Date.now();
    expect(isOutsideDoneWindow(new Date(now - 8 * 86400000).toISOString(), now)).toBe(true);
    expect(isOutsideDoneWindow(new Date(now - 6 * 86400000).toISOString(), now)).toBe(false);
  });
  it('completedRelativeLabel', () => {
    const now = new Date(2026, 9, 18, 12);
    expect(completedRelativeLabel('2026-10-18', now)).toBe('Today');
    expect(completedRelativeLabel('2026-10-17', now)).toBe('Yesterday');
    expect(completedRelativeLabel('2026-10-15', now)).toBe('3 days ago');
    expect(toLocalYmd(now)).toBe('2026-10-18');
  });
});

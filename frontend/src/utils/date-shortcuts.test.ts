import { describe, it, expect } from 'vitest';
import { resolveDate, matchShortcut, DATE_SHORTCUTS } from './date-shortcuts';

// Helper: create a Date from YYYY-MM-DD without timezone issues
function d(s: string): Date {
  const [y, m, dd] = s.split('-').map(Number);
  return new Date(y, m - 1, dd);
}

describe('resolveDate — AC2: Date resolution logic', () => {
  describe('Today', () => {
    it('returns current date', () => {
      expect(resolveDate('Today', d('2026-03-07'))).toBe('2026-03-07');
    });
  });

  describe('This Fri', () => {
    it('returns coming Friday when today is Monday', () => {
      // 2026-03-02 is a Monday
      expect(resolveDate('This Fri', d('2026-03-02'))).toBe('2026-03-06');
    });

    it('returns today if already Friday', () => {
      // 2026-03-06 is a Friday
      expect(resolveDate('This Fri', d('2026-03-06'))).toBe('2026-03-06');
    });

    it('returns next Friday when today is Saturday', () => {
      // 2026-03-07 is a Saturday
      expect(resolveDate('This Fri', d('2026-03-07'))).toBe('2026-03-13');
    });

    it('returns next Friday when today is Sunday', () => {
      // 2026-03-08 is a Sunday
      expect(resolveDate('This Fri', d('2026-03-08'))).toBe('2026-03-13');
    });

    it('returns coming Friday when today is Wednesday', () => {
      // 2026-03-04 is a Wednesday
      expect(resolveDate('This Fri', d('2026-03-04'))).toBe('2026-03-06');
    });
  });

  describe('Next Mon', () => {
    it('returns Monday of next week when today is Monday', () => {
      // 2026-03-02 is Monday → next Monday is 2026-03-09
      expect(resolveDate('Next Mon', d('2026-03-02'))).toBe('2026-03-09');
    });

    it('returns coming Monday when today is Sunday', () => {
      // 2026-03-08 is Sunday → next day Monday is 2026-03-09
      expect(resolveDate('Next Mon', d('2026-03-08'))).toBe('2026-03-09');
    });

    it('returns next Monday when today is Friday', () => {
      // 2026-03-06 is Friday → next Monday is 2026-03-09
      expect(resolveDate('Next Mon', d('2026-03-06'))).toBe('2026-03-09');
    });

    it('returns next Monday when today is Saturday', () => {
      // 2026-03-07 is Saturday → next Monday is 2026-03-09
      expect(resolveDate('Next Mon', d('2026-03-07'))).toBe('2026-03-09');
    });

    it('returns next Monday when today is Wednesday', () => {
      // 2026-03-04 is Wednesday → next Monday is 2026-03-09
      expect(resolveDate('Next Mon', d('2026-03-04'))).toBe('2026-03-09');
    });
  });

  describe('Next Month', () => {
    it('returns 1st of following month', () => {
      expect(resolveDate('Next Month', d('2026-03-07'))).toBe('2026-04-01');
    });

    it('rolls over year boundary', () => {
      expect(resolveDate('Next Month', d('2026-12-15'))).toBe('2027-01-01');
    });

    it('works on last day of month', () => {
      expect(resolveDate('Next Month', d('2026-01-31'))).toBe('2026-02-01');
    });
  });
});

describe('matchShortcut — AC4: Active chip state', () => {
  it('returns matching shortcut for "Today"', () => {
    const ref = d('2026-03-07');
    expect(matchShortcut('2026-03-07', ref)).toBe('Today');
  });

  it('returns matching shortcut for "This Fri"', () => {
    // 2026-03-04 is Wednesday, This Fri = 2026-03-06
    const ref = d('2026-03-04');
    expect(matchShortcut('2026-03-06', ref)).toBe('This Fri');
  });

  it('returns null when no shortcut matches', () => {
    const ref = d('2026-03-07');
    expect(matchShortcut('2026-06-15', ref)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(matchShortcut('')).toBeNull();
  });
});

describe('DATE_SHORTCUTS', () => {
  it('exports all four shortcuts in order', () => {
    expect(DATE_SHORTCUTS).toEqual(['Today', 'This Fri', 'Next Mon', 'Next Month']);
  });
});

import { describe, it, expect } from 'vitest';
import { isValidDateForm } from './validate-date';

describe('#263 isValidDateForm', () => {
  it('accepts a well-formed date', () => {
    expect(isValidDateForm('2026-09-24')).toBe(true);
  });

  it('accepts a well-formed date in the past', () => {
    expect(isValidDateForm('2020-01-01')).toBe(true);
  });

  it('rejects null and undefined', () => {
    expect(isValidDateForm(null)).toBe(false);
    expect(isValidDateForm(undefined)).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidDateForm('')).toBe(false);
  });

  it('rejects a single-digit month or day', () => {
    expect(isValidDateForm('2026-9-24')).toBe(false);
    expect(isValidDateForm('2026-09-4')).toBe(false);
  });

  it('rejects a non-date word', () => {
    expect(isValidDateForm('tomorrow')).toBe(false);
  });

  it('rejects a calendar date that does not exist (Feb 30)', () => {
    expect(isValidDateForm('2026-02-30')).toBe(false);
  });

  it('rejects a month out of range (13)', () => {
    expect(isValidDateForm('2026-13-01')).toBe(false);
  });

  it('rejects a day out of range (32)', () => {
    expect(isValidDateForm('2026-01-32')).toBe(false);
  });

  it('accepts a valid leap-day date', () => {
    expect(isValidDateForm('2028-02-29')).toBe(true);
  });

  it('rejects Feb 29 on a non-leap year', () => {
    expect(isValidDateForm('2026-02-29')).toBe(false);
  });
});

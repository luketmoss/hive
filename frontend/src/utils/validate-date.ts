/**
 * #263: validate a `YYYY-MM-DD` date string for the deep-link `due` param (and
 * anywhere else a raw date string needs checking before it reaches a
 * `<input type="date">` or the `due_date` column).
 *
 * Two checks, both required:
 * 1. The literal form `^\d{4}-\d{2}-\d{2}$` — rules out `2026-9-24`, `tomorrow`,
 *    empty, etc.
 * 2. A round-trip through `Date` — `new Date('2026-02-30')` silently rolls over
 *    to March 2nd rather than throwing, so the parsed value is reformatted and
 *    compared back to the input to catch that.
 *
 * No timezone is involved: the string is parsed as UTC (the `T00:00:00Z`
 * suffix) purely to avoid the local-timezone shift `new Date('2026-09-24')`
 * would otherwise apply, and only the calendar fields are compared.
 */
export function isValidDateForm(value: string | null | undefined): value is string {
  if (!value) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;

  const roundTripped =
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

  return roundTripped === value;
}

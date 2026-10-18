// #280: helpers for editing an item's completed date (date-only; time of day kept).

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local calendar date (YYYY-MM-DD) of a Date. */
export function toLocalYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local calendar date (YYYY-MM-DD) of an ISO timestamp, or '' if unparseable. */
export function localYmdOf(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : toLocalYmd(d);
}

/**
 * Build a new ISO timestamp whose local calendar date is `ymd`, keeping the
 * local time of day of `previousIso`. Never stores a bare date (a bare
 * YYYY-MM-DD parses as UTC midnight and shifts the day in other zones).
 */
export function withLocalDate(previousIso: string, ymd: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const prev = new Date(previousIso);
  const base = isNaN(prev.getTime()) ? new Date() : prev;
  const next = new Date(base);
  next.setFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (isNaN(next.getTime()) || toLocalYmd(next) !== ymd) return null;
  return next.toISOString();
}

/** True when `ymd` is after today's local date. */
export function isFutureLocalDate(ymd: string, now: Date = new Date()): boolean {
  return ymd > toLocalYmd(now);
}

/** True when a completed_at falls outside the 7-day Done window. */
export function isOutsideDoneWindow(iso: string, now: number = Date.now()): boolean {
  return new Date(iso).getTime() < now - SEVEN_DAYS_MS;
}

/** "Today", "Yesterday" or "N days ago" for a past local date. */
export function completedRelativeLabel(ymd: string, now: Date = new Date()): string {
  const [y, mo, d] = ymd.split('-').map(Number);
  const then = new Date(y, mo - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today.getTime() - then.getTime()) / 86400000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return `${diff} days ago`;
}

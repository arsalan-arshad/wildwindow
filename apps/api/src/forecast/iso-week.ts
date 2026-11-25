/**
 * ISO week helpers for forecast history windows (ARCHITECTURE §4.1).
 * Week 53 merges to 52 to match ingest (§3.2).
 */

/**
 * ISO week-year and week (1–53) for a UTC calendar date.
 */
export function isoWeekParts(utcDate: Date): { readonly isoYear: number; readonly week: number } {
  const day = new Date(
    Date.UTC(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate()),
  );
  const dayNum = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - dayNum);
  const isoYear = day.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((day.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return { isoYear, week };
}

/** WildWindow week 1–52 (week 53 → 52). */
export function wildwindowWeek(utcDate: Date): number {
  const { week } = isoWeekParts(utcDate);
  return week > 52 ? 52 : week;
}

/**
 * ISO week for a local `YYYY-MM-DD` interpreted at noon UTC of that calendar day.
 * Adequate for W±1 neighbourhood selection (not a full zoned ISO calendar).
 */
export function weekFromLocalYmd(ymd: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (match === null) {
    throw new RangeError(`Expected YYYY-MM-DD, got ${ymd}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return wildwindowWeek(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)));
}

/**
 * ISO weeks are 1–52 in WildWindow (week 53 merges into 52 at ingest).
 * `W±1(d)` wraps across the year boundary (§4.1).
 */
export function weeksAround(week: number): readonly [number, number, number] {
  if (!Number.isInteger(week) || week < 1 || week > 52) {
    throw new RangeError(`week must be an integer 1–52, got ${String(week)}`);
  }
  const prev = week === 1 ? 52 : week - 1;
  const next = week === 52 ? 1 : week + 1;
  return [prev, week, next];
}

/**
 * Build a 52-week relative reporting-rate series (US-05 / ARCHITECTURE §7).
 * Effort-normalised: `n_records / n_effort` per ISO week, then scaled so the
 * peak week is 1 (relative). Missing weeks and zero-effort weeks are 0.
 */
export type SeasonalityWeekRow = {
  readonly week: number;
  readonly nRecords: number;
  readonly nEffort: number;
};

export function relativeSeasonalityWeeks(rows: readonly SeasonalityWeekRow[]): readonly number[] {
  const rates: number[] = Array.from({ length: 52 }, () => 0);
  for (const row of rows) {
    if (!Number.isInteger(row.week) || row.week < 1 || row.week > 52) {
      continue;
    }
    const rate = row.nEffort > 0 ? row.nRecords / row.nEffort : 0;
    rates[row.week - 1] = Number.isFinite(rate) && rate > 0 ? rate : 0;
  }
  let max = 0;
  for (const rate of rates) {
    if (rate > max) {
      max = rate;
    }
  }
  if (max <= 0) {
    return rates;
  }
  return rates.map((rate) => rate / max);
}

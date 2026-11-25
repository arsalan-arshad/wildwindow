import { describe, expect, it } from 'vitest';

import { relativeSeasonalityWeeks } from './seasonality.js';

describe('relativeSeasonalityWeeks', () => {
  it('returns 52 zeros when there is no data', () => {
    const weeks = relativeSeasonalityWeeks([]);
    expect(weeks).toHaveLength(52);
    expect(weeks.every((v) => v === 0)).toBe(true);
  });

  it('normalises effort rates so the peak week is 1', () => {
    const weeks = relativeSeasonalityWeeks([
      { week: 1, nRecords: 10, nEffort: 100 },
      { week: 26, nRecords: 50, nEffort: 100 },
      { week: 52, nRecords: 25, nEffort: 100 },
    ]);
    expect(weeks).toHaveLength(52);
    expect(weeks[0]).toBeCloseTo(0.2, 10);
    expect(weeks[25]).toBe(1);
    expect(weeks[51]).toBeCloseTo(0.5, 10);
    expect(weeks.every((v) => v >= 0 && v <= 1)).toBe(true);
  });

  it('treats zero-effort weeks as 0', () => {
    const weeks = relativeSeasonalityWeeks([
      { week: 10, nRecords: 5, nEffort: 0 },
      { week: 11, nRecords: 5, nEffort: 10 },
    ]);
    expect(weeks[9]).toBe(0);
    expect(weeks[10]).toBe(1);
  });

  it('ignores out-of-range week numbers', () => {
    const weeks = relativeSeasonalityWeeks([
      { week: 0, nRecords: 99, nEffort: 1 },
      { week: 53, nRecords: 99, nEffort: 1 },
      { week: 12, nRecords: 1, nEffort: 1 },
    ]);
    expect(weeks[11]).toBe(1);
    expect(weeks.filter((v) => v > 0)).toHaveLength(1);
  });
});

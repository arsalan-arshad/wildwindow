import { describe, expect, it } from 'vitest';

import { isoWeekParts, weekFromLocalYmd, wildwindowWeek } from './iso-week.js';

describe('iso-week', () => {
  it('maps a known mid-year date to ISO week 26', () => {
    // 2026-06-24 is a Wednesday in ISO week 26.
    const parts = isoWeekParts(new Date(Date.UTC(2026, 5, 24)));
    expect(parts.week).toBe(26);
    expect(parts.isoYear).toBe(2026);
  });

  it('merges week 53 into 52 for WildWindow', () => {
    // 2020-12-31 is Thursday of ISO week 53 of 2020.
    const week53 = isoWeekParts(new Date(Date.UTC(2020, 11, 31)));
    expect(week53.week).toBe(53);
    expect(wildwindowWeek(new Date(Date.UTC(2020, 11, 31)))).toBe(52);
  });

  it('weekFromLocalYmd parses YYYY-MM-DD', () => {
    expect(weekFromLocalYmd('2026-06-24')).toBe(26);
    expect(() => weekFromLocalYmd('26-06-24')).toThrow(/YYYY-MM-DD/);
  });
});

import { describe, expect, it } from 'vitest';

import {
  challengeStatusLabel,
  countryDisplayName,
  formatChallengeDateRange,
  formatEntryPlace,
  totalCountryCount,
} from './challenge';

describe('challenge helpers', () => {
  it('formats place as region + country only', () => {
    expect(formatEntryPlace('Sindh', 'PK')).toBe('Sindh, Pakistan');
    expect(formatEntryPlace('Scotland', 'GB')).toBe('Scotland, United Kingdom');
  });

  it('falls back to the ISO code for unknown countries', () => {
    expect(countryDisplayName('NO')).toBe('NO');
  });

  it('sums country counts and labels status', () => {
    expect(
      totalCountryCount([
        { countryCode: 'GB', count: 2 },
        { countryCode: 'PK', count: 1 },
      ]),
    ).toBe(3);
    expect(challengeStatusLabel('active')).toBe('Live');
    expect(challengeStatusLabel('closed')).toBe('Closed');
  });

  it('formats challenge date ranges in UTC calendar days', () => {
    expect(formatChallengeDateRange('2026-11-01', '2026-11-30', 'en-GB')).toMatch(/2026/);
  });
});

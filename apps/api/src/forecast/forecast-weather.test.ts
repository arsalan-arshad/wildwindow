import { describe, expect, it } from 'vitest';

import {
  forecastWindowStartUtc,
  sevenLocalDates,
  weatherByDateFromHours,
} from './forecast-weather.js';

describe('forecast-weather', () => {
  it('sevenLocalDates returns 7 consecutive local dates', () => {
    expect(sevenLocalDates('2026-11-21', 'Europe/London')).toEqual([
      '2026-11-21',
      '2026-11-22',
      '2026-11-23',
      '2026-11-24',
      '2026-11-25',
      '2026-11-26',
      '2026-11-27',
    ]);
  });

  it('marks dates without samples as beyondHorizon', () => {
    const byDate = weatherByDateFromHours({
      hours: [
        {
          timeUtc: '2026-11-21T08:00:00.000Z',
          precipProb: 0.1,
          precipMm: 0,
          windKph: 10,
          cloudPct: 20,
        },
      ],
      dates: ['2026-11-21', '2026-11-22'],
      timeZone: 'UTC',
    });
    expect(byDate['2026-11-21']?.beyondHorizon).toBeUndefined();
    expect(byDate['2026-11-21']?.byHour?.[8]?.windKph).toBe(10);
    expect(byDate['2026-11-22']).toEqual({ beyondHorizon: true });
  });

  it('forecastWindowStartUtc is before local noon of start', () => {
    const start = forecastWindowStartUtc('2026-11-21', 'UTC');
    expect(start.toISOString()).toBe('2026-11-21T00:00:00.000Z');
  });
});

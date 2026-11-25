import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { conditionsC, dayScore } from './combine.js';
import { computeForecast, type ComputeForecastInput } from './compute-forecast.js';
import { SCORING_V1 } from './config/v1.js';

/** §4.6 illustrative numbers → DayScore 69. */
describe('§4.6 worked example', () => {
  it('gives DayScore 69 for the documented factor set', () => {
    const h = 0.68;
    const t = 0.9;
    const g = 0.75;
    const wx = 0.94;
    const d = 1;
    const c = conditionsC({ t, g, wx, d });
    expect(c).toBeCloseTo(0.835, 2);
    expect(dayScore(h, c)).toBe(69);
  });
});

function calmWeatherForDates(dates: readonly string[]): ComputeForecastInput['weatherByDate'] {
  const byHour = Object.fromEntries(
    Array.from({ length: 24 }, (_, h) => [h, { precipProb: 0.1, precipMm: 0, windKph: 10 }]),
  );
  return Object.fromEntries(dates.map((d) => [d, { byHour }]));
}

/** Local YYYY-MM-DD plus `days` (calendar-safe for these fixed test dates). */
function ymdPlus(start: string, days: number): string {
  const [y, m, d] = start.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function baseInput(overrides: Partial<ComputeForecastInput> = {}): ComputeForecastInput {
  const hourCounts = Array.from({ length: 24 }, (_, h) => (h >= 7 && h <= 10 ? 20 : 2));
  const startDate = overrides.startDate ?? '2026-10-10';
  const weekDates = Array.from({ length: 7 }, (_, i) => ymdPlus(startDate, i));
  const weatherByDate = overrides.weatherByDate ?? calmWeatherForDates(weekDates);

  const base: ComputeForecastInput = {
    taxonId: 'taxon-kingfisher',
    tier: 'open',
    displayCell: '871f1d489ffffff',
    areaLabel: 'Glasgow · Kelvin area',
    timeZone: 'Europe/London',
    startDate,
    lat: 55.86,
    lng: -4.25,
    lockoutMonths: [],
    covered: true,
    history: {
      nSpecies: 42,
      nEffort: 3_100,
      regionEffort: 3_100,
      regionRate: 0.011,
      rrRef: 0.02,
      distinctYears: 2,
    },
    hourProfile: {
      counts: hourCounts,
      activityPattern: 'diurnal',
    },
    weatherByDate,
    tidePref: 'none',
    commonName: 'Kingfishers',
  };
  return { ...base, ...overrides, weatherByDate };
}

describe('computeForecast status overrides (§4.5)', () => {
  it('returns unavailable for no_forecast tier', () => {
    const result = computeForecast(baseInput({ tier: 'no_forecast' }));
    expect(result.status).toBe('unavailable');
    expect(result.weekScore).toBeNull();
    expect(result.displayCell).toBeNull();
  });

  it('returns not_covered when covered is false', () => {
    const result = computeForecast(baseInput({ covered: false }));
    expect(result.status).toBe('not_covered');
    expect(result.weekScore).toBeNull();
  });

  it('returns lockout when a day falls in lockout months', () => {
    const result = computeForecast(
      baseInput({
        tier: 'highly_protected',
        lockoutMonths: [10],
        lockoutReason: 'Breeding lockout',
        startDate: '2026-10-10',
      }),
    );
    expect(result.status).toBe('lockout');
    if (result.status === 'lockout') {
      expect(result.reason).toBe('Breeding lockout');
    }
    expect(result.weekScore).toBeNull();
  });

  it('returns ok with integer scores in 0..100 for a normal open forecast', () => {
    const result = computeForecast(baseInput({ startDate: '2026-06-15' }));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') {
      return;
    }
    expect(result.scoringVersion).toBe('1.0');
    expect(result.days).toHaveLength(7);
    expect(Number.isInteger(result.weekScore)).toBe(true);
    expect(result.weekScore).toBeGreaterThanOrEqual(0);
    expect(result.weekScore).toBeLessThanOrEqual(100);
    expect(result.confidence).toBe('medium');
    expect(result.range).toBeNull();
    for (const day of result.days) {
      expect(Number.isInteger(day.score)).toBe(true);
      expect(day.score).toBeGreaterThanOrEqual(0);
      expect(day.score).toBeLessThanOrEqual(100);
      expect(day.factors.tide).toBe('not_used');
    }
    expect(result.explanations.length).toBeGreaterThan(0);
  });
});

describe('dayScore / conditionsC properties', () => {
  it('always returns an integer in 0..100', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (h, c) => {
          const score = dayScore(h, c);
          expect(Number.isInteger(score)).toBe(true);
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('raising any factor never lowers DayScore', () => {
    fc.assert(
      fc.property(
        fc.record({
          h: fc.double({ min: 0, max: 1, noNaN: true }),
          t: fc.double({ min: 0, max: 0.9, noNaN: true }),
          g: fc.double({ min: 0, max: 0.9, noNaN: true }),
          wx: fc.double({ min: 0, max: 0.9, noNaN: true }),
          d: fc.double({ min: 0, max: 0.9, noNaN: true }),
          bump: fc.constantFrom('h', 't', 'g', 'wx', 'd'),
        }),
        ({ h, t, g, wx, d, bump }) => {
          const baseC = conditionsC({ t, g, wx, d });
          const baseScore = dayScore(h, baseC);
          const next = { h, t, g, wx, d };
          next[bump] = Math.min(1, next[bump] + 0.05);
          const nextC = conditionsC({ t: next.t, g: next.g, wx: next.wx, d: next.d });
          const nextScore = dayScore(next.h, nextC);
          expect(nextScore).toBeGreaterThanOrEqual(baseScore);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('conditionsC stays ≤ 1 for unit factors', () => {
    expect(conditionsC({ t: 1, g: 1, wx: 1, d: 1 })).toBeCloseTo(1, 10);
    expect(conditionsC({ t: 0, g: 0, wx: 0, d: 0 })).toBe(0);
  });
});

describe('SCORING_V1 weather precip fallback constant', () => {
  it('documents precipMmForCertain = 2', () => {
    expect(SCORING_V1.weather.precipMmForCertain).toBe(2);
  });
});

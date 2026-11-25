import { describe, expect, it } from 'vitest';

import { computeForecast, type ComputeForecastInput } from './compute-forecast.js';
import {
  createTideProvider,
  createTideProviderFromEnv,
  NoTideProvider,
  parseTideProviderId,
  TIDE_PROVIDER_NONE,
  toTideExtremes,
  type TideExtreme,
} from './tide-provider.js';

function calmWeatherForDates(dates: readonly string[]): ComputeForecastInput['weatherByDate'] {
  const byHour = Object.fromEntries(
    Array.from({ length: 24 }, (_, h) => [h, { precipProb: 0.1, precipMm: 0, windKph: 10 }]),
  );
  return Object.fromEntries(dates.map((d) => [d, { byHour }]));
}

function ymdPlus(start: string, days: number): string {
  const [y, m, d] = start.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Coastal species with a real tide preference (e.g. grey seal / otter-style). */
function coastalForecastInput(overrides: Partial<ComputeForecastInput> = {}): ComputeForecastInput {
  const startDate = overrides.startDate ?? '2026-06-15';
  const weekDates = Array.from({ length: 7 }, (_, i) => ymdPlus(startDate, i));
  const weatherByDate = overrides.weatherByDate ?? calmWeatherForDates(weekDates);
  const hourCounts = Array.from({ length: 24 }, (_, h) => (h >= 7 && h <= 10 ? 20 : 2));

  const base: ComputeForecastInput = {
    taxonId: 'taxon-grey-seal',
    tier: 'open',
    displayCell: '871f1d489ffffff',
    areaLabel: 'Firth of Clyde · coastal',
    timeZone: 'Europe/London',
    startDate,
    lat: 55.75,
    lng: -4.9,
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
      activityPattern: 'tidal',
    },
    weatherByDate,
    tidePref: 'low',
    commonName: 'Grey seals',
  };
  return { ...base, ...overrides, weatherByDate };
}

describe('parseTideProviderId / createTideProvider', () => {
  it('defaults empty and none to NoTideProvider', () => {
    expect(parseTideProviderId(undefined)).toBe(TIDE_PROVIDER_NONE);
    expect(parseTideProviderId('')).toBe(TIDE_PROVIDER_NONE);
    expect(parseTideProviderId('  NONE  ')).toBe(TIDE_PROVIDER_NONE);
    expect(createTideProvider('none')).toBeInstanceOf(NoTideProvider);
    expect(createTideProvider().id).toBe('none');
  });

  it('rejects unknown provider ids', () => {
    expect(() => parseTideProviderId('worldtides')).toThrow(/Unsupported TIDE_PROVIDER/);
  });
});

describe('NoTideProvider', () => {
  it('returns no extremes for any cell centre', async () => {
    const provider = new NoTideProvider();
    const extremes = await provider.extremes(55.75, -4.9, new Date('2026-06-15T00:00:00Z'), 7);
    expect(provider.id).toBe('none');
    expect(extremes).toEqual([]);
    expect(toTideExtremes(extremes)).toEqual({ highs: [], lows: [] });
  });
});

describe('toTideExtremes', () => {
  it('splits high and low events', () => {
    const extremes: TideExtreme[] = [
      { timeUtc: '2026-06-15T06:00:00.000Z', type: 'low', heightM: 0.4 },
      { timeUtc: '2026-06-15T12:30:00.000Z', type: 'high' },
    ];
    const mapped = toTideExtremes(extremes);
    expect(mapped.lows).toHaveLength(1);
    expect(mapped.highs).toHaveLength(1);
    expect(mapped.lows[0]?.toISOString()).toBe('2026-06-15T06:00:00.000Z');
    expect(mapped.highs[0]?.toISOString()).toBe('2026-06-15T12:30:00.000Z');
  });
});

describe('T4.8 acceptance: TIDE_PROVIDER=none → tide not_used', () => {
  it('coastal species forecast shows tide: "not_used" when provider is none', async () => {
    const provider = createTideProviderFromEnv('none');
    expect(provider.id).toBe('none');

    const fromUtc = new Date('2026-06-15T00:00:00Z');
    const extremes = await provider.extremes(55.75, -4.9, fromUtc, 7);
    const mapped = toTideExtremes(extremes);
    // NoTideProvider → empty extremes → scoring treats tide as unused.
    expect(mapped.highs).toHaveLength(0);
    expect(mapped.lows).toHaveLength(0);

    const startDate = '2026-06-15';
    const weekDates = Array.from({ length: 7 }, (_, i) => ymdPlus(startDate, i));
    const tidesByDate = Object.fromEntries(weekDates.map((d) => [d, mapped]));

    const result = computeForecast(
      coastalForecastInput({
        startDate,
        tidePref: 'low',
        tidesByDate,
      }),
    );

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') {
      return;
    }
    expect(result.days).toHaveLength(7);
    for (const day of result.days) {
      expect(day.factors.tide).toBe('not_used');
    }
  });

  it('createTideProviderFromEnv reads TIDE_PROVIDER=none from process.env', async () => {
    const previous = process.env['TIDE_PROVIDER'];
    process.env['TIDE_PROVIDER'] = 'none';
    try {
      const provider = createTideProviderFromEnv();
      expect(provider).toBeInstanceOf(NoTideProvider);
      const extremes = await provider.extremes(24.86, 67.0, new Date('2026-06-15T00:00:00Z'), 3);
      expect(extremes).toEqual([]);

      const result = computeForecast(
        coastalForecastInput({
          tidePref: 'high',
          // Omit tidesByDate entirely — same outcome as empty provider data.
        }),
      );
      expect(result.status).toBe('ok');
      if (result.status === 'ok') {
        for (const day of result.days) {
          expect(day.factors.tide).toBe('not_used');
        }
      }
    } finally {
      if (previous === undefined) {
        Reflect.deleteProperty(process.env, 'TIDE_PROVIDER');
      } else {
        process.env['TIDE_PROVIDER'] = previous;
      }
    }
  });
});

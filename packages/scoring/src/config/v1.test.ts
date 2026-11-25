import { describe, expect, expectTypeOf, it } from 'vitest';

import { SCORING_V1 } from './v1.js';

import type { ForecastInput, ForecastOk, ForecastResponse, ForecastStatus } from '../types.js';

describe('SCORING_V1', () => {
  it('is as const with version "1.0"', () => {
    expect(SCORING_V1.version).toBe('1.0');
    // as const → literal type, not widened string
    const version: '1.0' = SCORING_V1.version;
    expect(version).toBe('1.0');
    expect(SCORING_V1.alpha).toBe(20);
  });

  it('includes every §4 factor constant', () => {
    expect(SCORING_V1.hourKernel).toEqual([0.25, 0.5, 0.25]);
    expect(SCORING_V1.hourProfileMinRecords).toBe(30);
    expect(SCORING_V1.conditions).toEqual({
      timeBase: 0.6,
      timeWeight: 0.4,
      lightBase: 0.7,
      lightWeight: 0.3,
    });
    expect(SCORING_V1.light.civilAltitudeDeg).toBe(-6);
    expect(SCORING_V1.light.goldenHourLowDeg).toBe(-4);
    expect(SCORING_V1.light.goldenHourHighDeg).toBe(6);
    expect(SCORING_V1.light.blueHourLowDeg).toBe(-6);
    expect(SCORING_V1.light.blueHourHighDeg).toBe(-4);
    expect(SCORING_V1.light.blockHours).toBe(2);
    expect(SCORING_V1.weather.beyondHorizon).toBe(0.85);
    expect(SCORING_V1.weather.precipMmForCertain).toBe(2);
    expect(SCORING_V1.tide.windowHours).toBe(2);
    expect(SCORING_V1.confidence.rangePad).toBe(15);
  });

  it('keeps nested objects readonly via as const', () => {
    expectTypeOf(SCORING_V1.version).toEqualTypeOf<'1.0'>();
    expectTypeOf(SCORING_V1.alpha).toEqualTypeOf<20>();
    expectTypeOf(SCORING_V1.light.goldenHourHighDeg).toEqualTypeOf<6>();
  });
});

describe('§7 forecast I/O types', () => {
  it('accepts an ok response shaped like the ARCHITECTURE example', () => {
    const ok: ForecastOk = {
      status: 'ok',
      scoringVersion: '1.0',
      taxonId: 'taxon-kingfisher',
      tier: 'open',
      displayCell: '871f1d489ffffff',
      areaLabel: 'Glasgow · Kelvin area',
      timeZone: 'Europe/London',
      weekScore: 69,
      bestDay: '2026-11-21',
      confidence: 'medium',
      range: null,
      days: [
        {
          date: '2026-11-21',
          score: 69,
          bestBlock: { start: '07:00', end: '09:00' },
          factors: {
            seasonality: 0.68,
            timeOfDay: 0.9,
            light: 0.75,
            weather: 0.94,
            tide: 'not_used',
          },
          light: { goldenAm: ['07:31', '08:40'], goldenPm: ['15:22', '16:31'] },
        },
      ],
      explanations: [
        'Kingfishers are reported here often in late November',
        'Light rain risk is low on Saturday morning',
      ],
    };
    expect(ok.scoringVersion).toBe(SCORING_V1.version);
    expect(ok.weekScore).toBe(69);
  });

  it('covers status overrides with null score fields', () => {
    const statuses: ForecastStatus[] = ['ok', 'unavailable', 'lockout', 'not_covered'];
    expect(statuses).toHaveLength(4);

    const lockout: ForecastResponse = {
      status: 'lockout',
      scoringVersion: '1.0',
      taxonId: 'taxon-osprey',
      tier: 'highly_protected',
      timeZone: 'Europe/London',
      displayCell: '841f1dfffffffff',
      areaLabel: 'Scotland',
      weekScore: null,
      bestDay: null,
      confidence: null,
      range: null,
      days: null,
      reason: 'Resting season: no forecast',
      explanations: ['Breeding lockout for highly_protected species'],
    };
    expect(lockout.status).toBe('lockout');
    expect(lockout.weekScore).toBeNull();
  });

  it('types ForecastInput without raw user coordinates beyond cell centre', () => {
    const input: ForecastInput = {
      taxonId: 'taxon-kingfisher',
      tier: 'open',
      displayCell: '871f1d489ffffff',
      areaLabel: 'Glasgow · Kelvin area',
      timeZone: 'Europe/London',
      startDate: '2026-11-21',
      lat: 55.86,
      lng: -4.25,
      lockoutMonths: [],
    };
    expect(input.displayCell).toMatch(/^8/);
  });
});

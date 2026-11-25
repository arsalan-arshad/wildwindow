import { describe, expect, it } from 'vitest';

import { SCORING_V1 } from './config/v1.js';
import { factorD } from './factor-d.js';
import { factorG } from './factor-g.js';
import { factorWx, rainFactor, resolvePrecipProb, windFactor } from './factor-wx.js';

describe('factorG', () => {
  it('maps golden fraction to 0.5 … 1', () => {
    expect(factorG(0)).toBe(0.5);
    expect(factorG(0.5)).toBe(0.75);
    expect(factorG(1)).toBe(1);
  });
});

describe('factorWx boundaries (§4.2)', () => {
  it.each([
    { wind: 0, expected: 1 },
    { wind: 20, expected: 1 },
    { wind: 35, expected: 0.75 },
    { wind: 50, expected: 0.5 },
    { wind: 80, expected: 0.5 },
  ] as const)('windFactor($wind) → $expected', ({ wind, expected }) => {
    expect(windFactor(wind)).toBeCloseTo(expected, 10);
  });

  it.each([
    { prob: 0, expected: 1 },
    { prob: 0.5, expected: 0.7 },
    { prob: 1, expected: 0.4 },
  ] as const)('rainFactor($prob) → $expected', ({ prob, expected }) => {
    expect(rainFactor(prob)).toBeCloseTo(expected, 10);
  });

  it('derives precipProb from precipMm when missing', () => {
    expect(resolvePrecipProb({ precipMm: 0 })).toBe(0);
    expect(resolvePrecipProb({ precipMm: 1 })).toBe(0.5);
    expect(resolvePrecipProb({ precipMm: 2 })).toBe(1);
    expect(resolvePrecipProb({ precipMm: 5 })).toBe(1);
    expect(resolvePrecipProb({ precipProb: 0.25, precipMm: 5 })).toBe(0.25);
  });

  it('multiplies rain and wind factors', () => {
    const result = factorWx({
      hours: [
        { precipProb: 0, precipMm: 0, windKph: 20 },
        { precipProb: 1, precipMm: 0, windKph: 35 },
      ],
    });
    // maxProb=1 → rain 0.4; maxWind=35 → wind 0.75; Wx=0.3
    expect(result.value).toBeCloseTo(0.3, 10);
    expect(result.weather).toBeCloseTo(0.3, 10);
  });

  it('returns beyond-horizon neutral 0.85', () => {
    const result = factorWx({ beyondHorizon: true, hours: [] });
    expect(result.value).toBe(SCORING_V1.weather.beyondHorizon);
    expect(result.weather).toBe('no_forecast_yet');
  });
});

describe('factorD', () => {
  const blockStart = new Date('2026-10-10T08:00:00Z');
  const blockEnd = new Date('2026-10-10T10:00:00Z');

  it('marks tide not_used when pref is missing, none, or no data', () => {
    expect(factorD({ tidePref: undefined, blockStart, blockEnd, tides: null }).tide).toBe(
      'not_used',
    );
    expect(factorD({ tidePref: 'none', blockStart, blockEnd, tides: null }).tide).toBe('not_used');
    expect(
      factorD({
        tidePref: 'high',
        blockStart,
        blockEnd,
        tides: { highs: [], lows: [] },
      }).tide,
    ).toBe('not_used');
  });

  it('returns preferred when the block overlaps high tide ±2h', () => {
    const high = new Date('2026-10-10T09:00:00Z');
    const result = factorD({
      tidePref: 'high',
      blockStart,
      blockEnd,
      tides: { highs: [high], lows: [] },
    });
    expect(result.value).toBe(SCORING_V1.tide.preferred);
    expect(result.tide).toBe(SCORING_V1.tide.preferred);
  });

  it('returns outside when the block misses the preferred window', () => {
    const high = new Date('2026-10-10T18:00:00Z');
    const result = factorD({
      tidePref: 'high',
      blockStart,
      blockEnd,
      tides: { highs: [high], lows: [] },
    });
    expect(result.value).toBe(SCORING_V1.tide.outside);
    expect(result.tide).toBe(SCORING_V1.tide.outside);
  });

  it('handles rising (low→high) and falling (high→low)', () => {
    const low = new Date('2026-10-10T06:00:00Z');
    const high = new Date('2026-10-10T12:00:00Z');
    const rising = factorD({
      tidePref: 'rising',
      blockStart,
      blockEnd,
      tides: { highs: [high], lows: [low] },
    });
    expect(rising.value).toBe(SCORING_V1.tide.preferred);

    const fallingMiss = factorD({
      tidePref: 'falling',
      blockStart,
      blockEnd,
      tides: { highs: [high], lows: [low] },
    });
    // Block 08–10 is during rising, not falling.
    expect(fallingMiss.value).toBe(SCORING_V1.tide.outside);

    const fallingHit = factorD({
      tidePref: 'falling',
      blockStart: new Date('2026-10-10T13:00:00Z'),
      blockEnd: new Date('2026-10-10T15:00:00Z'),
      tides: {
        highs: [high],
        lows: [low, new Date('2026-10-10T18:00:00Z')],
      },
    });
    expect(fallingHit.value).toBe(SCORING_V1.tide.preferred);
  });
});

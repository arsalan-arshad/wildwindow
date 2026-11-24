import { describe, expect, it } from 'vitest';

import { factorH, p95, reportingRate } from './reporting-rate.js';
import { weeksAround } from './weeks.js';

describe('reportingRate / factorH (§4.2 / §4.6)', () => {
  it('matches the §4.6 worked example → H ≈ 0.68', () => {
    const nSpecies = 42;
    const nEffort = 3_100;
    const regionRate = 0.011;
    const rrRef = 0.02;

    const rr = reportingRate({ nSpecies, nEffort, regionRate });
    // (42 + 20·0.011) / (3100 + 20) = 42.22 / 3120 ≈ 0.013532
    expect(rr).toBeCloseTo(0.0135, 4);

    const h = factorH({
      nSpecies,
      nEffort,
      regionEffort: nEffort,
      regionRate,
      rrRef,
    });
    expect(h).toBeCloseTo(0.68, 2);
  });

  it('returns 0 when region effort is zero', () => {
    expect(
      factorH({
        nSpecies: 10,
        nEffort: 0,
        regionEffort: 0,
        regionRate: 0,
        rrRef: 0.02,
      }),
    ).toBe(0);
  });

  it('returns 0 when rr_ref is zero', () => {
    expect(
      factorH({
        nSpecies: 10,
        nEffort: 100,
        regionEffort: 1000,
        regionRate: 0.01,
        rrRef: 0,
      }),
    ).toBe(0);
  });

  it('caps H at 1', () => {
    const h = factorH({
      nSpecies: 100,
      nEffort: 100,
      regionEffort: 1000,
      regionRate: 0.5,
      rrRef: 0.01,
    });
    expect(h).toBe(1);
  });
});

describe('weeksAround', () => {
  it('wraps week 1 and week 52', () => {
    expect(weeksAround(1)).toEqual([52, 1, 2]);
    expect(weeksAround(52)).toEqual([51, 52, 1]);
    expect(weeksAround(25)).toEqual([24, 25, 26]);
  });
});

describe('p95', () => {
  it('returns the 95th percentile of reporting rates', () => {
    const values = Array.from({ length: 20 }, (_, i) => (i + 1) / 100);
    expect(p95(values)).toBeCloseTo(0.1905, 4);
  });
});

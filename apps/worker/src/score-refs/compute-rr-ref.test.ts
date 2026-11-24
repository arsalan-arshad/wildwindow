import { p95, reportingRate } from '@wildwindow/scoring';
import { describe, expect, it } from 'vitest';

import { computeRrRefFromSamples } from './run.js';

describe('computeRrRefFromSamples', () => {
  it('returns the P95 of reporting rates for known cell×week counts', () => {
    const cellWeeks = [
      { cell: 'a', res: 5, week: 25, n_records: 42 },
      { cell: 'b', res: 5, week: 25, n_records: 10 },
      { cell: 'c', res: 5, week: 26, n_records: 5 },
    ];
    const regionWeeks = new Map([
      [24, { week: 24, n_records: 0, n_effort: 0 }],
      [25, { week: 25, n_records: 52, n_effort: 4_000 }],
      [26, { week: 26, n_records: 5, n_effort: 500 }],
      [27, { week: 27, n_records: 0, n_effort: 0 }],
    ]);
    const effortByKey = new Map([
      ['5\ta\t25', 3_100],
      ['5\tb\t25', 800],
      ['5\tc\t26', 200],
    ]);

    const rrRef = computeRrRefFromSamples(cellWeeks, regionWeeks, effortByKey);
    expect(rrRef).not.toBeNull();

    const rates = cellWeeks.map((cell) => {
      const windowNs =
        (regionWeeks.get(cell.week === 1 ? 52 : cell.week - 1)?.n_records ?? 0) +
        (regionWeeks.get(cell.week)?.n_records ?? 0) +
        (regionWeeks.get(cell.week === 52 ? 1 : cell.week + 1)?.n_records ?? 0);
      const windowNe =
        (regionWeeks.get(cell.week === 1 ? 52 : cell.week - 1)?.n_effort ?? 0) +
        (regionWeeks.get(cell.week)?.n_effort ?? 0) +
        (regionWeeks.get(cell.week === 52 ? 1 : cell.week + 1)?.n_effort ?? 0);
      return reportingRate({
        nSpecies: cell.n_records,
        nEffort: effortByKey.get(`${String(cell.res)}\t${cell.cell}\t${String(cell.week)}`) ?? 0,
        regionRate: windowNe === 0 ? 0 : windowNs / windowNe,
      });
    });
    if (rrRef === null) {
      throw new Error('expected non-empty P95 sample');
    }
    expect(rrRef).toBeCloseTo(p95(rates), 10);
  });

  it('returns null when every week has zero region effort', () => {
    const rrRef = computeRrRefFromSamples(
      [{ cell: 'a', res: 5, week: 10, n_records: 5 }],
      new Map([[10, { week: 10, n_records: 5, n_effort: 0 }]]),
      new Map([['5\ta\t10', 0]]),
    );
    expect(rrRef).toBeNull();
  });
});

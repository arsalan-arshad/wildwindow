import { describe, expect, it } from 'vitest';

import {
  BACKTEST_PASS_RATIO,
  compareQuartiles,
  evaluateSpecies,
  weeklyHFromTraining,
  weeklyRrHoldout,
  type CellWeekCount,
} from './evaluate.js';

const CELL = '8719545bfffffff';

function weekRows(
  weeks: ReadonlyArray<{ week: number; nSpecies: number; nEffort: number }>,
): CellWeekCount[] {
  return weeks.map((w) => ({
    cell: CELL,
    week: w.week,
    nSpecies: w.nSpecies,
    nEffort: w.nEffort,
  }));
}

describe('weeklyHFromTraining / weeklyRrHoldout', () => {
  it('ranks high-activity weeks above low-activity weeks', () => {
    const train = weekRows([
      { week: 10, nSpecies: 40, nEffort: 200 },
      { week: 40, nSpecies: 2, nEffort: 200 },
    ]);
    const h = weeklyHFromTraining(train, [CELL], 0.2);
    expect(h.get(10) ?? 0).toBeGreaterThan(h.get(40) ?? 0);
  });

  it('computes holdout reporting rates', () => {
    const holdout = weekRows([{ week: 10, nSpecies: 20, nEffort: 100 }]);
    const rr = weeklyRrHoldout(holdout, [CELL]);
    expect(rr.get(10) ?? 0).toBeGreaterThan(0);
  });
});

describe('compareQuartiles (§4.7 pass rule)', () => {
  it('passes when top-quartile holdout RR ≥ 2× bottom', () => {
    const weeklyH = new Map<number, number>();
    const weeklyRr = new Map<number, number>();
    for (let w = 1; w <= 52; w += 1) {
      // First 13 weeks high H and high holdout RR; last 13 low.
      const high = w <= 13;
      weeklyH.set(w, high ? 0.9 : 0.1);
      weeklyRr.set(w, high ? 0.04 : 0.01);
    }
    const result = compareQuartiles(weeklyH, weeklyRr);
    expect(result.status).toBe('pass');
    expect(result.ratio).toBeGreaterThanOrEqual(BACKTEST_PASS_RATIO);
  });

  it('fails when top and bottom holdout RR are similar', () => {
    const weeklyH = new Map<number, number>();
    const weeklyRr = new Map<number, number>();
    for (let w = 1; w <= 52; w += 1) {
      weeklyH.set(w, w <= 13 ? 0.9 : 0.1);
      weeklyRr.set(w, 0.02);
    }
    const result = compareQuartiles(weeklyH, weeklyRr);
    expect(result.status).toBe('fail');
  });

  it('returns insufficient when almost no weeks are active', () => {
    const weeklyH = new Map<number, number>([[1, 0.5]]);
    const weeklyRr = new Map<number, number>([[1, 0.01]]);
    expect(compareQuartiles(weeklyH, weeklyRr).status).toBe('insufficient');
  });
});

describe('evaluateSpecies', () => {
  it('skips no_forecast', () => {
    const result = evaluateSpecies({
      taxonId: 1,
      scientificName: 'Tetrao urogallus',
      commonName: 'Capercaillie',
      tier: 'no_forecast',
      trainCellWeeks: [],
      holdoutCellWeeks: [],
      publishedCells: [],
      rrRef: 0.02,
      distinctTrainYears: 0,
    });
    expect(result.status).toBe('skipped');
  });

  it('passes on a fixture where high-H weeks stay hot in holdout', () => {
    const highWeeks = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
    const lowWeeks = [30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42];
    const train: CellWeekCount[] = [];
    const holdout: CellWeekCount[] = [];
    for (const week of highWeeks) {
      train.push({ cell: CELL, week, nSpecies: 30, nEffort: 150 });
      holdout.push({ cell: CELL, week, nSpecies: 25, nEffort: 120 });
    }
    for (const week of lowWeeks) {
      train.push({ cell: CELL, week, nSpecies: 2, nEffort: 150 });
      holdout.push({ cell: CELL, week, nSpecies: 1, nEffort: 120 });
    }

    const result = evaluateSpecies({
      taxonId: 2,
      scientificName: 'Alcedo atthis',
      commonName: 'Common kingfisher',
      tier: 'open',
      trainCellWeeks: train,
      holdoutCellWeeks: holdout,
      publishedCells: [CELL],
      rrRef: 0.2,
      distinctTrainYears: 5,
    });
    expect(result.status).toBe('pass');
    expect(result.ratio).not.toBeNull();
    expect(result.ratio ?? 0).toBeGreaterThanOrEqual(BACKTEST_PASS_RATIO);
  });
});

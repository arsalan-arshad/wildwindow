/**
 * Backtest pass rule (§4.7 / PRD §8):
 * In the held-out year, top-quartile weeks (by training H) have ≥ 2× the
 * reporting rate of bottom-quartile weeks.
 */
import {
  confidenceLabel,
  factorH,
  reportingRate,
  weeksAround,
  type Confidence,
} from '@wildwindow/scoring';

export const BACKTEST_PASS_RATIO = 2;

export type CellWeekCount = {
  readonly cell: string;
  readonly week: number;
  readonly nSpecies: number;
  readonly nEffort: number;
};

export type SpeciesBacktestInput = {
  readonly taxonId: number;
  readonly scientificName: string;
  readonly commonName: string;
  readonly tier: string;
  /** Training-year cell×week counts (already filtered to training years). */
  readonly trainCellWeeks: readonly CellWeekCount[];
  /** Holdout-year cell×week counts. */
  readonly holdoutCellWeeks: readonly CellWeekCount[];
  /** Published cells that define the evaluation neighbourhood. */
  readonly publishedCells: readonly string[];
  readonly rrRef: number;
  readonly distinctTrainYears: number;
};

export type SpeciesBacktestResult = {
  readonly taxonId: number;
  readonly scientificName: string;
  readonly commonName: string;
  readonly tier: string;
  readonly status: 'pass' | 'fail' | 'insufficient' | 'skipped';
  readonly topMeanRr: number | null;
  readonly bottomMeanRr: number | null;
  readonly ratio: number | null;
  readonly confidence: Confidence | null;
  readonly weeksEvaluated: number;
  readonly note: string;
};

function sumWindow(
  byWeek: ReadonlyMap<number, { nSpecies: number; nEffort: number }>,
  week: number,
): { nSpecies: number; nEffort: number; regionRate: number } {
  let nSpecies = 0;
  let nEffort = 0;
  for (const w of weeksAround(week)) {
    const row = byWeek.get(w);
    if (row === undefined) {
      continue;
    }
    nSpecies += row.nSpecies;
    nEffort += row.nEffort;
  }
  const regionRate = nEffort === 0 ? 0 : nSpecies / nEffort;
  return { nSpecies, nEffort, regionRate };
}

function aggregateByWeek(
  rows: readonly CellWeekCount[],
  cells: ReadonlySet<string>,
): Map<number, { nSpecies: number; nEffort: number }> {
  const map = new Map<number, { nSpecies: number; nEffort: number }>();
  for (const row of rows) {
    if (!cells.has(row.cell)) {
      continue;
    }
    const existing = map.get(row.week);
    if (existing === undefined) {
      map.set(row.week, { nSpecies: row.nSpecies, nEffort: row.nEffort });
    } else {
      existing.nSpecies += row.nSpecies;
      existing.nEffort += row.nEffort;
    }
  }
  return map;
}

/**
 * Mean weekly H over published cells from training counts (§4.7).
 * Returns a dense 1..52 map (missing weeks → 0).
 */
export function weeklyHFromTraining(
  trainCellWeeks: readonly CellWeekCount[],
  publishedCells: readonly string[],
  rrRef: number,
): Map<number, number> {
  const cells = new Set(publishedCells);
  const byWeek = aggregateByWeek(trainCellWeeks, cells);
  const result = new Map<number, number>();
  for (let week = 1; week <= 52; week += 1) {
    const window = sumWindow(byWeek, week);
    const h = factorH({
      nSpecies: window.nSpecies,
      nEffort: window.nEffort,
      regionEffort: window.nEffort,
      regionRate: window.regionRate,
      rrRef,
    });
    result.set(week, h);
  }
  return result;
}

/**
 * Holdout-year reporting rate per week (weeksAround smoothed), published cells only.
 */
export function weeklyRrHoldout(
  holdoutCellWeeks: readonly CellWeekCount[],
  publishedCells: readonly string[],
): Map<number, number> {
  const cells = new Set(publishedCells);
  const byWeek = aggregateByWeek(holdoutCellWeeks, cells);
  const result = new Map<number, number>();
  for (let week = 1; week <= 52; week += 1) {
    const window = sumWindow(byWeek, week);
    if (window.nEffort === 0 && window.nSpecies === 0) {
      result.set(week, 0);
      continue;
    }
    result.set(
      week,
      reportingRate({
        nSpecies: window.nSpecies,
        nEffort: window.nEffort,
        regionRate: window.regionRate,
      }),
    );
  }
  return result;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  let sum = 0;
  for (const v of values) {
    sum += v;
  }
  return sum / values.length;
}

function quartileSize(n: number): number {
  return Math.max(1, Math.floor(n / 4));
}

export type QuartileComparison = {
  readonly status: 'pass' | 'fail' | 'insufficient';
  readonly topMeanRr: number;
  readonly bottomMeanRr: number;
  readonly ratio: number | null;
  readonly weeksEvaluated: number;
  readonly note: string;
};

/**
 * Rank weeks by training H; compare holdout RR of top vs bottom quartile.
 */
export function compareQuartiles(
  weeklyH: ReadonlyMap<number, number>,
  weeklyRr: ReadonlyMap<number, number>,
): QuartileComparison {
  const weeks: Array<{ week: number; h: number; rr: number }> = [];
  for (let week = 1; week <= 52; week += 1) {
    const h = weeklyH.get(week) ?? 0;
    const rr = weeklyRr.get(week) ?? 0;
    weeks.push({ week, h, rr });
  }

  // Only weeks with some signal in training or holdout count toward ranking.
  const active = weeks.filter((w) => w.h > 0 || w.rr > 0);
  if (active.length < 4) {
    return {
      status: 'insufficient',
      topMeanRr: 0,
      bottomMeanRr: 0,
      ratio: null,
      weeksEvaluated: active.length,
      note: 'fewer than 4 active weeks',
    };
  }

  const ranked = [...active].sort((a, b) => b.h - a.h || a.week - b.week);
  const q = quartileSize(ranked.length);
  const top = ranked.slice(0, q);
  const bottom = ranked.slice(-q);
  const topMeanRr = mean(top.map((w) => w.rr));
  const bottomMeanRr = mean(bottom.map((w) => w.rr));

  if (topMeanRr === 0 && bottomMeanRr === 0) {
    return {
      status: 'insufficient',
      topMeanRr,
      bottomMeanRr,
      ratio: null,
      weeksEvaluated: active.length,
      note: 'zero reporting rate in both quartiles',
    };
  }

  if (bottomMeanRr === 0) {
    return {
      status: 'pass',
      topMeanRr,
      bottomMeanRr,
      ratio: null,
      weeksEvaluated: active.length,
      note: 'bottom quartile RR is 0; top > 0',
    };
  }

  const ratio = topMeanRr / bottomMeanRr;
  if (ratio >= BACKTEST_PASS_RATIO) {
    return {
      status: 'pass',
      topMeanRr,
      bottomMeanRr,
      ratio,
      weeksEvaluated: active.length,
      note: `ratio ${ratio.toFixed(2)} ≥ ${String(BACKTEST_PASS_RATIO)}`,
    };
  }
  return {
    status: 'fail',
    topMeanRr,
    bottomMeanRr,
    ratio,
    weeksEvaluated: active.length,
    note: `ratio ${ratio.toFixed(2)} < ${String(BACKTEST_PASS_RATIO)}`,
  };
}

function confidenceFromTrain(
  trainCellWeeks: readonly CellWeekCount[],
  publishedCells: readonly string[],
  distinctTrainYears: number,
): Confidence {
  const cells = new Set(publishedCells);
  let nSpecies = 0;
  let nEffort = 0;
  for (const row of trainCellWeeks) {
    if (!cells.has(row.cell)) {
      continue;
    }
    nSpecies += row.nSpecies;
    nEffort += row.nEffort;
  }
  return confidenceLabel({
    nSpecies,
    nEffort,
    distinctYears: distinctTrainYears,
    regionEffort: nEffort,
  });
}

/**
 * Evaluate one species for the holdout year (§4.7).
 */
export function evaluateSpecies(input: SpeciesBacktestInput): SpeciesBacktestResult {
  const base = {
    taxonId: input.taxonId,
    scientificName: input.scientificName,
    commonName: input.commonName,
    tier: input.tier,
  };

  if (input.tier === 'no_forecast') {
    return {
      ...base,
      status: 'skipped',
      topMeanRr: null,
      bottomMeanRr: null,
      ratio: null,
      confidence: null,
      weeksEvaluated: 0,
      note: 'tier no_forecast',
    };
  }

  if (input.publishedCells.length === 0) {
    return {
      ...base,
      status: 'insufficient',
      topMeanRr: null,
      bottomMeanRr: null,
      ratio: null,
      confidence: null,
      weeksEvaluated: 0,
      note: 'no published cells',
    };
  }

  if (input.rrRef <= 0) {
    return {
      ...base,
      status: 'insufficient',
      topMeanRr: null,
      bottomMeanRr: null,
      ratio: null,
      confidence: null,
      weeksEvaluated: 0,
      note: 'rr_ref unavailable',
    };
  }

  const weeklyH = weeklyHFromTraining(input.trainCellWeeks, input.publishedCells, input.rrRef);
  const weeklyRr = weeklyRrHoldout(input.holdoutCellWeeks, input.publishedCells);
  const comparison = compareQuartiles(weeklyH, weeklyRr);
  const confidence = confidenceFromTrain(
    input.trainCellWeeks,
    input.publishedCells,
    input.distinctTrainYears,
  );

  return {
    ...base,
    status: comparison.status,
    topMeanRr: comparison.topMeanRr,
    bottomMeanRr: comparison.bottomMeanRr,
    ratio: comparison.ratio,
    confidence,
    weeksEvaluated: comparison.weeksEvaluated,
    note: comparison.note,
  };
}

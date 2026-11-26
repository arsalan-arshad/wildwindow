import { bucketise, TIER_POLICY, type BucketLevel, type Tier } from '@wildwindow/geoprivacy';
import { getResolution, isValidCell } from 'h3-js';

/** Aggregated published intensity for one H3 cell (sums across weeks). */
export type PublishedCellAggregate = {
  readonly cell: string;
  readonly nRecords: number;
};

export type PublicMapCell = {
  readonly cell: string;
  readonly level: BucketLevel;
};

/**
 * Build public map cells from published `pub.taxon_cell_week` aggregates.
 * Levels are 1–5 quantile buckets — never raw counts (ARCHITECTURE §5.2 / §7).
 * Returns `[]` when the tier has `mapCells: false` (`highly_protected`, `no_forecast`).
 * Drops any cell finer than the tier allows (fail-closed).
 */
export function publicMapCells(
  aggregates: readonly PublishedCellAggregate[],
  tier: Tier,
): PublicMapCell[] {
  const policy = TIER_POLICY[tier];
  const tierRes = policy.resolution;
  // mapCells=false covers highly_protected / no_forecast; resolution null is no_forecast.
  if (!policy.mapCells || tierRes === null) {
    return [];
  }

  const valid: PublishedCellAggregate[] = [];
  for (const row of aggregates) {
    if (!Number.isFinite(row.nRecords) || row.nRecords <= 0) {
      continue;
    }
    if (!isValidCell(row.cell)) {
      continue;
    }
    if (getResolution(row.cell) > tierRes) {
      // Published data should already be ≤ tier res; never leak finer cells.
      continue;
    }
    valid.push(row);
  }

  if (valid.length === 0) {
    return [];
  }

  const levelOf = bucketise(valid.map((row) => row.nRecords));
  return valid
    .map((row) => ({
      cell: row.cell,
      level: levelOf(row.nRecords),
    }))
    .sort((a, b) => a.cell.localeCompare(b.cell));
}

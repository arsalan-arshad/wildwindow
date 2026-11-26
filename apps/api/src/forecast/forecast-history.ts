import {
  effortCellWeek,
  taxonCellWeek,
  taxonHourProfile,
  taxonRegionWeek,
  taxonScoreRef,
  type Database,
} from '@wildwindow/db';
import { weeksAround, type HistoryInput } from '@wildwindow/scoring';
import { and, eq, inArray, sql } from 'drizzle-orm';

export type HistoryLoadParams = {
  readonly taxonId: number;
  readonly regionId: number;
  readonly effortGroup: string;
  readonly cells: readonly string[];
  readonly week: number;
  readonly scoringVersion: string;
};

export type HourProfileLoad = {
  readonly counts: number[];
};

/**
 * Load seasonality / local-history inputs for `computeForecast` (§4.1–§4.2).
 * Neighbourhood cells and W±1 weeks are summed; missing rows count as zero.
 */
export async function loadForecastHistory(
  db: Database,
  params: HistoryLoadParams,
): Promise<{ readonly history: HistoryInput; readonly hourCounts: readonly number[] }> {
  const weekWindow = weeksAround(params.week);
  const cells = [...params.cells];

  let nSpecies = 0;
  let nEffort = 0;
  let distinctYears = 0;

  if (cells.length > 0) {
    const speciesRows = await db
      .select({
        nRecords: sql<number>`coalesce(sum(${taxonCellWeek.nRecords}), 0)`.mapWith(Number),
        maxYears: sql<number>`coalesce(max(${taxonCellWeek.yearsCovered}), 0)`.mapWith(Number),
      })
      .from(taxonCellWeek)
      .where(
        and(
          eq(taxonCellWeek.taxonId, params.taxonId),
          eq(taxonCellWeek.regionId, params.regionId),
          inArray(taxonCellWeek.cell, cells),
          inArray(taxonCellWeek.week, [...weekWindow]),
        ),
      );

    nSpecies = speciesRows[0]?.nRecords ?? 0;
    distinctYears = speciesRows[0]?.maxYears ?? 0;

    const effortRows = await db
      .select({
        nRecords: sql<number>`coalesce(sum(${effortCellWeek.nRecords}), 0)`.mapWith(Number),
      })
      .from(effortCellWeek)
      .where(
        and(
          eq(effortCellWeek.effortGroup, params.effortGroup),
          eq(effortCellWeek.regionId, params.regionId),
          inArray(effortCellWeek.cell, cells),
          inArray(effortCellWeek.week, [...weekWindow]),
        ),
      );
    nEffort = effortRows[0]?.nRecords ?? 0;
  }

  const regionRows = await db
    .select({
      nRecords: sql<number>`coalesce(sum(${taxonRegionWeek.nRecords}), 0)`.mapWith(Number),
      nEffort: sql<number>`coalesce(sum(${taxonRegionWeek.nEffort}), 0)`.mapWith(Number),
    })
    .from(taxonRegionWeek)
    .where(
      and(
        eq(taxonRegionWeek.taxonId, params.taxonId),
        eq(taxonRegionWeek.regionId, params.regionId),
        inArray(taxonRegionWeek.week, [...weekWindow]),
      ),
    );

  const regionSpecies = regionRows[0]?.nRecords ?? 0;
  const regionEffort = regionRows[0]?.nEffort ?? 0;
  const regionRate = regionEffort === 0 ? 0 : regionSpecies / regionEffort;

  const refRows = await db
    .select({ rrRef: taxonScoreRef.rrRef })
    .from(taxonScoreRef)
    .where(
      and(
        eq(taxonScoreRef.taxonId, params.taxonId),
        eq(taxonScoreRef.regionId, params.regionId),
        eq(taxonScoreRef.scoringVersion, params.scoringVersion),
      ),
    )
    .limit(1);

  // Missing rr_ref → 0 so factorH yields 0 (Low confidence) rather than inventing a baseline.
  const rrRef = refRows[0]?.rrRef ?? 0;

  const hourRows = await db
    .select({
      hour: taxonHourProfile.hour,
      nRecords: taxonHourProfile.nRecords,
    })
    .from(taxonHourProfile)
    .where(
      and(
        eq(taxonHourProfile.taxonId, params.taxonId),
        eq(taxonHourProfile.regionId, params.regionId),
      ),
    );

  const hourCounts = Array.from({ length: 24 }, () => 0);
  for (const row of hourRows) {
    if (row.hour >= 0 && row.hour <= 23) {
      hourCounts[row.hour] = row.nRecords;
    }
  }

  return {
    history: {
      nSpecies,
      nEffort,
      regionEffort,
      regionRate,
      rrRef,
      distinctYears,
    },
    hourCounts,
  };
}

/**
 * `backtest --region --holdout` — §4.7 validation report (T4.9).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { createPool } from '@wildwindow/db';
import { snapToCell, TIER_POLICY, type Tier } from '@wildwindow/geoprivacy';
import { p95, reportingRate, SCORING_V1, weeksAround } from '@wildwindow/scoring';
import { loadEnv } from '@wildwindow/shared';
import { cellToParent, getResolution } from 'h3-js';
import { z } from 'zod';

import { defaultReportsDir } from '../paths.js';

import { evaluateSpecies, type CellWeekCount, type SpeciesBacktestResult } from './evaluate.js';
import { defaultBacktestReportName, formatBacktestReport } from './report.js';
import { yearWindowForHoldout } from './years.js';

import type { IngestRegion } from '../gbif/predicate.js';
import type { Pool, PoolClient } from 'pg';

const backtestEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_WORKER: z.string().min(1).optional(),
});

const TIERS = new Set<string>(Object.keys(TIER_POLICY));

export type BacktestOptions = {
  readonly region: IngestRegion;
  readonly holdoutYear: number;
  /** Output markdown path; default `reports/backtest-<region>-<year>.md`. */
  readonly outPath?: string;
  readonly now?: Date;
  readonly env?: z.infer<typeof backtestEnvSchema>;
  readonly pool?: Pool;
};

export type BacktestResult = {
  readonly regionId: number;
  readonly regionSlug: string;
  readonly holdoutYear: number;
  readonly outPath: string;
  readonly speciesResults: readonly SpeciesBacktestResult[];
  readonly passed: number;
  readonly failed: number;
  readonly insufficient: number;
  readonly skipped: number;
};

type TaxonRow = {
  readonly taxon_id: number;
  readonly scientific_name: string;
  readonly common_en: string | null;
  readonly effort_group: string;
  readonly tier: string;
};

type OccurrencePoint = {
  readonly year: number;
  readonly week: number;
  readonly lat: number;
  readonly lng: number;
};

type EffortRow = {
  readonly res: number;
  readonly cell: string;
  readonly week: number;
  readonly n_records: number;
};

function parseTier(value: string): Tier {
  if (!TIERS.has(value)) {
    throw new Error(`unknown tier ${value}`);
  }
  return value as Tier;
}

function commonNameEn(commonEn: string | null, scientificName: string): string {
  if (commonEn !== null && commonEn.length > 0) {
    return commonEn;
  }
  return scientificName;
}

async function loadRegion(client: PoolClient, slug: string): Promise<{ id: number; slug: string }> {
  const result = await client.query<{ id: number; slug: string }>(
    `SELECT id, slug FROM ref.regions WHERE slug = $1`,
    [slug],
  );
  const row = result.rows[0];
  if (row === undefined) {
    throw new Error(`region slug=${slug} not found`);
  }
  return { id: row.id, slug: row.slug };
}

async function loadTaxa(client: PoolClient, regionId: number): Promise<TaxonRow[]> {
  const result = await client.query<TaxonRow>(
    `
    SELECT
      tr.taxon_id,
      t.scientific_name,
      t.common_names->>'en' AS common_en,
      t.effort_group,
      tr.tier
    FROM ref.taxon_region tr
    JOIN ref.taxa t ON t.id = tr.taxon_id
    WHERE tr.region_id = $1
    ORDER BY t.scientific_name
    `,
    [regionId],
  );
  return result.rows;
}

async function loadPublishedCells(
  client: PoolClient,
  taxonId: number,
  regionId: number,
): Promise<Array<{ cell: string; res: number }>> {
  const result = await client.query<{ cell: string; res: number }>(
    `
    SELECT DISTINCT cell, res
    FROM pub.taxon_cell_week
    WHERE taxon_id = $1 AND region_id = $2
    `,
    [taxonId, regionId],
  );
  return result.rows;
}

async function loadRrRef(
  client: PoolClient,
  taxonId: number,
  regionId: number,
): Promise<number | null> {
  const result = await client.query<{ rr_ref: number }>(
    `SELECT rr_ref FROM pub.taxon_score_ref WHERE taxon_id = $1 AND region_id = $2`,
    [taxonId, regionId],
  );
  return result.rows[0]?.rr_ref ?? null;
}

async function loadSpeciesPoints(
  client: PoolClient,
  taxonId: number,
  regionId: number,
  fromYear: number,
  toYear: number,
): Promise<OccurrencePoint[]> {
  const result = await client.query<OccurrencePoint>(
    `
    SELECT
      year,
      week,
      ST_Y(geom::geometry) AS lat,
      ST_X(geom::geometry) AS lng
    FROM raw.occurrences
    WHERE taxon_id = $1
      AND region_id = $2
      AND year >= $3
      AND year <= $4
    `,
    [taxonId, regionId, fromYear, toYear],
  );
  return result.rows;
}

async function loadEffortRows(
  client: PoolClient,
  effortGroup: string,
  regionId: number,
): Promise<EffortRow[]> {
  const result = await client.query<EffortRow>(
    `
    SELECT res, cell, week, n_records
    FROM pub.effort_cell_week
    WHERE effort_group = $1 AND region_id = $2
    `,
    [effortGroup, regionId],
  );
  return result.rows;
}

/**
 * Map a snapped tier-resolution cell onto a published cell (same cell or coarser parent).
 */
export function mapToPublishedCell(
  snappedCell: string,
  published: ReadonlyMap<string, number>,
): string | null {
  if (published.has(snappedCell)) {
    return snappedCell;
  }
  const snappedRes = getResolution(snappedCell);
  for (const [pubCell, pubRes] of published) {
    if (snappedRes > pubRes && cellToParent(snappedCell, pubRes) === pubCell) {
      return pubCell;
    }
  }
  return null;
}

function effortFor(
  effortByKey: ReadonlyMap<string, number>,
  res: number,
  cell: string,
  week: number,
): number {
  return effortByKey.get(`${String(res)}\t${cell}\t${String(week)}`) ?? 0;
}

/**
 * Build year-pooled cell×week counts for a year range.
 * Species points are snapped to the tier resolution then mapped to published cells.
 * Effort comes from pub.effort_cell_week (multi-year totals; see report note).
 */
export function buildCellWeekCounts(options: {
  readonly points: readonly OccurrencePoint[];
  readonly published: ReadonlyMap<string, number>;
  readonly tierRes: number;
  readonly effortByKey: ReadonlyMap<string, number>;
}): { counts: CellWeekCount[]; distinctYears: number } {
  const years = new Set<number>();
  const nSpecies = new Map<string, number>();
  const nEffort = new Map<string, number>();

  for (const point of options.points) {
    years.add(point.year);
    const snapped = snapToCell(point.lat, point.lng, options.tierRes);
    const publishedCell = mapToPublishedCell(snapped, options.published);
    if (publishedCell === null) {
      continue;
    }
    const key = `${publishedCell}\t${String(point.week)}`;
    nSpecies.set(key, (nSpecies.get(key) ?? 0) + 1);
  }

  for (const [cell, res] of options.published) {
    for (let week = 1; week <= 52; week += 1) {
      const key = `${cell}\t${String(week)}`;
      const e = effortFor(options.effortByKey, res, cell, week);
      if (e > 0) {
        nEffort.set(key, e);
      }
    }
  }

  const counts: CellWeekCount[] = [];
  const keys = new Set([...nSpecies.keys(), ...nEffort.keys()]);
  for (const key of keys) {
    const [cell, weekStr] = key.split('\t');
    if (cell === undefined || weekStr === undefined) {
      continue;
    }
    counts.push({
      cell,
      week: Number(weekStr),
      nSpecies: nSpecies.get(key) ?? 0,
      nEffort: nEffort.get(key) ?? 0,
    });
  }

  return {
    counts,
    distinctYears: years.size,
  };
}

/**
 * Compute rr_ref from training cell×week samples when score:refs is missing.
 */
export function computeRrRefFromCellWeeks(cellWeeks: readonly CellWeekCount[]): number | null {
  const byWeek = new Map<number, { nSpecies: number; nEffort: number }>();
  for (const row of cellWeeks) {
    const existing = byWeek.get(row.week);
    if (existing === undefined) {
      byWeek.set(row.week, { nSpecies: row.nSpecies, nEffort: row.nEffort });
    } else {
      existing.nSpecies += row.nSpecies;
      existing.nEffort += row.nEffort;
    }
  }

  const rates: number[] = [];
  for (const row of cellWeeks) {
    let nSpecies = 0;
    let nEffort = 0;
    for (const w of weeksAround(row.week)) {
      const region = byWeek.get(w);
      if (region === undefined) {
        continue;
      }
      nSpecies += region.nSpecies;
      nEffort += region.nEffort;
    }
    if (nEffort === 0) {
      continue;
    }
    rates.push(
      reportingRate({
        nSpecies: row.nSpecies,
        nEffort: row.nEffort,
        regionRate: nSpecies / nEffort,
      }),
    );
  }
  if (rates.length === 0) {
    return null;
  }
  return p95(rates);
}

/**
 * Run the backtest and write the Markdown report.
 */
export async function runBacktest(options: BacktestOptions): Promise<BacktestResult> {
  const window = yearWindowForHoldout(options.holdoutYear);
  const env = options.env ?? loadEnv(backtestEnvSchema);
  const connectionString = env.DATABASE_URL_WORKER ?? env.DATABASE_URL;
  const ownedPool = options.pool === undefined;
  const pool = options.pool ?? createPool(connectionString);
  const now = options.now ?? new Date();
  const outPath =
    options.outPath ??
    resolve(defaultReportsDir(), defaultBacktestReportName(options.region, options.holdoutYear));

  try {
    const client = await pool.connect();
    try {
      const region = await loadRegion(client, options.region);
      const taxa = await loadTaxa(client, region.id);
      const results: SpeciesBacktestResult[] = [];

      for (const taxon of taxa) {
        const tier = parseTier(taxon.tier);
        const commonName = commonNameEn(taxon.common_en, taxon.scientific_name);

        if (tier === 'no_forecast') {
          results.push(
            evaluateSpecies({
              taxonId: taxon.taxon_id,
              scientificName: taxon.scientific_name,
              commonName,
              tier,
              trainCellWeeks: [],
              holdoutCellWeeks: [],
              publishedCells: [],
              rrRef: 0,
              distinctTrainYears: 0,
            }),
          );
          continue;
        }

        const tierRes = TIER_POLICY[tier].resolution;
        // Exhaustiveness: no_forecast (resolution null) already continued above.
        if (typeof tierRes !== 'number') {
          continue;
        }

        const publishedRows = await loadPublishedCells(client, taxon.taxon_id, region.id);
        const published = new Map(publishedRows.map((r) => [r.cell, r.res]));
        const publishedCells = [...published.keys()];

        const effortRows = await loadEffortRows(client, taxon.effort_group, region.id);
        const effortByKey = new Map<string, number>();
        for (const row of effortRows) {
          effortByKey.set(`${String(row.res)}\t${row.cell}\t${String(row.week)}`, row.n_records);
        }

        const trainPoints = await loadSpeciesPoints(
          client,
          taxon.taxon_id,
          region.id,
          window.trainFromYear,
          window.trainToYear,
        );
        const holdoutPoints = await loadSpeciesPoints(
          client,
          taxon.taxon_id,
          region.id,
          window.holdoutYear,
          window.holdoutYear,
        );

        const trainBuilt = buildCellWeekCounts({
          points: trainPoints,
          published,
          tierRes,
          effortByKey,
        });
        const holdoutBuilt = buildCellWeekCounts({
          points: holdoutPoints,
          published,
          tierRes,
          effortByKey,
        });

        let rrRef = await loadRrRef(client, taxon.taxon_id, region.id);
        if (rrRef === null || rrRef <= 0) {
          rrRef = computeRrRefFromCellWeeks(trainBuilt.counts);
        }

        results.push(
          evaluateSpecies({
            taxonId: taxon.taxon_id,
            scientificName: taxon.scientific_name,
            commonName,
            tier,
            trainCellWeeks: trainBuilt.counts,
            holdoutCellWeeks: holdoutBuilt.counts,
            publishedCells,
            rrRef: rrRef ?? 0,
            distinctTrainYears: trainBuilt.distinctYears,
          }),
        );
      }

      const markdown = formatBacktestReport({
        regionSlug: region.slug,
        window,
        scoringVersion: SCORING_V1.version,
        generatedAt: now,
        results,
        effortNote:
          'Effort uses pub.effort_cell_week (multi-year totals). Species counts are year-sliced from raw.occurrences so week ranking still reflects holdout seasonality.',
      });

      await mkdir(dirname(outPath), { recursive: true });
      await writeFile(outPath, markdown, 'utf8');

      return {
        regionId: region.id,
        regionSlug: region.slug,
        holdoutYear: window.holdoutYear,
        outPath,
        speciesResults: results,
        passed: results.filter((r) => r.status === 'pass').length,
        failed: results.filter((r) => r.status === 'fail').length,
        insufficient: results.filter((r) => r.status === 'insufficient').length,
        skipped: results.filter((r) => r.status === 'skipped').length,
      };
    } finally {
      client.release();
    }
  } finally {
    if (ownedPool) {
      await pool.end();
    }
  }
}

import { createPool } from '@wildwindow/db';
import { p95, reportingRate, SCORING_V1, weeksAround } from '@wildwindow/scoring';
import { loadEnv } from '@wildwindow/shared';
import { z } from 'zod';

import type { IngestRegion } from '../gbif/predicate.js';
import type { Pool, PoolClient } from 'pg';

const scoreRefsEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_WORKER: z.string().min(1).optional(),
});

export type ScoreRefsOptions = {
  readonly region: IngestRegion;
  readonly now?: Date;
  readonly env?: z.infer<typeof scoreRefsEnvSchema>;
  readonly pool?: Pool;
};

export type ScoreRefsResult = {
  readonly regionId: number;
  readonly regionSlug: string;
  readonly taxaProcessed: number;
  readonly taxaSkipped: number;
  readonly refsWritten: number;
};

type CellWeekRow = {
  readonly cell: string;
  readonly res: number;
  readonly week: number;
  readonly n_records: number;
};

type RegionWeekRow = {
  readonly week: number;
  readonly n_records: number;
  readonly n_effort: number;
};

type TaxonRow = {
  readonly taxon_id: number;
  readonly effort_group: string;
  readonly tier: string;
};

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
    SELECT tr.taxon_id, t.effort_group, tr.tier
    FROM ref.taxon_region tr
    JOIN ref.taxa t ON t.id = tr.taxon_id
    WHERE tr.region_id = $1
    ORDER BY tr.taxon_id
    `,
    [regionId],
  );
  return result.rows;
}

async function loadCellWeeks(
  client: PoolClient,
  taxonId: number,
  regionId: number,
): Promise<CellWeekRow[]> {
  const result = await client.query<CellWeekRow>(
    `
    SELECT cell, res, week, n_records
    FROM pub.taxon_cell_week
    WHERE taxon_id = $1 AND region_id = $2
    `,
    [taxonId, regionId],
  );
  return result.rows;
}

async function loadRegionWeeks(
  client: PoolClient,
  taxonId: number,
  regionId: number,
): Promise<Map<number, RegionWeekRow>> {
  const result = await client.query<RegionWeekRow>(
    `
    SELECT week, n_records, n_effort
    FROM pub.taxon_region_week
    WHERE taxon_id = $1 AND region_id = $2
    `,
    [taxonId, regionId],
  );
  const map = new Map<number, RegionWeekRow>();
  for (const row of result.rows) {
    map.set(row.week, row);
  }
  return map;
}

async function loadEffort(
  client: PoolClient,
  effortGroup: string,
  regionId: number,
  res: number,
  cell: string,
  week: number,
): Promise<number> {
  const result = await client.query<{ n: string }>(
    `
    SELECT COALESCE(n_records, 0)::text AS n
    FROM pub.effort_cell_week
    WHERE effort_group = $1 AND region_id = $2 AND res = $3 AND cell = $4 AND week = $5
    `,
    [effortGroup, regionId, res, cell, week],
  );
  return Number(result.rows[0]?.n ?? 0);
}

function regionWindowTotals(
  regionWeeks: ReadonlyMap<number, RegionWeekRow>,
  week: number,
): { nSpecies: number; nEffort: number; regionRate: number } {
  let nSpecies = 0;
  let nEffort = 0;
  for (const w of weeksAround(week)) {
    const row = regionWeeks.get(w);
    if (row === undefined) {
      continue;
    }
    nSpecies += row.n_records;
    nEffort += row.n_effort;
  }
  const regionRate = nEffort === 0 ? 0 : nSpecies / nEffort;
  return { nSpecies, nEffort, regionRate };
}

/**
 * Compute rr_ref = P95 of reportingRate over published cell×weeks (§4.2 / T3.7).
 * Returns null when there are no usable samples (e.g. zero region effort everywhere).
 */
export function computeRrRefFromSamples(
  cellWeeks: readonly CellWeekRow[],
  regionWeeks: ReadonlyMap<number, RegionWeekRow>,
  effortByKey: ReadonlyMap<string, number>,
): number | null {
  const rates: number[] = [];
  for (const cell of cellWeeks) {
    const window = regionWindowTotals(regionWeeks, cell.week);
    if (window.nEffort === 0) {
      continue;
    }
    const effortKey = `${String(cell.res)}\t${cell.cell}\t${String(cell.week)}`;
    const nEffort = effortByKey.get(effortKey) ?? 0;
    rates.push(
      reportingRate({
        nSpecies: cell.n_records,
        nEffort,
        regionRate: window.regionRate,
      }),
    );
  }
  if (rates.length === 0) {
    return null;
  }
  return p95(rates);
}

/**
 * `score:refs --region` — write pub.taxon_score_ref.rr_ref (P95) per taxon (§3.2 step 5).
 */
export async function runScoreRefs(options: ScoreRefsOptions): Promise<ScoreRefsResult> {
  const env = options.env ?? loadEnv(scoreRefsEnvSchema);
  const connectionString = env.DATABASE_URL_WORKER ?? env.DATABASE_URL;
  const ownedPool = options.pool === undefined;
  const pool = options.pool ?? createPool(connectionString);
  const now = options.now ?? new Date();

  try {
    const client = await pool.connect();
    try {
      const region = await loadRegion(client, options.region);
      const taxa = await loadTaxa(client, region.id);

      let taxaProcessed = 0;
      let taxaSkipped = 0;
      let refsWritten = 0;

      await client.query('BEGIN');
      try {
        for (const taxon of taxa) {
          if (taxon.tier === 'no_forecast') {
            taxaSkipped += 1;
            await client.query(
              `DELETE FROM pub.taxon_score_ref WHERE taxon_id = $1 AND region_id = $2`,
              [taxon.taxon_id, region.id],
            );
            continue;
          }

          const cellWeeks = await loadCellWeeks(client, taxon.taxon_id, region.id);
          if (cellWeeks.length === 0) {
            taxaSkipped += 1;
            await client.query(
              `DELETE FROM pub.taxon_score_ref WHERE taxon_id = $1 AND region_id = $2`,
              [taxon.taxon_id, region.id],
            );
            continue;
          }

          const regionWeeks = await loadRegionWeeks(client, taxon.taxon_id, region.id);
          const effortByKey = new Map<string, number>();
          for (const cell of cellWeeks) {
            const key = `${String(cell.res)}\t${cell.cell}\t${String(cell.week)}`;
            if (effortByKey.has(key)) {
              continue;
            }
            const n = await loadEffort(
              client,
              taxon.effort_group,
              region.id,
              cell.res,
              cell.cell,
              cell.week,
            );
            effortByKey.set(key, n);
          }

          const rrRef = computeRrRefFromSamples(cellWeeks, regionWeeks, effortByKey);
          if (rrRef === null) {
            taxaSkipped += 1;
            await client.query(
              `DELETE FROM pub.taxon_score_ref WHERE taxon_id = $1 AND region_id = $2`,
              [taxon.taxon_id, region.id],
            );
            continue;
          }

          taxaProcessed += 1;
          await client.query(
            `
            INSERT INTO pub.taxon_score_ref (
              taxon_id, region_id, rr_ref, computed_at, scoring_version
            ) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (taxon_id, region_id) DO UPDATE
            SET rr_ref = EXCLUDED.rr_ref,
                computed_at = EXCLUDED.computed_at,
                scoring_version = EXCLUDED.scoring_version
            `,
            [taxon.taxon_id, region.id, rrRef, now, SCORING_V1.version],
          );
          refsWritten += 1;
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }

      return {
        regionId: region.id,
        regionSlug: region.slug,
        taxaProcessed,
        taxaSkipped,
        refsWritten,
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

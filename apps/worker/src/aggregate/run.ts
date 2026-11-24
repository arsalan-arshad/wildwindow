import { createPool } from '@wildwindow/db';
import {
  isOlderThanDelay,
  snapToCell,
  suppressAndMerge,
  TIER_POLICY,
  type CellCount,
  type Tier,
} from '@wildwindow/geoprivacy';
import { loadEnv } from '@wildwindow/shared';
import { getResolution } from 'h3-js';
import { z } from 'zod';

import { UNCERTAINTY_COARSE_MAX_M, UNCERTAINTY_RES7_MAX_M } from '../gbif/validate-row.js';

import { yearsCoveredForPublished } from './years-for-published.js';

import type { IngestRegion } from '../gbif/predicate.js';
import type { Pool, PoolClient } from 'pg';

const aggregateEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_WORKER: z.string().min(1).optional(),
});

const TIERS = new Set<string>(Object.keys(TIER_POLICY));

export type AggregateOptions = {
  readonly region: IngestRegion;
  readonly now?: Date;
  readonly env?: z.infer<typeof aggregateEnvSchema>;
  readonly pool?: Pool;
};

export type AggregateResult = {
  readonly regionId: number;
  readonly regionSlug: string;
  readonly taxaProcessed: number;
  readonly taxaSkippedNoForecast: number;
  readonly cellWeekRows: number;
  readonly regionWeekRows: number;
  readonly hourProfileRows: number;
};

type OccurrenceRow = {
  readonly taxon_id: number;
  readonly lat: number;
  readonly lng: number;
  readonly uncertainty_m: number | null;
  readonly event_date: string;
  readonly year: number;
  readonly week: number;
  readonly hour: number | null;
  readonly observer_hash: string;
};

type TaxonAgg = {
  readonly taxonId: number;
  readonly effortGroup: string;
  readonly tier: Tier;
};

type BucketState = {
  readonly counts: Map<string, CellCount>;
  readonly years: Map<string, Set<number>>;
  readonly hourCounts: Map<number, number>;
};

function parseTier(value: string): Tier {
  if (!TIERS.has(value)) {
    throw new Error(`unknown tier ${value}`);
  }
  return value as Tier;
}

function maxUncertaintyForTierRes(tierRes: number): number {
  return tierRes >= 7 ? UNCERTAINTY_RES7_MAX_M : UNCERTAINTY_COARSE_MAX_M;
}

function bucketKey(cell: string, week: number): string {
  return `${cell}\t${String(week)}`;
}

function emptyBucketState(): BucketState {
  return {
    counts: new Map(),
    years: new Map(),
    hourCounts: new Map(),
  };
}

function addOccurrence(
  state: BucketState,
  row: OccurrenceRow,
  tier: Tier,
  tierRes: number,
  now: Date,
): void {
  const eventDate = new Date(`${row.event_date}T00:00:00.000Z`);
  if (!isOlderThanDelay(eventDate, now, tier)) {
    return;
  }

  const uncertainty = row.uncertainty_m ?? UNCERTAINTY_RES7_MAX_M;
  if (uncertainty > maxUncertaintyForTierRes(tierRes)) {
    return;
  }

  const cell = snapToCell(row.lat, row.lng, tierRes);
  const key = bucketKey(cell, row.week);
  const existing = state.counts.get(key);
  if (existing === undefined) {
    state.counts.set(key, {
      cell,
      nRecords: 1,
      observers: new Set([row.observer_hash]),
    });
  } else {
    existing.nRecords += 1;
    existing.observers.add(row.observer_hash);
  }

  let years = state.years.get(cell);
  if (years === undefined) {
    years = new Set();
    state.years.set(cell, years);
  }
  years.add(row.year);

  if (row.hour !== null && row.hour >= 0 && row.hour <= 23) {
    state.hourCounts.set(row.hour, (state.hourCounts.get(row.hour) ?? 0) + 1);
  }
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

async function loadTaxaForRegion(client: PoolClient, regionId: number): Promise<TaxonAgg[]> {
  const result = await client.query<{
    taxon_id: number;
    effort_group: string;
    tier: string;
  }>(
    `
    SELECT tr.taxon_id, t.effort_group, tr.tier
    FROM ref.taxon_region tr
    JOIN ref.taxa t ON t.id = tr.taxon_id
    WHERE tr.region_id = $1
    ORDER BY tr.taxon_id
    `,
    [regionId],
  );
  return result.rows.map((row) => ({
    taxonId: row.taxon_id,
    effortGroup: row.effort_group,
    tier: parseTier(row.tier),
  }));
}

async function loadOccurrences(
  client: PoolClient,
  regionId: number,
  taxonId: number,
): Promise<OccurrenceRow[]> {
  const result = await client.query<OccurrenceRow>(
    `
    SELECT
      taxon_id,
      ST_Y(geom::geometry) AS lat,
      ST_X(geom::geometry) AS lng,
      uncertainty_m,
      event_date::text AS event_date,
      year,
      week,
      hour,
      observer_hash
    FROM raw.occurrences
    WHERE region_id = $1 AND taxon_id = $2
    `,
    [regionId, taxonId],
  );
  return result.rows;
}

async function loadEffortByWeek(
  client: PoolClient,
  regionId: number,
  effortGroup: string,
): Promise<Map<number, number>> {
  // Sum at res 7 only — load writes the same observations at res 7/5/4.
  const result = await client.query<{ week: number; n: string }>(
    `
    SELECT week, COALESCE(SUM(n_records), 0)::text AS n
    FROM pub.effort_cell_week
    WHERE region_id = $1 AND effort_group = $2 AND res = 7
    GROUP BY week
    `,
    [regionId, effortGroup],
  );
  const map = new Map<number, number>();
  for (const row of result.rows) {
    map.set(row.week, Number(row.n));
  }
  return map;
}

async function clearPublishedForRegion(client: PoolClient, regionId: number): Promise<void> {
  await client.query(`DELETE FROM pub.taxon_cell_week WHERE region_id = $1`, [regionId]);
  await client.query(`DELETE FROM pub.taxon_region_week WHERE region_id = $1`, [regionId]);
  await client.query(`DELETE FROM pub.taxon_hour_profile WHERE region_id = $1`, [regionId]);
}

async function insertCellWeeks(
  client: PoolClient,
  regionId: number,
  taxonId: number,
  week: number,
  published: readonly CellCount[],
  bucketYears: ReadonlyMap<string, ReadonlySet<number>>,
  now: Date,
): Promise<number> {
  let inserted = 0;
  for (const entry of published) {
    const res = getResolution(entry.cell);
    const yearsCovered = yearsCoveredForPublished(entry.cell, bucketYears);
    await client.query(
      `
      INSERT INTO pub.taxon_cell_week (
        taxon_id, region_id, res, cell, week, n_records, n_observers, years_covered, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        taxonId,
        regionId,
        res,
        entry.cell,
        week,
        entry.nRecords,
        entry.observers.size,
        yearsCovered,
        now,
      ],
    );
    inserted += 1;
  }
  return inserted;
}

/**
 * `aggregate --region` — rebuild pub taxon aggregates for one region in a transaction (§3.2 step 4).
 * Prefers `DATABASE_URL_WORKER` (ww_worker) when set.
 */
export async function runAggregate(options: AggregateOptions): Promise<AggregateResult> {
  const env = options.env ?? loadEnv(aggregateEnvSchema);
  const connectionString = env.DATABASE_URL_WORKER ?? env.DATABASE_URL;
  const ownedPool = options.pool === undefined;
  const pool = options.pool ?? createPool(connectionString);
  const now = options.now ?? new Date();

  try {
    const client = await pool.connect();
    try {
      const region = await loadRegion(client, options.region);
      const taxonList = await loadTaxaForRegion(client, region.id);

      let taxaProcessed = 0;
      let taxaSkippedNoForecast = 0;
      let cellWeekRows = 0;
      let regionWeekRows = 0;
      let hourProfileRows = 0;

      await client.query('BEGIN');
      try {
        await clearPublishedForRegion(client, region.id);

        for (const taxon of taxonList) {
          if (taxon.tier === 'no_forecast') {
            taxaSkippedNoForecast += 1;
            continue;
          }

          // After excluding no_forecast, resolution is always a concrete H3 res.
          const tierRes = TIER_POLICY[taxon.tier].resolution;

          taxaProcessed += 1;
          const rows = await loadOccurrences(client, region.id, taxon.taxonId);
          const state = emptyBucketState();
          for (const row of rows) {
            addOccurrence(state, row, taxon.tier, tierRes, now);
          }

          const byWeek = new Map<number, CellCount[]>();
          for (const [key, count] of state.counts) {
            const weekStr = key.split('\t')[1];
            if (weekStr === undefined) {
              continue;
            }
            const week = Number(weekStr);
            const list = byWeek.get(week) ?? [];
            list.push(count);
            byWeek.set(week, list);
          }

          const effortByWeek = await loadEffortByWeek(client, region.id, taxon.effortGroup);

          for (const [week, cells] of byWeek) {
            const published = suppressAndMerge(cells, taxon.tier);
            cellWeekRows += await insertCellWeeks(
              client,
              region.id,
              taxon.taxonId,
              week,
              published,
              state.years,
              now,
            );

            let nRecords = 0;
            for (const entry of published) {
              nRecords += entry.nRecords;
            }
            if (nRecords === 0) {
              continue;
            }
            const nEffort = effortByWeek.get(week) ?? 0;
            await client.query(
              `
              INSERT INTO pub.taxon_region_week (taxon_id, region_id, week, n_records, n_effort)
              VALUES ($1, $2, $3, $4, $5)
              `,
              [taxon.taxonId, region.id, week, nRecords, nEffort],
            );
            regionWeekRows += 1;
          }

          for (const [hour, nRecords] of state.hourCounts) {
            await client.query(
              `
              INSERT INTO pub.taxon_hour_profile (taxon_id, region_id, hour, n_records)
              VALUES ($1, $2, $3, $4)
              `,
              [taxon.taxonId, region.id, hour, nRecords],
            );
            hourProfileRows += 1;
          }
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
        taxaSkippedNoForecast,
        cellWeekRows,
        regionWeekRows,
        hourProfileRows,
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

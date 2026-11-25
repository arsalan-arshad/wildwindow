import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { createPool, ingestRuns, taxa } from '@wildwindow/db';
import { snapToCell } from '@wildwindow/geoprivacy';
import { loadEnv } from '@wildwindow/shared';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { from as copyFrom } from 'pg-copy-streams';
import { z } from 'zod';

import { effortGroupFromClass } from './effort-group-from-class.js';
import { INGEST_SOURCE_GBIF, INGEST_STATUS } from './ingest-status.js';
import { pointInRegionGeometry, type RegionGeometry } from './point-in-polygon.js';
import { iterateOccurrenceRows } from './stream-occurrence-tsv.js';
import { collectDatasetAttributions, upsertDatasets } from './upsert-datasets.js';
import {
  validateRow,
  type ValidatedOccurrence,
  type ValidateRejectReason,
} from './validate-row.js';

import type { Pool, PoolClient } from 'pg';

const loadEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_WORKER: z.string().min(1).optional(),
  OBSERVER_HASH_SALT: z.string().min(1),
});

export type GbifLoadOptions = {
  readonly runId: number;
  readonly zipPath: string;
  readonly now?: Date;
  readonly env?: z.infer<typeof loadEnvSchema>;
  readonly pool?: Pool;
};

export type GbifLoadResult = {
  readonly runId: number;
  readonly kind: string;
  readonly total: number;
  readonly loaded: number;
  readonly rejectedLicence: number;
  readonly rejectedCoords: number;
  readonly rejectedOther: number;
};

type TaxonInfo = { readonly id: number; readonly effortGroup: string };

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function occurrenceCopyLine(
  record: ValidatedOccurrence,
  taxonId: number,
  regionId: number,
  runId: number,
): string {
  const hour = record.hour === null ? '' : String(record.hour);
  const geomEwkt = `SRID=4326;POINT(${String(record.lng)} ${String(record.lat)})`;
  const cols = [
    INGEST_SOURCE_GBIF,
    record.sourceRecordId,
    String(taxonId),
    String(regionId),
    geomEwkt,
    String(record.uncertaintyM),
    record.eventDate,
    String(record.year),
    String(record.week),
    hour,
    record.license,
    record.datasetKey,
    record.observerHash,
    String(runId),
  ];
  return cols.map(csvEscape).join(',');
}

async function loadRegionGeometry(client: PoolClient, regionId: number): Promise<RegionGeometry> {
  const result = await client.query<{ geojson: string }>(
    `SELECT ST_AsGeoJSON(geom) AS geojson FROM ref.regions WHERE id = $1`,
    [regionId],
  );
  const row = result.rows[0];
  if (row === undefined) {
    throw new Error(`region id=${String(regionId)} not found`);
  }
  const parsed: unknown = JSON.parse(row.geojson);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('type' in parsed) ||
    (parsed.type !== 'Polygon' && parsed.type !== 'MultiPolygon')
  ) {
    throw new Error(`unexpected region geometry for id=${String(regionId)}`);
  }
  return parsed as RegionGeometry;
}

async function loadTaxonMap(db: ReturnType<typeof drizzle>): Promise<Map<number, TaxonInfo>> {
  const rows = await db
    .select({
      id: taxa.id,
      gbifTaxonKey: taxa.gbifTaxonKey,
      effortGroup: taxa.effortGroup,
    })
    .from(taxa);
  const map = new Map<number, TaxonInfo>();
  for (const row of rows) {
    map.set(row.gbifTaxonKey, { id: row.id, effortGroup: row.effortGroup });
  }
  return map;
}

function bumpReject(
  counters: {
    rejectedLicence: number;
    rejectedCoords: number;
    rejectedOther: number;
  },
  reason: ValidateRejectReason,
): void {
  switch (reason) {
    case 'licence':
      counters.rejectedLicence += 1;
      break;
    case 'coords':
      counters.rejectedCoords += 1;
      break;
    case 'date':
    case 'other':
      counters.rejectedOther += 1;
      break;
  }
}

async function copyTargetOccurrences(
  client: PoolClient,
  lines: readonly string[],
): Promise<number> {
  if (lines.length === 0) {
    return 0;
  }

  await client.query(`
    CREATE TEMP TABLE IF NOT EXISTS staging_occurrences (
      source text NOT NULL,
      source_record_id text NOT NULL,
      taxon_id integer NOT NULL,
      region_id integer NOT NULL,
      geom_ewkt text NOT NULL,
      uncertainty_m integer,
      event_date date NOT NULL,
      year integer NOT NULL,
      week smallint NOT NULL,
      hour smallint,
      license text NOT NULL,
      dataset_key text NOT NULL,
      observer_hash text NOT NULL,
      ingest_run_id integer
    ) ON COMMIT DROP
  `);
  await client.query(`TRUNCATE staging_occurrences`);

  const copyStream = client.query(
    copyFrom(`
      COPY staging_occurrences (
        source, source_record_id, taxon_id, region_id, geom_ewkt, uncertainty_m,
        event_date, year, week, hour, license, dataset_key, observer_hash, ingest_run_id
      ) FROM STDIN WITH (FORMAT csv, NULL '')
    `),
  );
  await pipeline(Readable.from(lines.map((l) => `${l}\n`)), copyStream);

  const inserted = await client.query<{ count: string }>(`
    WITH ins AS (
      INSERT INTO raw.occurrences (
        source, source_record_id, taxon_id, region_id, geom, uncertainty_m,
        event_date, year, week, hour, license, dataset_key, observer_hash, ingest_run_id
      )
      SELECT
        source, source_record_id, taxon_id, region_id,
        ST_GeomFromEWKT(geom_ewkt), uncertainty_m,
        event_date, year, week, hour, license, dataset_key, observer_hash, ingest_run_id
      FROM staging_occurrences
      ON CONFLICT (source, source_record_id) DO NOTHING
      RETURNING 1
    )
    SELECT COUNT(*)::text AS count FROM ins
  `);
  return Number(inserted.rows[0]?.count ?? 0);
}

async function upsertEffortCounts(
  client: PoolClient,
  regionId: number,
  counts: Map<string, number>,
): Promise<number> {
  let loaded = 0;
  for (const [key, n] of counts) {
    const [effortGroup, resStr, cell, weekStr] = key.split('\t');
    if (
      effortGroup === undefined ||
      resStr === undefined ||
      cell === undefined ||
      weekStr === undefined
    ) {
      continue;
    }
    await client.query(
      `
      INSERT INTO pub.effort_cell_week (effort_group, region_id, res, cell, week, n_records)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (effort_group, res, cell, week) DO UPDATE
      SET n_records = EXCLUDED.n_records,
          region_id = EXCLUDED.region_id
      `,
      [effortGroup, regionId, Number(resStr), cell, Number(weekStr), n],
    );
    loaded += n;
  }
  return loaded;
}

/**
 * `gbif:load` — stream a download zip/TSV, validate, COPY targets / upsert effort.
 * Prefers `DATABASE_URL_WORKER` (ww_worker) when set.
 */
export async function runGbifLoad(options: GbifLoadOptions): Promise<GbifLoadResult> {
  const env = options.env ?? loadEnv(loadEnvSchema);
  const connectionString = env.DATABASE_URL_WORKER ?? env.DATABASE_URL;
  const ownedPool = options.pool === undefined;
  const pool = options.pool ?? createPool(connectionString);
  const db = drizzle(pool);
  const now = options.now ?? new Date();

  const counters = {
    total: 0,
    loaded: 0,
    rejectedLicence: 0,
    rejectedCoords: 0,
    rejectedOther: 0,
  };

  try {
    const runRows = await db
      .select({
        id: ingestRuns.id,
        kind: ingestRuns.kind,
        regionId: ingestRuns.regionId,
        status: ingestRuns.status,
        doi: ingestRuns.doi,
      })
      .from(ingestRuns)
      .where(eq(ingestRuns.id, options.runId))
      .limit(1);
    const run = runRows[0];
    if (run === undefined) {
      throw new Error(`ingest_runs id=${String(options.runId)} not found`);
    }
    if (run.kind !== 'target' && run.kind !== 'effort') {
      throw new Error(`unsupported ingest kind ${run.kind}`);
    }

    const client = await pool.connect();
    try {
      const geometry = await loadRegionGeometry(client, run.regionId);
      const taxonMap = await loadTaxonMap(db);
      const isInsideRegion = (lat: number, lng: number): boolean =>
        pointInRegionGeometry(lat, lng, geometry);

      // Stream target COPY in chunks so multi-million GBIF zips do not OOM
      // (T3.9 Railway live ingest). Effort still aggregates in-memory.
      const copyFlushSize = 2000;
      const copyLines: string[] = [];
      const effortCounts = new Map<string, number>();
      /** First license per dataset key (avoid retaining one entry per occurrence). */
      const datasetLicenseByKey = new Map<string, string>();

      const flushCopyLines = async (): Promise<void> => {
        if (copyLines.length === 0) {
          return;
        }
        counters.loaded += await copyTargetOccurrences(client, copyLines);
        copyLines.length = 0;
      };

      await client.query('BEGIN');
      try {
        if (run.kind === 'effort') {
          await client.query(`DELETE FROM pub.effort_cell_week WHERE region_id = $1`, [
            run.regionId,
          ]);
        }

        for await (const row of iterateOccurrenceRows(options.zipPath)) {
          counters.total += 1;
          const result = validateRow(row, {
            observerHashSalt: env.OBSERVER_HASH_SALT,
            isInsideRegion,
          });
          if (!result.ok) {
            bumpReject(counters, result.reason);
            continue;
          }

          if (run.kind === 'target') {
            const taxon = taxonMap.get(result.record.taxonKey);
            if (taxon === undefined) {
              counters.rejectedOther += 1;
              continue;
            }
            copyLines.push(
              occurrenceCopyLine(result.record, taxon.id, run.regionId, options.runId),
            );
            if (!datasetLicenseByKey.has(result.record.datasetKey)) {
              datasetLicenseByKey.set(result.record.datasetKey, result.record.license);
            }
            if (copyLines.length >= copyFlushSize) {
              await flushCopyLines();
            }
          } else {
            const group =
              effortGroupFromClass(row['class']) ??
              taxonMap.get(result.record.taxonKey)?.effortGroup;
            if (group === undefined) {
              counters.rejectedOther += 1;
              continue;
            }
            const resolutions: readonly number[] =
              result.record.maxRes === 7 ? [7, 5, 4] : [5, 4];
            for (const res of resolutions) {
              const cell = snapToCell(result.record.lat, result.record.lng, res);
              const key = `${group}\t${String(res)}\t${cell}\t${String(result.record.week)}`;
              effortCounts.set(key, (effortCounts.get(key) ?? 0) + 1);
            }
          }
        }

        if (run.kind === 'target') {
          await flushCopyLines();
          const attributions = collectDatasetAttributions(
            [...datasetLicenseByKey.entries()].map(([datasetKey, license]) => ({
              datasetKey,
              license,
            })),
          );
          await upsertDatasets(client, attributions, run.doi);
        } else {
          counters.loaded += await upsertEffortCounts(client, run.regionId, effortCounts);
        }

        await client.query(
          `
          UPDATE app.ingest_runs SET
            status = $2,
            total = $3,
            loaded = $4,
            rejected_licence = $5,
            rejected_coords = $6,
            rejected_other = $7,
            finished_at = $8
          WHERE id = $1
          `,
          [
            options.runId,
            INGEST_STATUS.succeeded,
            counters.total,
            counters.loaded,
            counters.rejectedLicence,
            counters.rejectedCoords,
            counters.rejectedOther,
            now,
          ],
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    } finally {
      client.release();
    }

    return {
      runId: options.runId,
      kind: run.kind,
      total: counters.total,
      loaded: counters.loaded,
      rejectedLicence: counters.rejectedLicence,
      rejectedCoords: counters.rejectedCoords,
      rejectedOther: counters.rejectedOther,
    };
  } finally {
    if (ownedPool) {
      await pool.end();
    }
  }
}

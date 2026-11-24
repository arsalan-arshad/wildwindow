import {
  applyRoles,
  createPool,
  migrationsFolder,
  regions,
  runMigrations,
  taxa,
} from '@wildwindow/db';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { getResolution, latLngToCell } from 'h3-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runAggregate } from './run.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';

const API_PASSWORD = process.env['WW_API_DB_PASSWORD'] ?? 'ww_api_test_password';
const WORKER_PASSWORD = process.env['WW_WORKER_DB_PASSWORD'] ?? 'ww_worker_test_password';

const SCOTLAND_POLY = sql`ST_GeomFromText(
  'MULTIPOLYGON(((-5 55,-4 55,-4 56,-5 56,-5 55)))',
  4326
)`;

/** Centres of two res-5 siblings under the same res-4 parent (Scotland box). */
const CELL_A = { lat: 55.466122112322616, lng: -4.5344014230355665 };
const CELL_B = { lat: 55.33388198077053, lng: -4.6131954433335505 };
/** Far res-5 cell for delay exclusion / sparse suppress. */
const CELL_FAR = { lat: 55.87501066329877, lng: -4.043971649581735 };

const WEEK_DENSE = 25;
const WEEK_MERGE = 26;
const WEEK_SPARSE = 27;
const WEEK_YOUNG = 47;
const OLD_DATE = '2020-06-15';
const MERGE_DATE = '2019-06-24';
const SPARSE_DATE = '2018-07-02';
const YOUNG_DATE = '2026-11-20';
const NOW = new Date('2026-11-25T12:00:00.000Z');

function workerUrlFromOwner(ownerUrl: string, password: string): string {
  const url = new URL(ownerUrl);
  url.username = 'ww_worker';
  url.password = password;
  return url.toString();
}

function requireRow<T>(row: T | undefined, label: string): T {
  if (row === undefined) {
    throw new Error(`expected ${label}`);
  }
  return row;
}

async function resolveTaxonId(
  ownerDb: ReturnType<typeof drizzle>,
  gbifTaxonKey: number,
  values: {
    scientificName: string;
    commonNames: { en: string };
    group: string;
    effortGroup: string;
  },
): Promise<number> {
  const inserted = await ownerDb
    .insert(taxa)
    .values({
      gbifTaxonKey,
      scientificName: values.scientificName,
      commonNames: values.commonNames,
      group: values.group,
      effortGroup: values.effortGroup,
    })
    .onConflictDoNothing()
    .returning({ id: taxa.id });
  if (inserted[0] !== undefined) {
    return inserted[0].id;
  }
  const row = await ownerDb
    .select({ id: taxa.id })
    .from(taxa)
    .where(eq(taxa.gbifTaxonKey, gbifTaxonKey))
    .limit(1);
  return requireRow(row[0], `taxon ${String(gbifTaxonKey)}`).id;
}

describe('T3.6 aggregate', () => {
  const ownerPool = createPool(DATABASE_URL);
  const ownerDb = drizzle(ownerPool);
  let workerPool = createPool(DATABASE_URL);
  let regionId = 0;
  let protectedTaxonId = 0;
  let noForecastTaxonId = 0;
  const suffix = `t36-${String(Date.now())}`;

  beforeAll(async () => {
    await runMigrations(DATABASE_URL, migrationsFolder());
    await applyRoles(DATABASE_URL, {
      apiPassword: API_PASSWORD,
      workerPassword: WORKER_PASSWORD,
    });

    const resolvedWorkerUrl =
      process.env['DATABASE_URL_WORKER'] ?? workerUrlFromOwner(DATABASE_URL, WORKER_PASSWORD);
    await workerPool.end();
    workerPool = createPool(resolvedWorkerUrl);

    const existing = await ownerDb
      .select({ id: regions.id })
      .from(regions)
      .where(eq(regions.slug, 'scotland'))
      .limit(1);
    if (existing[0] === undefined) {
      const inserted = await ownerDb
        .insert(regions)
        .values({
          slug: 'scotland',
          name: 'Scotland',
          countryCode: 'GB',
          timeZone: 'Europe/London',
          geom: SCOTLAND_POLY,
          minRes: 3,
        })
        .returning({ id: regions.id });
      regionId = requireRow(inserted[0], 'region').id;
    } else {
      regionId = existing[0].id;
    }

    protectedTaxonId = await resolveTaxonId(ownerDb, 91_000_001, {
      scientificName: `Lutra lutra ${suffix}`,
      commonNames: { en: 'Eurasian otter' },
      group: 'mammal',
      effortGroup: 'Mammalia',
    });
    noForecastTaxonId = await resolveTaxonId(ownerDb, 91_000_002, {
      scientificName: `Tetrao urogallus ${suffix}`,
      commonNames: { en: 'Capercaillie' },
      group: 'bird',
      effortGroup: 'Aves',
    });

    await ownerPool.query(
      `
      INSERT INTO ref.taxon_region (taxon_id, region_id, tier, lockout_months)
      VALUES
        ($1, $3, 'protected', '{}'::int[]),
        ($2, $3, 'no_forecast', '{}'::int[])
      ON CONFLICT (taxon_id, region_id) DO UPDATE
      SET tier = EXCLUDED.tier, lockout_months = EXCLUDED.lockout_months
      `,
      [protectedTaxonId, noForecastTaxonId, regionId],
    );

    await ownerPool.query(
      `DELETE FROM raw.occurrences WHERE region_id = $1 AND taxon_id = ANY($2::int[])`,
      [regionId, [protectedTaxonId, noForecastTaxonId]],
    );
    await ownerPool.query(
      `DELETE FROM pub.taxon_cell_week WHERE region_id = $1 AND taxon_id = ANY($2::int[])`,
      [regionId, [protectedTaxonId, noForecastTaxonId]],
    );
    await ownerPool.query(
      `DELETE FROM pub.taxon_region_week WHERE region_id = $1 AND taxon_id = ANY($2::int[])`,
      [regionId, [protectedTaxonId, noForecastTaxonId]],
    );
    await ownerPool.query(
      `DELETE FROM pub.taxon_hour_profile WHERE region_id = $1 AND taxon_id = ANY($2::int[])`,
      [regionId, [protectedTaxonId, noForecastTaxonId]],
    );

    const inserts: Array<{
      sourceRecordId: string;
      taxonId: number;
      lat: number;
      lng: number;
      eventDate: string;
      year: number;
      week: number;
      hour: number | null;
      observerHash: string;
    }> = [];

    // Dense res-5 cell A: 12 records / 6 observers → publishes at res 5.
    for (let i = 0; i < 12; i += 1) {
      inserts.push({
        sourceRecordId: `${suffix}-dense-${String(i)}`,
        taxonId: protectedTaxonId,
        lat: CELL_A.lat + i * 1e-5,
        lng: CELL_A.lng + i * 1e-5,
        eventDate: OLD_DATE,
        year: 2020,
        week: WEEK_DENSE,
        hour: 10,
        observerHash: `obs-dense-${String(i % 6)}`,
      });
    }

    // Sparse sibling pair (6+6 / 3+3 observers) → merge to res 4.
    for (let i = 0; i < 6; i += 1) {
      inserts.push({
        sourceRecordId: `${suffix}-merge-a-${String(i)}`,
        taxonId: protectedTaxonId,
        lat: CELL_A.lat + i * 1e-5,
        lng: CELL_A.lng + i * 1e-5,
        eventDate: MERGE_DATE,
        year: 2019,
        week: WEEK_MERGE,
        hour: 11,
        observerHash: `obs-merge-a-${String(i % 3)}`,
      });
      inserts.push({
        sourceRecordId: `${suffix}-merge-b-${String(i)}`,
        taxonId: protectedTaxonId,
        lat: CELL_B.lat + i * 1e-5,
        lng: CELL_B.lng + i * 1e-5,
        eventDate: MERGE_DATE,
        year: 2019,
        week: WEEK_MERGE,
        hour: null,
        observerHash: `obs-merge-b-${String(i % 3)}`,
      });
    }

    // Lone under-minimum cell → fully suppressed.
    for (let i = 0; i < 3; i += 1) {
      inserts.push({
        sourceRecordId: `${suffix}-sparse-${String(i)}`,
        taxonId: protectedTaxonId,
        lat: CELL_FAR.lat + i * 1e-5,
        lng: CELL_FAR.lng + i * 1e-5,
        eventDate: SPARSE_DATE,
        year: 2018,
        week: WEEK_SPARSE,
        hour: null,
        observerHash: `obs-sparse-${String(i)}`,
      });
    }

    // Young records (within protected delayDays=30) — must not publish.
    for (let i = 0; i < 20; i += 1) {
      inserts.push({
        sourceRecordId: `${suffix}-young-${String(i)}`,
        taxonId: protectedTaxonId,
        lat: CELL_FAR.lat + 0.01 + i * 1e-5,
        lng: CELL_FAR.lng + 0.01 + i * 1e-5,
        eventDate: YOUNG_DATE,
        year: 2026,
        week: WEEK_YOUNG,
        hour: 9,
        observerHash: `obs-young-${String(i)}`,
      });
    }

    // no_forecast taxon: plenty of old rows — still no pub output.
    for (let i = 0; i < 30; i += 1) {
      inserts.push({
        sourceRecordId: `${suffix}-nf-${String(i)}`,
        taxonId: noForecastTaxonId,
        lat: CELL_A.lat + i * 1e-5,
        lng: CELL_A.lng + i * 1e-5,
        eventDate: OLD_DATE,
        year: 2020,
        week: WEEK_DENSE,
        hour: 8,
        observerHash: `obs-nf-${String(i)}`,
      });
    }

    for (const row of inserts) {
      await ownerPool.query(
        `
        INSERT INTO raw.occurrences (
          source, source_record_id, taxon_id, region_id, geom, uncertainty_m,
          event_date, year, week, hour, license, dataset_key, observer_hash
        ) VALUES (
          'gbif', $1, $2, $3,
          ST_SetSRID(ST_MakePoint($4, $5), 4326),
          50, $6::date, $7, $8, $9, 'CC0_1_0', 'ds-t36', $10
        )
        `,
        [
          row.sourceRecordId,
          row.taxonId,
          regionId,
          row.lng,
          row.lat,
          row.eventDate,
          row.year,
          row.week,
          row.hour,
          row.observerHash,
        ],
      );
    }

    const effortCell = latLngToCell(CELL_A.lat, CELL_A.lng, 7);
    await ownerPool.query(
      `
      INSERT INTO pub.effort_cell_week (effort_group, region_id, res, cell, week, n_records)
      VALUES ('Mammalia', $1, 7, $2, $3, 100)
      ON CONFLICT (effort_group, res, cell, week) DO UPDATE
      SET n_records = EXCLUDED.n_records, region_id = EXCLUDED.region_id
      `,
      [regionId, effortCell, WEEK_DENSE],
    );
  }, 120_000);

  afterAll(async () => {
    await workerPool.end();
    await ownerPool.end();
  });

  it('applies delay, suppress/merge, res≤5 for protected, and skips no_forecast', async () => {
    const env = {
      DATABASE_URL,
      DATABASE_URL_WORKER:
        process.env['DATABASE_URL_WORKER'] ?? workerUrlFromOwner(DATABASE_URL, WORKER_PASSWORD),
    };

    const result = await runAggregate({
      region: 'scotland',
      pool: workerPool,
      env,
      now: NOW,
    });

    expect(result.taxaSkippedNoForecast).toBeGreaterThanOrEqual(1);

    const cellRows = await ownerPool.query<{
      taxon_id: number;
      res: number;
      cell: string;
      week: number;
      n_records: number;
      n_observers: number;
    }>(
      `SELECT taxon_id, res, cell, week, n_records, n_observers
       FROM pub.taxon_cell_week
       WHERE region_id = $1 AND taxon_id = ANY($2::int[])
       ORDER BY week, res, cell`,
      [regionId, [protectedTaxonId, noForecastTaxonId]],
    );

    expect(cellRows.rows.every((row) => row.taxon_id === protectedTaxonId)).toBe(true);
    expect(cellRows.rows.every((row) => row.res <= 5)).toBe(true);
    expect(cellRows.rows.every((row) => getResolution(row.cell) === row.res)).toBe(true);

    expect(cellRows.rows.some((row) => row.week === WEEK_YOUNG)).toBe(false);
    expect(cellRows.rows.some((row) => row.week === WEEK_SPARSE)).toBe(false);

    const weekDense = cellRows.rows.filter((row) => row.week === WEEK_DENSE);
    expect(weekDense.length).toBeGreaterThanOrEqual(1);
    expect(weekDense.some((row) => row.res === 5)).toBe(true);

    const weekMerge = cellRows.rows.filter((row) => row.week === WEEK_MERGE);
    expect(weekMerge.length).toBeGreaterThanOrEqual(1);
    const weekMergeRecords = weekMerge.reduce((sum, row) => sum + row.n_records, 0);
    expect(weekMergeRecords).toBe(12);
    // Sibling buckets that fail alone should publish coarser than tier res 5.
    expect(weekMerge.some((row) => row.res < 5)).toBe(true);

    const nfCells = await ownerPool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM pub.taxon_cell_week WHERE taxon_id = $1`,
      [noForecastTaxonId],
    );
    expect(Number(nfCells.rows[0]?.n)).toBe(0);

    const nfRegion = await ownerPool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM pub.taxon_region_week WHERE taxon_id = $1`,
      [noForecastTaxonId],
    );
    expect(Number(nfRegion.rows[0]?.n)).toBe(0);

    const nfHour = await ownerPool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM pub.taxon_hour_profile WHERE taxon_id = $1`,
      [noForecastTaxonId],
    );
    expect(Number(nfHour.rows[0]?.n)).toBe(0);

    const hourRows = await ownerPool.query<{ hour: number; n_records: number }>(
      `SELECT hour, n_records FROM pub.taxon_hour_profile WHERE taxon_id = $1 ORDER BY hour`,
      [protectedTaxonId],
    );
    expect(hourRows.rows.some((row) => row.hour === 10 && row.n_records >= 12)).toBe(true);
    expect(hourRows.rows.some((row) => row.hour === 9)).toBe(false);

    const regionWeek = await ownerPool.query<{ week: number; n_records: number; n_effort: number }>(
      `SELECT week, n_records, n_effort FROM pub.taxon_region_week
       WHERE taxon_id = $1 AND region_id = $2 ORDER BY week`,
      [protectedTaxonId, regionId],
    );
    const rwDense = regionWeek.rows.find((row) => row.week === WEEK_DENSE);
    expect(rwDense?.n_effort).toBe(100);
    expect((rwDense?.n_records ?? 0) > 0).toBe(true);
  }, 120_000);
});

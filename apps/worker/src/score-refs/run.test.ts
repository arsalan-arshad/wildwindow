import {
  applyRoles,
  createPool,
  migrationsFolder,
  regions,
  runMigrations,
  taxa,
} from '@wildwindow/db';
import { p95, reportingRate, SCORING_V1 } from '@wildwindow/scoring';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runScoreRefs } from './run.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';

const API_PASSWORD = process.env['WW_API_DB_PASSWORD'] ?? 'ww_api_test_password';
const WORKER_PASSWORD = process.env['WW_WORKER_DB_PASSWORD'] ?? 'ww_worker_test_password';

const SCOTLAND_POLY = sql`ST_GeomFromText(
  'MULTIPOLYGON(((-5 55,-4 55,-4 56,-5 56,-5 55)))',
  4326
)`;

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

describe('T3.7 score:refs', () => {
  const ownerPool = createPool(DATABASE_URL);
  const ownerDb = drizzle(ownerPool);
  let workerPool = createPool(DATABASE_URL);
  let regionId = 0;
  let taxonId = 0;
  const cellA = '8519545bfffffff';
  const cellB = '8519544bfffffff';
  const week = 25;

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

    const insertedTaxon = await ownerDb
      .insert(taxa)
      .values({
        gbifTaxonKey: 91_000_101,
        scientificName: 'Alcedo atthis score-refs',
        commonNames: { en: 'Common kingfisher' },
        group: 'bird',
        effortGroup: 'Aves',
      })
      .onConflictDoNothing()
      .returning({ id: taxa.id });
    if (insertedTaxon[0] !== undefined) {
      taxonId = insertedTaxon[0].id;
    } else {
      const row = await ownerDb
        .select({ id: taxa.id })
        .from(taxa)
        .where(eq(taxa.gbifTaxonKey, 91_000_101))
        .limit(1);
      taxonId = requireRow(row[0], 'taxon').id;
    }

    await ownerPool.query(
      `
      INSERT INTO ref.taxon_region (taxon_id, region_id, tier, lockout_months)
      VALUES ($1, $2, 'open', '{}'::int[])
      ON CONFLICT (taxon_id, region_id) DO UPDATE SET tier = EXCLUDED.tier
      `,
      [taxonId, regionId],
    );

    await ownerPool.query(
      `DELETE FROM pub.taxon_cell_week WHERE taxon_id = $1 AND region_id = $2`,
      [taxonId, regionId],
    );
    await ownerPool.query(
      `DELETE FROM pub.taxon_region_week WHERE taxon_id = $1 AND region_id = $2`,
      [taxonId, regionId],
    );
    await ownerPool.query(
      `DELETE FROM pub.taxon_score_ref WHERE taxon_id = $1 AND region_id = $2`,
      [taxonId, regionId],
    );
    await ownerPool.query(
      `DELETE FROM pub.effort_cell_week WHERE region_id = $1 AND effort_group = 'Aves'`,
      [regionId],
    );

    // Two published cells in week 25 — §4.6-style counts for cell A.
    await ownerPool.query(
      `
      INSERT INTO pub.taxon_cell_week (
        taxon_id, region_id, res, cell, week, n_records, n_observers, years_covered
      ) VALUES
        ($1, $2, 7, $3, $4, 42, 10, 3),
        ($1, $2, 7, $5, $4, 10, 5, 2)
      `,
      [taxonId, regionId, cellA, week, cellB],
    );

    await ownerPool.query(
      `
      INSERT INTO pub.taxon_region_week (taxon_id, region_id, week, n_records, n_effort)
      VALUES ($1, $2, $3, 52, 4000)
      `,
      [taxonId, regionId, week],
    );

    await ownerPool.query(
      `
      INSERT INTO pub.effort_cell_week (effort_group, region_id, res, cell, week, n_records)
      VALUES
        ('Aves', $1, 7, $2, $3, 3100),
        ('Aves', $1, 7, $4, $3, 800)
      `,
      [regionId, cellA, week, cellB],
    );
  }, 120_000);

  afterAll(async () => {
    await workerPool.end();
    await ownerPool.end();
  });

  it('writes the expected rr_ref (P95 of reportingRate samples)', async () => {
    const env = {
      DATABASE_URL,
      DATABASE_URL_WORKER:
        process.env['DATABASE_URL_WORKER'] ?? workerUrlFromOwner(DATABASE_URL, WORKER_PASSWORD),
    };

    const result = await runScoreRefs({
      region: 'scotland',
      pool: workerPool,
      env,
      now: new Date('2026-11-25T12:00:00.000Z'),
    });

    expect(result.refsWritten).toBeGreaterThanOrEqual(1);

    // W±1 only has week 25 populated → regionRate = 52/4000
    const regionRate = 52 / 4000;
    const rates = [
      reportingRate({ nSpecies: 42, nEffort: 3100, regionRate }),
      reportingRate({ nSpecies: 10, nEffort: 800, regionRate }),
    ];
    const expected = p95(rates);

    const row = await ownerPool.query<{
      rr_ref: number;
      scoring_version: string;
    }>(
      `SELECT rr_ref, scoring_version FROM pub.taxon_score_ref
       WHERE taxon_id = $1 AND region_id = $2`,
      [taxonId, regionId],
    );
    expect(row.rows[0]?.scoring_version).toBe(SCORING_V1.version);
    expect(row.rows[0]?.rr_ref).toBeCloseTo(expected, 10);
  }, 60_000);
});

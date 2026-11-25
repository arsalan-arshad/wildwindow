import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  applyRoles,
  createPool,
  migrationsFolder,
  regions,
  runMigrations,
  taxa,
} from '@wildwindow/db';
import { snapToCell } from '@wildwindow/geoprivacy';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runBacktest } from './run.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';

const API_PASSWORD = process.env['WW_API_DB_PASSWORD'] ?? 'ww_api_test_password';
const WORKER_PASSWORD = process.env['WW_WORKER_DB_PASSWORD'] ?? 'ww_worker_test_password';

const SCOTLAND_POLY = sql`ST_GeomFromText(
  'MULTIPOLYGON(((-5 55,-4 55,-4 56,-5 56,-5 55)))',
  4326
)`;

/** Centre inside the Scotland test box (open / res-7). */
const CELL_LAT = 55.466122112322616;
const CELL_LNG = -4.5344014230355665;
const HOLDOUT = 2023;
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

describe('T4.9 backtest', () => {
  const ownerPool = createPool(DATABASE_URL);
  const ownerDb = drizzle(ownerPool);
  let workerPool = createPool(DATABASE_URL);
  let regionId = 0;
  let passTaxonId = 0;
  let skipTaxonId = 0;
  let cellR7 = '';
  const suffix = `t49-${String(Date.now())}`;
  let tmpDir = '';

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ww-backtest-'));
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

    cellR7 = snapToCell(CELL_LAT, CELL_LNG, 7);

    const passInserted = await ownerDb
      .insert(taxa)
      .values({
        gbifTaxonKey: 91_000_201,
        scientificName: `Alcedo atthis ${suffix}`,
        commonNames: { en: 'Common kingfisher' },
        group: 'bird',
        effortGroup: 'Aves',
      })
      .onConflictDoNothing()
      .returning({ id: taxa.id });
    if (passInserted[0] !== undefined) {
      passTaxonId = passInserted[0].id;
    } else {
      const row = await ownerDb
        .select({ id: taxa.id })
        .from(taxa)
        .where(eq(taxa.gbifTaxonKey, 91_000_201))
        .limit(1);
      passTaxonId = requireRow(row[0], 'pass taxon').id;
    }

    const skipInserted = await ownerDb
      .insert(taxa)
      .values({
        gbifTaxonKey: 91_000_202,
        scientificName: `Tetrao urogallus ${suffix}`,
        commonNames: { en: 'Capercaillie' },
        group: 'bird',
        effortGroup: 'Aves',
      })
      .onConflictDoNothing()
      .returning({ id: taxa.id });
    if (skipInserted[0] !== undefined) {
      skipTaxonId = skipInserted[0].id;
    } else {
      const row = await ownerDb
        .select({ id: taxa.id })
        .from(taxa)
        .where(eq(taxa.gbifTaxonKey, 91_000_202))
        .limit(1);
      skipTaxonId = requireRow(row[0], 'skip taxon').id;
    }

    await ownerPool.query(
      `
      INSERT INTO ref.taxon_region (taxon_id, region_id, tier, lockout_months)
      VALUES
        ($1, $3, 'open', '{}'::int[]),
        ($2, $3, 'no_forecast', '{}'::int[])
      ON CONFLICT (taxon_id, region_id) DO UPDATE
      SET tier = EXCLUDED.tier, lockout_months = EXCLUDED.lockout_months
      `,
      [passTaxonId, skipTaxonId, regionId],
    );

    await ownerPool.query(`DELETE FROM raw.occurrences WHERE taxon_id = ANY($1::int[])`, [
      [passTaxonId, skipTaxonId],
    ]);
    await ownerPool.query(`DELETE FROM pub.taxon_cell_week WHERE taxon_id = ANY($1::int[])`, [
      [passTaxonId, skipTaxonId],
    ]);
    await ownerPool.query(`DELETE FROM pub.taxon_score_ref WHERE taxon_id = ANY($1::int[])`, [
      [passTaxonId, skipTaxonId],
    ]);
    await ownerPool.query(
      `DELETE FROM pub.effort_cell_week WHERE region_id = $1 AND effort_group = 'Aves' AND cell = $2`,
      [regionId, cellR7],
    );

    // Published open cell at res 7.
    await ownerPool.query(
      `
      INSERT INTO pub.taxon_cell_week (
        taxon_id, region_id, res, cell, week, n_records, n_observers, years_covered, updated_at
      ) VALUES ($1, $2, 7, $3, 10, 50, 10, 5, $4)
      `,
      [passTaxonId, regionId, cellR7, NOW],
    );

    await ownerPool.query(
      `
      INSERT INTO pub.taxon_score_ref (taxon_id, region_id, rr_ref, computed_at, scoring_version)
      VALUES ($1, $2, 0.2, $3, '1.0')
      ON CONFLICT (taxon_id, region_id) DO UPDATE
      SET rr_ref = EXCLUDED.rr_ref
      `,
      [passTaxonId, regionId, NOW],
    );

    // Uniform effort across high and low weeks so RR tracks species counts.
    const effortWeeks = [
      5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41,
      42,
    ];
    for (const week of effortWeeks) {
      await ownerPool.query(
        `
        INSERT INTO pub.effort_cell_week (effort_group, region_id, res, cell, week, n_records)
        VALUES ('Aves', $1, 7, $2, $3, 120)
        ON CONFLICT (effort_group, res, cell, week) DO UPDATE
        SET n_records = EXCLUDED.n_records
        `,
        [regionId, cellR7, week],
      );
    }

    const highWeeks = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
    const lowWeeks = [30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42];
    const valueRows: string[] = [];
    let seq = 0;

    function pushOcc(year: number, week: number, n: number): void {
      for (let i = 0; i < n; i += 1) {
        seq += 1;
        const lat = CELL_LAT + i * 1e-5;
        const lng = CELL_LNG + i * 1e-5;
        valueRows.push(
          `('gbif', '${suffix}-${String(seq)}', ${String(passTaxonId)}, ${String(regionId)}, ST_SetSRID(ST_MakePoint(${String(lng)}, ${String(lat)}), 4326), 100, '${String(year)}-06-15', ${String(year)}, ${String(week)}, 10, 'CC0_1_0', 'dataset-fixture', 'obs-${String(i % 8)}')`,
        );
      }
    }

    // Training years 2018–2022: high weeks busy, low weeks quiet.
    for (const year of [2018, 2019, 2020, 2021, 2022]) {
      for (const week of highWeeks) {
        pushOcc(year, week, 6);
      }
      for (const week of lowWeeks) {
        pushOcc(year, week, 1);
      }
    }
    // Holdout 2023 keeps the same seasonality.
    for (const week of highWeeks) {
      pushOcc(HOLDOUT, week, 8);
    }
    for (const week of lowWeeks) {
      pushOcc(HOLDOUT, week, 1);
    }

    await ownerPool.query(
      `
      INSERT INTO raw.occurrences (
        source, source_record_id, taxon_id, region_id, geom, uncertainty_m,
        event_date, year, week, hour, license, dataset_key, observer_hash
      ) VALUES ${valueRows.join(',\n')}
      `,
    );
  }, 120_000);

  afterAll(async () => {
    await workerPool.end();
    await ownerPool.end();
    if (tmpDir.length > 0) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('writes reports/backtest-<region>-<year>.md with a summary table on fixture data', async () => {
    const outPath = join(tmpDir, `backtest-scotland-${String(HOLDOUT)}.md`);
    const result = await runBacktest({
      region: 'scotland',
      holdoutYear: HOLDOUT,
      outPath,
      now: NOW,
      pool: workerPool,
      env: {
        DATABASE_URL,
        DATABASE_URL_WORKER:
          process.env['DATABASE_URL_WORKER'] ?? workerUrlFromOwner(DATABASE_URL, WORKER_PASSWORD),
      },
    });

    expect(result.outPath).toBe(outPath);
    expect(result.passed).toBeGreaterThanOrEqual(1);
    expect(result.skipped).toBeGreaterThanOrEqual(1);

    const passRow = result.speciesResults.find((r) => r.taxonId === passTaxonId);
    expect(passRow?.status).toBe('pass');

    const skipRow = result.speciesResults.find((r) => r.taxonId === skipTaxonId);
    expect(skipRow?.status).toBe('skipped');

    const md = await readFile(outPath, 'utf8');
    expect(md).toContain(`# Backtest: scotland holdout ${String(HOLDOUT)}`);
    expect(md).toContain('## Summary');
    expect(md).toContain('| Pass |');
    expect(md).toContain('## Per species');
    expect(md).toContain('Common kingfisher');
  });
});

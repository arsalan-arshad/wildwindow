import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  applyRoles,
  createPool,
  ingestRuns,
  migrationsFolder,
  regions,
  runMigrations,
  taxa,
} from '@wildwindow/db';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { INGEST_SOURCE_GBIF, INGEST_STATUS } from './ingest-status.js';
import { runGbifLoad } from './load.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';

const API_PASSWORD = process.env['WW_API_DB_PASSWORD'] ?? 'ww_api_test_password';
const WORKER_PASSWORD = process.env['WW_WORKER_DB_PASSWORD'] ?? 'ww_worker_test_password';

const SCOTLAND_POLY = sql`ST_GeomFromText(
  'MULTIPOLYGON(((-5 55,-4 55,-4 56,-5 56,-5 55)))',
  4326
)`;

const TAXON_KEY = 2_475_532;
const ROW_COUNT = 10_000;

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

function buildTsv(count: number): string {
  const header =
    'gbifID\ttaxonKey\tdecimalLatitude\tdecimalLongitude\tcoordinateUncertaintyInMeters\teventDate\tlicense\tdatasetKey\trecordedBy\tclass';
  const lines = [header];
  for (let i = 0; i < count; i += 1) {
    const lat = 55.1 + (i % 80) * 0.01;
    const lng = -4.9 + (i % 80) * 0.01;
    lines.push(
      [
        String(10_000_000 + i),
        String(TAXON_KEY),
        lat.toFixed(5),
        lng.toFixed(5),
        '50',
        '2020-06-15T10:00:00',
        'CC0_1_0',
        'ds-fixture',
        `Observer ${String(i)}`,
        'Aves',
      ].join('\t'),
    );
  }
  return `${lines.join('\n')}\n`;
}

describe('T3.5 gbif:load streaming', () => {
  const ownerPool = createPool(DATABASE_URL);
  const ownerDb = drizzle(ownerPool);
  let workDir = '';
  let zipPath = '';
  let regionId = 0;
  let runId = 0;
  let workerPool = createPool(DATABASE_URL);

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

    const taxonExisting = await ownerDb
      .select({ id: taxa.id })
      .from(taxa)
      .where(eq(taxa.gbifTaxonKey, TAXON_KEY))
      .limit(1);
    if (taxonExisting[0] === undefined) {
      await ownerDb.insert(taxa).values({
        gbifTaxonKey: TAXON_KEY,
        scientificName: 'Alcedo atthis',
        commonNames: { en: 'Common kingfisher' },
        group: 'bird',
        effortGroup: 'Aves',
      });
    }

    const run = await ownerDb
      .insert(ingestRuns)
      .values({
        source: INGEST_SOURCE_GBIF,
        regionId,
        kind: 'target',
        gbifDownloadKey: 'fixture-load-key',
        status: INGEST_STATUS.requested,
        startedAt: new Date('2026-11-24T12:00:00.000Z'),
      })
      .returning({ id: ingestRuns.id });
    runId = requireRow(run[0], 'run').id;

    workDir = await mkdtemp(path.join(tmpdir(), 'ww-t35-'));
    // GBIF SIMPLE_CSV uses a .csv extension (tab-delimited). Zip entry must
    // end in .csv/.tsv so openOccurrenceTsvStream finds it.
    const tsvPath = path.join(workDir, 'occurrence.csv');
    await writeFile(tsvPath, buildTsv(ROW_COUNT), 'utf8');
    zipPath = path.join(workDir, 'occurrence.zip');
    execFileSync('zip', ['-j', zipPath, tsvPath], { stdio: 'ignore' });
  }, 120_000);

  afterAll(async () => {
    if (workDir.length > 0) {
      await rm(workDir, { recursive: true, force: true });
    }
    await workerPool.end();
    await ownerPool.end();
  });

  it('loads 10k rows under 30s, matches counters, and dedupes on re-run', async () => {
    const env = {
      DATABASE_URL,
      DATABASE_URL_WORKER:
        process.env['DATABASE_URL_WORKER'] ?? workerUrlFromOwner(DATABASE_URL, WORKER_PASSWORD),
      OBSERVER_HASH_SALT: process.env['OBSERVER_HASH_SALT'] ?? 'test-salt',
    };

    const started = Date.now();
    const first = await runGbifLoad({
      runId,
      zipPath,
      pool: workerPool,
      env,
      now: new Date('2026-11-24T12:10:00.000Z'),
    });
    const elapsedMs = Date.now() - started;

    expect(elapsedMs).toBeLessThan(30_000);
    expect(first.total).toBe(ROW_COUNT);
    expect(first.loaded).toBe(ROW_COUNT);
    expect(first.rejectedLicence).toBe(0);
    expect(first.rejectedCoords).toBe(0);
    expect(first.rejectedOther).toBe(0);

    const countAfterFirst = await ownerPool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM raw.occurrences WHERE ingest_run_id = $1`,
      [runId],
    );
    expect(Number(countAfterFirst.rows[0]?.count)).toBe(ROW_COUNT);

    const second = await runGbifLoad({
      runId,
      zipPath,
      pool: workerPool,
      env,
      now: new Date('2026-11-24T12:20:00.000Z'),
    });
    expect(second.total).toBe(ROW_COUNT);
    expect(second.loaded).toBe(0);

    const countAfterSecond = await ownerPool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM raw.occurrences WHERE ingest_run_id = $1`,
      [runId],
    );
    expect(Number(countAfterSecond.rows[0]?.count)).toBe(ROW_COUNT);
  }, 120_000);
});

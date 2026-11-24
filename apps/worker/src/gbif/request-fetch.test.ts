import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createDb, ingestRuns, migrationsFolder, regions, runMigrations } from '@wildwindow/db';
import { eq, sql } from 'drizzle-orm';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createGbifClient } from './client.js';
import { runGbifFetch } from './fetch.js';
import { INGEST_STATUS } from './ingest-status.js';
import { runGbifRequest } from './request.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';

const BASE = 'http://gbif.test';
const DOWNLOAD_KEY = '0009999-test-download';
const DOI = '10.15468/dl.testdoi';

const SCOTLAND_POLY = sql`ST_GeomFromText(
  'MULTIPOLYGON(((-5 55,-4 55,-4 56,-5 56,-5 55)))',
  4326
)`;

const server = setupServer();

const env = {
  DATABASE_URL,
  GBIF_USER: 'ww-test',
  GBIF_PASSWORD: 'secret',
  GBIF_EMAIL: 'ww@example.com',
};

function requireRow<T>(row: T | undefined, label: string): T {
  if (row === undefined) {
    throw new Error(`expected ${label}`);
  }
  return row;
}

describe('T3.3 gbif:request + gbif:fetch (mocked GBIF)', () => {
  const { db, pool } = createDb({ connectionString: DATABASE_URL });
  let workDir = '';
  let betaPath = '';
  let downloadDir = '';

  beforeAll(async () => {
    await runMigrations(DATABASE_URL, migrationsFolder());
    server.listen({ onUnhandledRequest: 'error' });

    const existing = await db
      .select({ id: regions.id })
      .from(regions)
      .where(eq(regions.slug, 'scotland'))
      .limit(1);
    if (existing[0] === undefined) {
      await db.insert(regions).values({
        slug: 'scotland',
        name: 'Scotland',
        countryCode: 'GB',
        timeZone: 'Europe/London',
        geom: SCOTLAND_POLY,
        minRes: 3,
      });
    }

    workDir = await mkdtemp(path.join(tmpdir(), 'ww-t33-'));
    betaPath = path.join(workDir, 'beta-species.yaml');
    downloadDir = path.join(workDir, 'downloads');
    await writeFile(
      betaPath,
      `
version: 1
species:
  - scientificName: Alcedo atthis
    commonNames:
      en: Common kingfisher
    group: bird
    effortGroup: Aves
    regions: [scotland]
    coastal: true
    activityPattern: diurnal
    challengeEligible: true
    gbifTaxonKey: 2475532
    matchType: EXACT
    reviewNeeded: false
`,
      'utf8',
    );
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(async () => {
    server.close();
    if (workDir.length > 0) {
      await rm(workDir, { recursive: true, force: true });
    }
    await pool.end();
  });

  it('moves a run from requested to succeeded and stores the DOI', async () => {
    let statusHits = 0;

    server.use(
      http.post(`${BASE}/v1/occurrence/download/request`, async ({ request }) => {
        const body = (await request.json()) as { predicate?: { type?: string } };
        expect(body.predicate?.type).toBe('and');
        return new HttpResponse(DOWNLOAD_KEY, {
          status: 201,
          headers: { 'Content-Type': 'text/plain' },
        });
      }),
      http.get(`${BASE}/v1/occurrence/download/${DOWNLOAD_KEY}`, () => {
        statusHits += 1;
        if (statusHits < 2) {
          return HttpResponse.json({
            key: DOWNLOAD_KEY,
            status: 'RUNNING',
          });
        }
        return HttpResponse.json({
          key: DOWNLOAD_KEY,
          status: 'SUCCEEDED',
          doi: DOI,
          totalRecords: 12,
          downloadLink: `${BASE}/v1/occurrence/download/request/${DOWNLOAD_KEY}.zip`,
        });
      }),
      http.get(
        `${BASE}/v1/occurrence/download/request/${DOWNLOAD_KEY}.zip`,
        () =>
          new HttpResponse(Buffer.from('PK\u0003\u0004-fixture'), {
            status: 200,
            headers: { 'Content-Type': 'application/zip' },
          }),
      ),
    );

    const client = createGbifClient({
      credentials: {
        user: env.GBIF_USER,
        password: env.GBIF_PASSWORD,
        email: env.GBIF_EMAIL,
      },
      baseUrl: BASE,
      sleep: () => Promise.resolve(),
      backoffBaseMs: 1,
    });

    const requested = await runGbifRequest({
      region: 'scotland',
      kind: 'target',
      betaSpeciesPath: betaPath,
      client,
      db,
      env,
      now: new Date('2026-11-24T12:00:00.000Z'),
    });

    expect(requested.status).toBe(INGEST_STATUS.requested);
    expect(requested.downloadKey).toBe(DOWNLOAD_KEY);

    const afterRequest = await db
      .select()
      .from(ingestRuns)
      .where(eq(ingestRuns.id, requested.runId))
      .limit(1);
    expect(requireRow(afterRequest[0], 'run').status).toBe(INGEST_STATUS.requested);
    expect(requireRow(afterRequest[0], 'run').gbifDownloadKey).toBe(DOWNLOAD_KEY);

    const fetched = await runGbifFetch({
      runId: requested.runId,
      downloadDir,
      client,
      db,
      env,
      pollIntervalMs: 1,
      maxPolls: 5,
      sleep: () => Promise.resolve(),
      now: new Date('2026-11-24T12:05:00.000Z'),
    });

    expect(fetched.status).toBe(INGEST_STATUS.succeeded);
    expect(fetched.doi).toBe(DOI);
    expect(fetched.total).toBe(12);
    expect(fetched.zipPath).toBeTruthy();
    if (fetched.zipPath === null) {
      throw new Error('expected zipPath');
    }
    const zip = await readFile(fetched.zipPath);
    expect(zip.subarray(0, 2).toString('utf8')).toBe('PK');

    const afterFetch = await db
      .select()
      .from(ingestRuns)
      .where(eq(ingestRuns.id, requested.runId))
      .limit(1);
    const row = requireRow(afterFetch[0], 'run after fetch');
    expect(row.status).toBe(INGEST_STATUS.succeeded);
    expect(row.doi).toBe(DOI);
    expect(row.total).toBe(12);
    expect(row.finishedAt).not.toBeNull();
  });
});

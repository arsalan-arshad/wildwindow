import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  applyRoles,
  createDb,
  effortCellWeek,
  migrationsFolder,
  regions,
  roleConnectionUrl,
  runMigrations,
  seedAll,
  taxa,
  taxonCellWeek,
  taxonRegionWeek,
  taxonScoreRef,
} from '@wildwindow/db';
import { SCORING_V1 } from '@wildwindow/scoring';
import { and, eq } from 'drizzle-orm';
import { cellToParent, latLngToCell } from 'h3-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module.js';
import { apiNestOptions, configureApiApp } from '../bootstrap.js';

import { runForecastPerf } from './run-forecast-perf.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';
const API_PASSWORD = process.env['WW_API_DB_PASSWORD'] ?? 'ww_api_test_password';
const WORKER_PASSWORD = process.env['WW_WORKER_DB_PASSWORD'] ?? 'ww_worker_test_password';

const GLASGOW_R7 = latLngToCell(55.86515, -4.25763, 7);
const GLASGOW_R5 = cellToParent(GLASGOW_R7, 5);

function restoreEnv(snapshot: Record<string, string | undefined>): void {
  for (const key of Object.keys(snapshot)) {
    const value = snapshot[key];
    if (value === undefined) {
      Reflect.deleteProperty(process.env, key);
    } else {
      process.env[key] = value;
    }
  }
}

describe('T9.8 forecast perf smoke (autocannon)', () => {
  let app: INestApplication;
  let previousEnv: Record<string, string | undefined>;
  let otterId: number;
  let baseUrl: string;

  beforeAll(async () => {
    await runMigrations(DATABASE_URL, migrationsFolder());
    await applyRoles(DATABASE_URL, {
      apiPassword: API_PASSWORD,
      workerPassword: WORKER_PASSWORD,
    });
    await seedAll(DATABASE_URL);

    const { db, pool } = createDb({ connectionString: DATABASE_URL });
    try {
      const otter = await db
        .select({ id: taxa.id })
        .from(taxa)
        .where(eq(taxa.scientificName, 'Lutra lutra'))
        .limit(1);
      const otterRow = otter[0];
      if (otterRow === undefined) {
        throw new Error('Expected Lutra lutra in seed');
      }
      otterId = otterRow.id;

      const regionRows = await db
        .select({ id: regions.id })
        .from(regions)
        .where(eq(regions.slug, 'scotland'))
        .limit(1);
      const regionRow = regionRows[0];
      if (regionRow === undefined) {
        throw new Error('Expected scotland region');
      }
      const regionScotlandId = regionRow.id;

      await db.delete(taxonCellWeek).where(eq(taxonCellWeek.taxonId, otterId));
      await db.delete(taxonRegionWeek).where(eq(taxonRegionWeek.taxonId, otterId));
      await db
        .delete(effortCellWeek)
        .where(
          and(
            eq(effortCellWeek.regionId, regionScotlandId),
            eq(effortCellWeek.effortGroup, 'Mammalia'),
            eq(effortCellWeek.cell, GLASGOW_R5),
          ),
        );
      await db
        .delete(taxonScoreRef)
        .where(
          and(eq(taxonScoreRef.taxonId, otterId), eq(taxonScoreRef.regionId, regionScotlandId)),
        );

      const weeks = [45, 46, 47] as const;
      for (const week of weeks) {
        await db.insert(taxonCellWeek).values({
          taxonId: otterId,
          regionId: regionScotlandId,
          res: 5,
          cell: GLASGOW_R5,
          week,
          nRecords: 40,
          nObservers: 12,
          yearsCovered: 3,
        });
        await db.insert(effortCellWeek).values({
          effortGroup: 'Mammalia',
          regionId: regionScotlandId,
          res: 5,
          cell: GLASGOW_R5,
          week,
          nRecords: 800,
        });
        await db.insert(taxonRegionWeek).values({
          taxonId: otterId,
          regionId: regionScotlandId,
          week,
          nRecords: 120,
          nEffort: 4000,
        });
      }

      await db.insert(taxonScoreRef).values({
        taxonId: otterId,
        regionId: regionScotlandId,
        rrRef: 0.05,
        computedAt: new Date('2026-11-01T12:00:00.000Z'),
        scoringVersion: SCORING_V1.version,
      });
    } finally {
      await pool.end();
    }

    previousEnv = {
      DATABASE_URL_API: process.env['DATABASE_URL_API'],
      NODE_ENV: process.env['NODE_ENV'],
      WAITLIST_THROTTLE_DISABLED: process.env['WAITLIST_THROTTLE_DISABLED'],
      WEATHER_PROVIDER: process.env['WEATHER_PROVIDER'],
      TIDE_PROVIDER: process.env['TIDE_PROVIDER'],
      PORT: process.env['PORT'],
    };
    process.env['DATABASE_URL_API'] = roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD);
    process.env['NODE_ENV'] = 'test';
    process.env['WAITLIST_THROTTLE_DISABLED'] = '1';
    process.env['WEATHER_PROVIDER'] = 'mock';
    process.env['TIDE_PROVIDER'] = 'none';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication(apiNestOptions());
    configureApiApp(app);
    await app.listen(0);
    const server = app.getHttpServer() as { address: () => string | { port: number } };
    const address = server.address();
    if (typeof address === 'string') {
      throw new Error('Expected TCP listen address with port');
    }
    baseUrl = `http://127.0.0.1:${String(address.port)}`;
  }, 180_000);

  afterAll(async () => {
    await app.close();
    restoreEnv(previousEnv);
  });

  it('smoke mode completes a light autocannon burst against a listening API', async () => {
    const outcome = await runForecastPerf({
      mode: 'smoke',
      baseUrl,
      taxonId: String(otterId),
      cell: GLASGOW_R7,
      start: '2026-11-16',
      writeReport: false,
      durationSec: 1,
      connections: 2,
      warmupSec: 0,
      warmSequential: 1,
      sequentialSamples: 0,
    });
    expect(outcome.status).toBe('ok');
    if (outcome.status !== 'ok') {
      return;
    }
    expect(outcome.autocannon.errors).toBe(0);
    expect(outcome.autocannon.non2xx).toBe(0);
    expect(outcome.autocannon.requestsPerSec).toBeGreaterThan(0);
  }, 60_000);

  it('smoke mode skips cleanly when the API is unreachable', async () => {
    const outcome = await runForecastPerf({
      mode: 'smoke',
      baseUrl: 'http://127.0.0.1:9',
      taxonId: '1',
      cell: GLASGOW_R7,
      start: '2026-11-16',
      writeReport: false,
    });
    expect(outcome.status).toBe('skipped');
    if (outcome.status !== 'skipped') {
      return;
    }
    expect(outcome.reason).toMatch(/unreachable/i);
  });
});

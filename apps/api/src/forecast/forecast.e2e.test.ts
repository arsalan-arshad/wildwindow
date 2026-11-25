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
import { assertPublicSafe, displayCellFor, TIER_POLICY } from '@wildwindow/geoprivacy';
import { SCORING_V1 } from '@wildwindow/scoring';
import { ForecastResponseSchema } from '@wildwindow/shared';
import { and, eq } from 'drizzle-orm';
import { cellToParent, getResolution, gridDisk, latLngToCell } from 'h3-js';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module.js';
import { apiNestOptions, configureApiApp } from '../bootstrap.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';
const API_PASSWORD = process.env['WW_API_DB_PASSWORD'] ?? 'ww_api_test_password';
const WORKER_PASSWORD = process.env['WW_WORKER_DB_PASSWORD'] ?? 'ww_worker_test_password';

const GLASGOW_R7 = latLngToCell(55.86515, -4.25763, 7);
const GLASGOW_R5 = cellToParent(GLASGOW_R7, 5);
const SIBLING_R7 =
  gridDisk(GLASGOW_R7, 1).find(
    (cell) => cell !== GLASGOW_R7 && cellToParent(cell, 5) === GLASGOW_R5,
  ) ?? GLASGOW_R7;

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

function percentile(sortedAsc: readonly number[], p: number): number {
  if (sortedAsc.length === 0) {
    throw new Error('empty sample');
  }
  const idx = Math.min(sortedAsc.length - 1, Math.ceil((p / 100) * sortedAsc.length) - 1);
  const value = sortedAsc[idx];
  if (value === undefined) {
    throw new Error('percentile index out of range');
  }
  return value;
}

describe('T5.6 forecast endpoint', () => {
  let app: INestApplication;
  let previousEnv: Record<string, string | undefined>;
  let otterId: number;
  let ospreyId: number;
  let regionScotlandId: number;

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

      const osprey = await db
        .select({ id: taxa.id })
        .from(taxa)
        .where(eq(taxa.scientificName, 'Pandion haliaetus'))
        .limit(1);
      const ospreyRow = osprey[0];
      if (ospreyRow === undefined) {
        throw new Error('Expected Pandion haliaetus in seed');
      }
      ospreyId = ospreyRow.id;

      const regionRows = await db
        .select({ id: regions.id })
        .from(regions)
        .where(eq(regions.slug, 'scotland'))
        .limit(1);
      const regionRow = regionRows[0];
      if (regionRow === undefined) {
        throw new Error('Expected scotland region');
      }
      regionScotlandId = regionRow.id;

      // Clear and seed aggregates for otter @ Glasgow res-5 (protected display cell).
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
    await app.init();
  }, 180_000);

  afterAll(async () => {
    await app.close();
    restoreEnv(previousEnv);
  });

  it('(a) two res-7 cells under the same res-5 parent yield identical protected responses', async () => {
    expect(displayCellFor(GLASGOW_R7, 'protected')).toBe(GLASGOW_R5);
    expect(displayCellFor(SIBLING_R7, 'protected')).toBe(GLASGOW_R5);
    expect(SIBLING_R7).not.toBe(GLASGOW_R7);

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const start = '2026-11-16'; // ISO week ~47

    const a = await request(server)
      .get('/v1/forecast')
      .query({ taxonId: String(otterId), cell: GLASGOW_R7, start })
      .expect(200);
    const b = await request(server)
      .get('/v1/forecast')
      .query({ taxonId: String(otterId), cell: SIBLING_R7, start })
      .expect(200);

    const parsedA = ForecastResponseSchema.parse(a.body);
    const parsedB = ForecastResponseSchema.parse(b.body);
    expect(parsedA.status).toBe('ok');
    expect(parsedB.status).toBe('ok');
    if (parsedA.status !== 'ok' || parsedB.status !== 'ok') {
      return;
    }
    expect(parsedA.tier).toBe('protected');
    expect(parsedA.displayCell).toBe(GLASGOW_R5);
    expect(parsedB.displayCell).toBe(GLASGOW_R5);
    expect(getResolution(parsedA.displayCell)).toBeLessThanOrEqual(
      TIER_POLICY.protected.resolution,
    );
    expect(a.body).toEqual(b.body);

    assertPublicSafe(a.body, {
      maxResolutionByTier: { protected: TIER_POLICY.protected.resolution },
      h3Tier: 'protected',
    });
    expect(JSON.stringify(a.body)).not.toMatch(/"lat"|"lng"|latitude|longitude|coordinates/i);
    // Honest score copy: never a probability phrase.
    const text = JSON.stringify(a.body);
    expect(text).not.toMatch(/%\s*chance|probability of seeing/i);
    expect(parsedA.weekScore).toBeGreaterThanOrEqual(0);
    expect(parsedA.weekScore).toBeLessThanOrEqual(100);
  });

  it('(b) lockout date returns status lockout for highly_protected osprey', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    // Osprey lockout months include April (seed: 3–8).
    const response = await request(server)
      .get('/v1/forecast')
      .query({ taxonId: String(ospreyId), cell: GLASGOW_R7, start: '2026-04-10' })
      .expect(200);

    const parsed = ForecastResponseSchema.parse(response.body);
    expect(parsed.status).toBe('lockout');
    if (parsed.status !== 'lockout') {
      return;
    }
    expect(parsed.weekScore).toBeNull();
    expect(parsed.reason.length).toBeGreaterThan(0);
    expect(parsed.tier).toBe('highly_protected');
    assertPublicSafe(response.body, {
      maxResolutionByTier: { highly_protected: TIER_POLICY.highly_protected.resolution },
      h3Tier: 'highly_protected',
    });
  });

  it('(c) p95 < 400ms over 100 warm requests locally', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const start = '2026-11-16';
    const query = { taxonId: String(otterId), cell: GLASGOW_R7, start };

    // Warm cache / Nest / DB connections.
    for (let i = 0; i < 10; i += 1) {
      await request(server).get('/v1/forecast').query(query).expect(200);
    }

    const samples: number[] = [];
    for (let i = 0; i < 100; i += 1) {
      const t0 = performance.now();
      await request(server).get('/v1/forecast').query(query).expect(200);
      samples.push(performance.now() - t0);
    }
    samples.sort((a, b) => a - b);
    const p95 = percentile(samples, 95);
    expect(p95).toBeLessThan(400);
  }, 120_000);

  it('rejects invalid res-7 cell with 400', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server)
      .get('/v1/forecast')
      .query({ taxonId: String(otterId), cell: 'not-a-cell', start: '2026-11-16' })
      .expect(400);
  });
});

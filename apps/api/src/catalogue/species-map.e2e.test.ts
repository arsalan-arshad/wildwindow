import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  applyRoles,
  createDb,
  migrationsFolder,
  regions,
  roleConnectionUrl,
  runMigrations,
  seedAll,
  taxa,
  taxonCellWeek,
  taxonRegion,
} from '@wildwindow/db';
import { assertPublicSafe, TIER_POLICY, type Tier } from '@wildwindow/geoprivacy';
import { SensitivityTierSchema, SpeciesMapResponseSchema } from '@wildwindow/shared';
import { eq } from 'drizzle-orm';
import { cellToParent, getResolution, latLngToCell } from 'h3-js';
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
const ABERDEEN_R7 = latLngToCell(57.15, -2.1, 7);
const ABERDEEN_R5 = cellToParent(ABERDEEN_R7, 5);

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

function assertNoCounts(body: unknown): void {
  const json = JSON.stringify(body);
  expect(json).not.toMatch(/nRecords|nObservers|n_records|n_observers|"count"/i);
  expect(json).not.toMatch(/"lat"|"lng"|latitude|longitude|coordinates/i);
}

describe('T5.7 species map endpoint', () => {
  let app: INestApplication | undefined;
  let previousEnv: Record<string, string | undefined> = {};
  let kingfisherId: number;
  let otterId: number;
  let ospreyId: number;
  let capercaillieId: number;
  let regionScotlandId: number;
  let seededLinks: { taxonId: number; regionSlug: string; tier: Tier }[] = [];

  beforeAll(async () => {
    await runMigrations(DATABASE_URL, migrationsFolder());
    await applyRoles(DATABASE_URL, {
      apiPassword: API_PASSWORD,
      workerPassword: WORKER_PASSWORD,
    });
    await seedAll(DATABASE_URL);

    const { db, pool } = createDb({ connectionString: DATABASE_URL });
    try {
      const byName = async (scientificName: string): Promise<number> => {
        const rows = await db
          .select({ id: taxa.id })
          .from(taxa)
          .where(eq(taxa.scientificName, scientificName))
          .limit(1);
        const row = rows[0];
        if (row === undefined) {
          throw new Error(`Expected ${scientificName} in seed`);
        }
        return row.id;
      };

      kingfisherId = await byName('Alcedo atthis');
      otterId = await byName('Lutra lutra');
      ospreyId = await byName('Pandion haliaetus');
      capercaillieId = await byName('Tetrao urogallus');

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

      // Clear prior fixture cells for these taxa, then seed published aggregates.
      for (const taxonId of [kingfisherId, otterId, ospreyId, capercaillieId]) {
        await db.delete(taxonCellWeek).where(eq(taxonCellWeek.taxonId, taxonId));
      }

      expect(GLASGOW_R5).not.toBe(ABERDEEN_R5);

      // open (kingfisher): res-7 cells with varying intensity.
      await db.insert(taxonCellWeek).values([
        {
          taxonId: kingfisherId,
          regionId: regionScotlandId,
          res: 7,
          cell: GLASGOW_R7,
          week: 20,
          nRecords: 10,
          nObservers: 5,
          yearsCovered: 2,
        },
        {
          taxonId: kingfisherId,
          regionId: regionScotlandId,
          res: 7,
          cell: ABERDEEN_R7,
          week: 20,
          nRecords: 80,
          nObservers: 12,
          yearsCovered: 3,
        },
        {
          taxonId: kingfisherId,
          regionId: regionScotlandId,
          res: 7,
          cell: GLASGOW_R7,
          week: 21,
          nRecords: 15,
          nObservers: 6,
          yearsCovered: 2,
        },
      ]);

      // protected (otter): res-5 only.
      await db.insert(taxonCellWeek).values([
        {
          taxonId: otterId,
          regionId: regionScotlandId,
          res: 5,
          cell: GLASGOW_R5,
          week: 30,
          nRecords: 40,
          nObservers: 12,
          yearsCovered: 3,
        },
        {
          taxonId: otterId,
          regionId: regionScotlandId,
          res: 5,
          cell: ABERDEEN_R5,
          week: 30,
          nRecords: 20,
          nObservers: 8,
          yearsCovered: 2,
        },
      ]);

      // highly_protected (osprey): publish rows that must still yield [] via mapCells=false.
      await db.insert(taxonCellWeek).values({
        taxonId: ospreyId,
        regionId: regionScotlandId,
        res: 4,
        cell: cellToParent(GLASGOW_R7, 4),
        week: 25,
        nRecords: 100,
        nObservers: 20,
        yearsCovered: 4,
      });

      // no_forecast (capercaillie): likewise must yield [].
      await db.insert(taxonCellWeek).values({
        taxonId: capercaillieId,
        regionId: regionScotlandId,
        res: 4,
        cell: cellToParent(ABERDEEN_R7, 4),
        week: 25,
        nRecords: 50,
        nObservers: 10,
        yearsCovered: 2,
      });

      const links = await db
        .select({
          taxonId: taxonRegion.taxonId,
          regionSlug: regions.slug,
          tier: taxonRegion.tier,
        })
        .from(taxonRegion)
        .innerJoin(regions, eq(regions.id, taxonRegion.regionId));

      seededLinks = links.map((row) => ({
        taxonId: row.taxonId,
        regionSlug: row.regionSlug,
        tier: SensitivityTierSchema.parse(row.tier),
      }));
    } finally {
      await pool.end();
    }

    previousEnv = {
      DATABASE_URL_API: process.env['DATABASE_URL_API'],
      NODE_ENV: process.env['NODE_ENV'],
      WAITLIST_THROTTLE_DISABLED: process.env['WAITLIST_THROTTLE_DISABLED'],
    };
    process.env['DATABASE_URL_API'] = roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD);
    process.env['NODE_ENV'] = 'test';
    process.env['WAITLIST_THROTTLE_DISABLED'] = '1';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication(apiNestOptions());
    configureApiApp(app);
    await app.init();
  }, 180_000);

  afterAll(async () => {
    if (app !== undefined) {
      await app.close();
    }
    restoreEnv(previousEnv);
  });

  it('GET /v1/species/:taxonId/map returns levels without counts for open taxa', async () => {
    expect(app).toBeDefined();
    if (app === undefined) {
      return;
    }
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server)
      .get(`/v1/species/${String(kingfisherId)}/map`)
      .query({ region: 'scotland' })
      .expect(200);

    const parsed = SpeciesMapResponseSchema.parse(response.body);
    expect(parsed.taxonId).toBe(String(kingfisherId));
    expect(parsed.regionSlug).toBe('scotland');
    expect(parsed.cells.length).toBeGreaterThanOrEqual(2);
    // Glasgow summed across weeks 20+21 → 25; Aberdeen → 80 → higher level.
    const glasgow = parsed.cells.find((c) => c.cell === GLASGOW_R7);
    const aberdeen = parsed.cells.find((c) => c.cell === ABERDEEN_R7);
    expect(glasgow).toBeDefined();
    expect(aberdeen).toBeDefined();
    if (glasgow !== undefined && aberdeen !== undefined) {
      expect(aberdeen.level).toBeGreaterThanOrEqual(glasgow.level);
    }
    assertNoCounts(response.body);
    assertPublicSafe(response.body, {
      maxResolutionByTier: { open: TIER_POLICY.open.resolution },
      h3Tier: 'open',
    });
  });

  it('returns [] for highly_protected and no_forecast even when aggregates exist', async () => {
    expect(app).toBeDefined();
    if (app === undefined) {
      return;
    }
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    const osprey = await request(server)
      .get(`/v1/species/${String(ospreyId)}/map`)
      .query({ region: 'scotland' })
      .expect(200);
    const ospreyParsed = SpeciesMapResponseSchema.parse(osprey.body);
    expect(ospreyParsed.cells).toEqual([]);

    const capercaillie = await request(server)
      .get(`/v1/species/${String(capercaillieId)}/map`)
      .query({ region: 'scotland' })
      .expect(200);
    const capParsed = SpeciesMapResponseSchema.parse(capercaillie.body);
    expect(capParsed.cells).toEqual([]);
  });

  it('acceptance: every seeded taxon — no counts; no cell finer than the tier allows', async () => {
    expect(app).toBeDefined();
    if (app === undefined) {
      return;
    }
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    expect(seededLinks.length).toBeGreaterThan(10);

    for (const link of seededLinks) {
      const response = await request(server)
        .get(`/v1/species/${String(link.taxonId)}/map`)
        .query({ region: link.regionSlug })
        .expect(200);

      const parsed = SpeciesMapResponseSchema.parse(response.body);
      assertNoCounts(response.body);

      const policy = TIER_POLICY[link.tier];
      if (!policy.mapCells) {
        expect(parsed.cells).toEqual([]);
        continue;
      }

      const maxRes = policy.resolution;
      expect(typeof maxRes).toBe('number');
      if (typeof maxRes !== 'number') {
        continue;
      }
      for (const entry of parsed.cells) {
        expect(getResolution(entry.cell)).toBeLessThanOrEqual(maxRes);
        expect(entry.level).toBeGreaterThanOrEqual(1);
        expect(entry.level).toBeLessThanOrEqual(5);
      }

      assertPublicSafe(response.body, {
        maxResolutionByTier: { [link.tier]: maxRes },
        h3Tier: link.tier,
      });
    }
  });

  it('returns 404 for unknown taxon in region', async () => {
    expect(app).toBeDefined();
    if (app === undefined) {
      return;
    }
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server).get('/v1/species/999999999/map').query({ region: 'scotland' }).expect(404);
  });
});

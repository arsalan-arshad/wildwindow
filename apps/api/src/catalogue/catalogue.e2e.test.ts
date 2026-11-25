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
  speciesCards,
  taxa,
  taxonRegionWeek,
} from '@wildwindow/db';
import { assertPublicSafe, TIER_POLICY } from '@wildwindow/geoprivacy';
import {
  RegionSpeciesResponseSchema,
  RegionsResponseSchema,
  SeasonalityResponseSchema,
  SpeciesDetailSchema,
} from '@wildwindow/shared';
import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module.js';
import { apiNestOptions, configureApiApp } from '../bootstrap.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';
const API_PASSWORD = process.env['WW_API_DB_PASSWORD'] ?? 'ww_api_test_password';
const WORKER_PASSWORD = process.env['WW_WORKER_DB_PASSWORD'] ?? 'ww_worker_test_password';

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

describe('T5.4 regions, species and seasonality', () => {
  let app: INestApplication;
  let previousEnv: Record<string, string | undefined>;
  let kingfisherId: number;
  let regionScotlandId: number;
  let reviewedCardTaxonId: number;

  beforeAll(async () => {
    await runMigrations(DATABASE_URL, migrationsFolder());
    await applyRoles(DATABASE_URL, {
      apiPassword: API_PASSWORD,
      workerPassword: WORKER_PASSWORD,
    });
    await seedAll(DATABASE_URL);

    const { db, pool } = createDb({ connectionString: DATABASE_URL });
    try {
      const kingfisher = await db
        .select({ id: taxa.id })
        .from(taxa)
        .where(eq(taxa.scientificName, 'Alcedo atthis'))
        .limit(1);
      const kf = kingfisher[0];
      if (kf === undefined) {
        throw new Error('Expected Alcedo atthis in seed');
      }
      kingfisherId = kf.id;
      reviewedCardTaxonId = kf.id;

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

      // Clear prior fixture rows for this taxon×region, then seed card + weeks.
      await db
        .delete(speciesCards)
        .where(
          and(eq(speciesCards.taxonId, kingfisherId), eq(speciesCards.regionId, regionScotlandId)),
        );
      await db
        .delete(taxonRegionWeek)
        .where(
          and(
            eq(taxonRegionWeek.taxonId, kingfisherId),
            eq(taxonRegionWeek.regionId, regionScotlandId),
          ),
        );

      await db.insert(speciesCards).values({
        taxonId: kingfisherId,
        regionId: regionScotlandId,
        bodyMd: '## Kingfisher field notes\n\nStart at 1/1000s.',
        settings: { perched: { shutter: '1/1000', iso: 400 } },
        ethicsMd: 'Do not disturb nests.',
        legalMd: null,
        status: 'reviewed',
        reviewedBy: 'test-reviewer',
        reviewedAt: new Date('2026-11-01T12:00:00.000Z'),
      });

      // A draft card for another taxon must not appear on detail.
      const other = await db
        .select({ id: taxa.id })
        .from(taxa)
        .where(eq(taxa.scientificName, 'Sciurus vulgaris'))
        .limit(1);
      const otherTaxon = other[0];
      if (otherTaxon !== undefined) {
        await db
          .delete(speciesCards)
          .where(
            and(
              eq(speciesCards.taxonId, otherTaxon.id),
              eq(speciesCards.regionId, regionScotlandId),
            ),
          );
        await db.insert(speciesCards).values({
          taxonId: otherTaxon.id,
          regionId: regionScotlandId,
          bodyMd: 'Draft only — should not be returned.',
          settings: {},
          ethicsMd: null,
          legalMd: null,
          status: 'draft',
          reviewedBy: null,
          reviewedAt: null,
        });
      }

      // Seasonality fixture: peak at week 26.
      const weekValues = [
        { week: 1, nRecords: 10, nEffort: 100 },
        { week: 26, nRecords: 50, nEffort: 100 },
        { week: 52, nRecords: 25, nEffort: 100 },
      ];
      for (const row of weekValues) {
        await db.insert(taxonRegionWeek).values({
          taxonId: kingfisherId,
          regionId: regionScotlandId,
          week: row.week,
          nRecords: row.nRecords,
          nEffort: row.nEffort,
        });
      }
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
  }, 120_000);

  afterAll(async () => {
    await app.close();
    restoreEnv(previousEnv);
  });

  it('GET /v1/regions returns beta regions without geometry', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server).get('/v1/regions').expect(200);
    const parsed = RegionsResponseSchema.parse(response.body);
    expect(parsed.regions).toHaveLength(2);
    expect(parsed.regions.map((r) => r.slug).sort()).toEqual(['scotland', 'sindh']);
    expect(parsed.regions.find((r) => r.slug === 'scotland')?.timeZone).toBe('Europe/London');
    expect(parsed.regions.find((r) => r.slug === 'sindh')?.timeZone).toBe('Asia/Karachi');
    assertPublicSafe(response.body, {
      maxResolutionByTier: { open: TIER_POLICY.open.resolution },
    });
    expect(JSON.stringify(response.body)).not.toMatch(/geom|latitude|longitude|"lat"|"lng"/i);
  });

  it('GET /v1/regions/:slug/species search matches English, Urdu and scientific names', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    const byEn = await request(server)
      .get('/v1/regions/scotland/species')
      .query({ q: 'kingfisher' })
      .expect(200);
    const enParsed = RegionSpeciesResponseSchema.parse(byEn.body);
    expect(enParsed.regionSlug).toBe('scotland');
    expect(enParsed.species.some((s) => s.scientificName === 'Alcedo atthis')).toBe(true);

    const byUr = await request(server)
      .get('/v1/regions/scotland/species')
      .query({ q: 'کنگ فشر' })
      .expect(200);
    const urParsed = RegionSpeciesResponseSchema.parse(byUr.body);
    expect(urParsed.species.some((s) => s.taxonId === String(kingfisherId))).toBe(true);

    const bySci = await request(server)
      .get('/v1/regions/scotland/species')
      .query({ q: 'Alcedo' })
      .expect(200);
    const sciParsed = RegionSpeciesResponseSchema.parse(bySci.body);
    expect(sciParsed.species.some((s) => s.scientificName === 'Alcedo atthis')).toBe(true);

    const byGroup = await request(server)
      .get('/v1/regions/scotland/species')
      .query({ group: 'bird' })
      .expect(200);
    const groupParsed = RegionSpeciesResponseSchema.parse(byGroup.body);
    expect(groupParsed.species.length).toBeGreaterThan(0);
    expect(groupParsed.species.every((s) => s.group === 'bird')).toBe(true);

    assertPublicSafe(byEn.body, {
      maxResolutionByTier: { open: TIER_POLICY.open.resolution },
    });
  });

  it('GET /v1/species/:taxonId returns reviewed card only', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server)
      .get(`/v1/species/${String(reviewedCardTaxonId)}`)
      .query({ region: 'scotland' })
      .expect(200);
    const parsed = SpeciesDetailSchema.parse(response.body);
    expect(parsed.taxonId).toBe(String(kingfisherId));
    expect(parsed.scientificName).toBe('Alcedo atthis');
    expect(parsed.card).not.toBeNull();
    expect(parsed.card?.reviewedBy).toBe('test-reviewer');
    expect(parsed.card?.bodyMd).toContain('Kingfisher');

    // Draft card taxon → card null.
    const { db, pool } = createDb({ connectionString: DATABASE_URL });
    let squirrelId: string | undefined;
    try {
      const rows = await db
        .select({ id: taxa.id })
        .from(taxa)
        .where(eq(taxa.scientificName, 'Sciurus vulgaris'))
        .limit(1);
      squirrelId = rows[0] !== undefined ? String(rows[0].id) : undefined;
    } finally {
      await pool.end();
    }
    if (squirrelId !== undefined) {
      const draftResponse = await request(server)
        .get(`/v1/species/${squirrelId}`)
        .query({ region: 'scotland' })
        .expect(200);
      const draftParsed = SpeciesDetailSchema.parse(draftResponse.body);
      expect(draftParsed.card).toBeNull();
    }

    assertPublicSafe(response.body, {
      maxResolutionByTier: { open: TIER_POLICY.open.resolution },
    });
  });

  it('GET /v1/species/:taxonId/seasonality returns 52 values in [0, 1]', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server)
      .get(`/v1/species/${String(kingfisherId)}/seasonality`)
      .query({ region: 'scotland' })
      .expect(200);
    const parsed = SeasonalityResponseSchema.parse(response.body);
    expect(parsed.weeks).toHaveLength(52);
    expect(parsed.weeks.every((v) => v >= 0 && v <= 1)).toBe(true);
    expect(parsed.weeks[25]).toBe(1);
    expect(parsed.weeks[0]).toBeCloseTo(0.2, 10);
    expect(parsed.weeks[51]).toBeCloseTo(0.5, 10);
    assertPublicSafe(response.body, {
      maxResolutionByTier: { open: TIER_POLICY.open.resolution },
    });
  });

  it('returns 404 for unknown region or taxon', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server).get('/v1/regions/atlantis/species').expect(404);
    await request(server)
      .get(`/v1/species/${String(kingfisherId)}`)
      .query({ region: 'atlantis' })
      .expect(400);
    await request(server).get('/v1/species/999999999').query({ region: 'scotland' }).expect(404);
  });
});

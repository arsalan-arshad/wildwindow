import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  applyRoles,
  auditLog,
  challengeEntries,
  challenges,
  createDb,
  effortCellWeek,
  forecastCache,
  ingestRuns,
  logbookEntries,
  migrationsFolder,
  regions,
  roleConnectionUrl,
  runMigrations,
  seedAll,
  taxa,
  taxonCellWeek,
  taxonRegion,
  taxonRegionWeek,
  taxonScoreRef,
  users,
} from '@wildwindow/db';
import { SCORING_V1 } from '@wildwindow/scoring';
import {
  AdminChallengeEntrySchema,
  AdminIngestRunsResponseSchema,
  AdminSpeciesResponseSchema,
  AdminTaxonRegionSchema,
  ForecastResponseSchema,
} from '@wildwindow/shared';
import { and, eq } from 'drizzle-orm';
import { cellToParent, latLngToCell } from 'h3-js';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module.js';
import { FIREBASE_TOKEN_VERIFIER, type FirebaseTokenVerifier } from '../auth/token-verifier.js';
import { apiNestOptions, configureApiApp } from '../bootstrap.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';
const API_PASSWORD = process.env['WW_API_DB_PASSWORD'] ?? 'ww_api_test_password';
const WORKER_PASSWORD = process.env['WW_WORKER_DB_PASSWORD'] ?? 'ww_worker_test_password';

const MOCK_UID_ADMIN = 'mock-firebase-uid-admin-t513';
const MOCK_UID_USER = 'mock-firebase-uid-user-t513';
const MOCK_EMAIL_ADMIN = 'admin-t513@example.com';

const GLASGOW_R7 = latLngToCell(55.86515, -4.25763, 7);
const GLASGOW_R5 = cellToParent(GLASGOW_R7, 5);

class MockTokenVerifier implements FirebaseTokenVerifier {
  readonly tokens = new Map<string, { uid: string; email?: string; name?: string }>();

  verifyIdToken(idToken: string): Promise<{ uid: string; email?: string; name?: string }> {
    const hit = this.tokens.get(idToken);
    if (hit === undefined) {
      return Promise.reject(new Error('invalid token'));
    }
    return Promise.resolve(hit);
  }
}

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

describe('T5.13 Admin endpoints and audit log', () => {
  let app: INestApplication;
  let previousEnv: Record<string, string | undefined>;
  const mockVerifier = new MockTokenVerifier();
  let otterId: number;
  let regionScotlandId: number;
  let adminUserId: string;
  let originalOtterTier: string;
  let originalOtterLockout: number[];

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
      regionScotlandId = regionRow.id;

      const link = await db
        .select({
          tier: taxonRegion.tier,
          lockoutMonths: taxonRegion.lockoutMonths,
        })
        .from(taxonRegion)
        .where(and(eq(taxonRegion.taxonId, otterId), eq(taxonRegion.regionId, regionScotlandId)))
        .limit(1);
      const linkRow = link[0];
      if (linkRow === undefined) {
        throw new Error('Expected otter taxon_region for scotland');
      }
      originalOtterTier = linkRow.tier;
      originalOtterLockout = [...linkRow.lockoutMonths];

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
      await db.delete(forecastCache).where(eq(forecastCache.taxonId, otterId));

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
      FIREBASE_PROJECT_ID: process.env['FIREBASE_PROJECT_ID'],
      FIREBASE_SERVICE_ACCOUNT_JSON: process.env['FIREBASE_SERVICE_ACCOUNT_JSON'],
    };

    process.env['DATABASE_URL_API'] = roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD);
    process.env['NODE_ENV'] = 'test';
    process.env['WAITLIST_THROTTLE_DISABLED'] = '1';
    process.env['WEATHER_PROVIDER'] = 'mock';
    process.env['TIDE_PROVIDER'] = 'none';
    Reflect.deleteProperty(process.env, 'FIREBASE_PROJECT_ID');
    Reflect.deleteProperty(process.env, 'FIREBASE_SERVICE_ACCOUNT_JSON');

    mockVerifier.tokens.set('token-admin', {
      uid: MOCK_UID_ADMIN,
      email: MOCK_EMAIL_ADMIN,
      name: 'Admin T513',
    });
    mockVerifier.tokens.set('token-user', {
      uid: MOCK_UID_USER,
      email: 'user-t513@example.com',
      name: 'User T513',
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FIREBASE_TOKEN_VERIFIER)
      .useValue(mockVerifier)
      .compile();

    app = moduleRef.createNestApplication(apiNestOptions());
    configureApiApp(app);
    await app.init();
  }, 180_000);

  beforeEach(async () => {
    // Restore otter tier and clear audit/cache so each case starts clean.
    const owner = createDb({ connectionString: DATABASE_URL });
    try {
      await owner.db
        .update(taxonRegion)
        .set({
          tier: originalOtterTier,
          lockoutMonths: originalOtterLockout,
          reviewer: null,
          reviewedAt: null,
        })
        .where(and(eq(taxonRegion.taxonId, otterId), eq(taxonRegion.regionId, regionScotlandId)));
      await owner.db.delete(forecastCache).where(eq(forecastCache.taxonId, otterId));

      const adminRows = await owner.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.firebaseUid, MOCK_UID_ADMIN));
      const userRows = await owner.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.firebaseUid, MOCK_UID_USER));
      const actorIds = [...adminRows, ...userRows].map((row) => row.id);
      for (const actorId of actorIds) {
        await owner.db.delete(auditLog).where(eq(auditLog.actorUserId, actorId));
      }
      await owner.db
        .delete(auditLog)
        .where(
          and(
            eq(auditLog.entity, 'taxon_region'),
            eq(auditLog.entityId, `${String(otterId)}:scotland`),
          ),
        );
      await owner.db
        .delete(auditLog)
        .where(
          and(
            eq(auditLog.entity, 'species_card'),
            eq(auditLog.entityId, `${String(otterId)}:scotland`),
          ),
        );

      const { db, pool } = createDb({
        connectionString: roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD),
      });
      try {
        await db.delete(users).where(eq(users.firebaseUid, MOCK_UID_ADMIN));
        await db.delete(users).where(eq(users.firebaseUid, MOCK_UID_USER));
      } finally {
        await pool.end();
      }
    } finally {
      await owner.pool.end();
    }
  });

  afterAll(async () => {
    const owner = createDb({ connectionString: DATABASE_URL });
    try {
      await owner.db
        .update(taxonRegion)
        .set({
          tier: originalOtterTier,
          lockoutMonths: originalOtterLockout,
          reviewer: null,
          reviewedAt: null,
        })
        .where(and(eq(taxonRegion.taxonId, otterId), eq(taxonRegion.regionId, regionScotlandId)));
    } finally {
      await owner.pool.end();
    }
    await app.close();
    restoreEnv(previousEnv);
  });

  async function promoteAdmin(): Promise<string> {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server).get('/v1/me').set('Authorization', 'Bearer token-admin').expect(200);

    const { db, pool } = createDb({
      connectionString: roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD),
    });
    try {
      await db.update(users).set({ role: 'admin' }).where(eq(users.firebaseUid, MOCK_UID_ADMIN));
      const rows = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.firebaseUid, MOCK_UID_ADMIN))
        .limit(1);
      const row = rows[0];
      if (row === undefined) {
        throw new Error('admin user missing after upsert');
      }
      adminUserId = row.id;
      return row.id;
    } finally {
      await pool.end();
    }
  }

  it('non-admin → 403 on admin routes', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server).get('/v1/me').set('Authorization', 'Bearer token-user').expect(200);

    await request(server)
      .get(`/v1/admin/taxon-region/${String(otterId)}/scotland`)
      .set('Authorization', 'Bearer token-user')
      .expect(403);
  });

  it('acceptance: changing a tier writes audit row and next forecast reflects new tier', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await promoteAdmin();

    const start = '2026-11-16';

    // Warm cache at original (protected) tier.
    const beforeForecast = await request(server)
      .get('/v1/forecast')
      .query({ taxonId: String(otterId), cell: GLASGOW_R7, start })
      .expect(200);
    const beforeParsed = ForecastResponseSchema.parse(beforeForecast.body);
    expect(beforeParsed.status).toBe('ok');
    if (beforeParsed.status === 'ok') {
      expect(beforeParsed.tier).toBe('protected');
    }

    const { db: checkDb, pool: checkPool } = createDb({
      connectionString: roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD),
    });
    try {
      const cached = await checkDb
        .select({ taxonId: forecastCache.taxonId })
        .from(forecastCache)
        .where(eq(forecastCache.taxonId, otterId));
      expect(cached.length).toBeGreaterThan(0);
    } finally {
      await checkPool.end();
    }

    const patched = await request(server)
      .patch(`/v1/admin/taxon-region/${String(otterId)}/scotland`)
      .set('Authorization', 'Bearer token-admin')
      .send({ tier: 'no_forecast' })
      .expect(200);

    const regionBody = AdminTaxonRegionSchema.parse(patched.body);
    expect(regionBody.tier).toBe('no_forecast');
    expect(regionBody.reviewer).toBe('Admin T513');

    const { db, pool } = createDb({
      connectionString: roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD),
    });
    try {
      const audits = await db
        .select({
          action: auditLog.action,
          entity: auditLog.entity,
          entityId: auditLog.entityId,
          actorUserId: auditLog.actorUserId,
          before: auditLog.before,
          after: auditLog.after,
        })
        .from(auditLog)
        .where(
          and(
            eq(auditLog.entity, 'taxon_region'),
            eq(auditLog.entityId, `${String(otterId)}:scotland`),
          ),
        );
      expect(audits.length).toBeGreaterThanOrEqual(1);
      const latest = audits[audits.length - 1];
      expect(latest?.action).toBe('taxon_region.update');
      expect(latest?.actorUserId).toBe(adminUserId);
      expect(latest?.before).toMatchObject({ tier: 'protected' });
      expect(latest?.after).toMatchObject({ tier: 'no_forecast' });

      const remainingCache = await db
        .select({ taxonId: forecastCache.taxonId })
        .from(forecastCache)
        .where(eq(forecastCache.taxonId, otterId));
      expect(remainingCache).toEqual([]);
    } finally {
      await pool.end();
    }

    const afterForecast = await request(server)
      .get('/v1/forecast')
      .query({ taxonId: String(otterId), cell: GLASGOW_R7, start })
      .expect(200);
    const afterParsed = ForecastResponseSchema.parse(afterForecast.body);
    expect(afterParsed.tier).toBe('no_forecast');
    expect(afterParsed.status).toBe('unavailable');
  });

  it('PATCH species card writes audit and returns admin card payload', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await promoteAdmin();

    const response = await request(server)
      .patch(`/v1/admin/species/${String(otterId)}`)
      .set('Authorization', 'Bearer token-admin')
      .send({
        region: 'scotland',
        bodyMd: '# Otter field notes\n\nStay quiet near water.',
        ethicsMd: 'No baiting.',
        status: 'reviewed',
      })
      .expect(200);

    const parsed = AdminSpeciesResponseSchema.parse(response.body);
    expect(parsed.cardStatus).toBe('reviewed');
    expect(parsed.card?.bodyMd).toContain('Otter field notes');
    expect(parsed.card?.reviewedBy).toBe('Admin T513');

    const { db, pool } = createDb({
      connectionString: roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD),
    });
    try {
      const audits = await db
        .select({ action: auditLog.action })
        .from(auditLog)
        .where(
          and(
            eq(auditLog.entity, 'species_card'),
            eq(auditLog.entityId, `${String(otterId)}:scotland`),
          ),
        );
      expect(
        audits.some(
          (row) => row.action === 'species_card.create' || row.action === 'species_card.update',
        ),
      ).toBe(true);
    } finally {
      await pool.end();
    }
  });

  it('moderates challenge entries and lists ingest runs', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await promoteAdmin();

    // Seed a pending challenge entry as owner (bypass API pledge path).
    const owner = createDb({ connectionString: DATABASE_URL });
    let entryId: number;
    try {
      const [userRow] = await owner.db
        .insert(users)
        .values({
          firebaseUid: `challenge-submitter-${String(Date.now())}`,
          email: `submitter-${String(Date.now())}@example.com`,
          displayName: 'Submitter',
        })
        .returning({ id: users.id });
      if (userRow === undefined) {
        throw new Error('failed to insert submitter');
      }

      const [logbook] = await owner.db
        .insert(logbookEntries)
        .values({
          userId: userRow.id,
          taxonId: otterId,
          takenAt: new Date('2026-11-01T10:00:00.000Z'),
          photoKey: 'photos/admin-e2e.jpg',
        })
        .returning({ id: logbookEntries.id });
      if (logbook === undefined) {
        throw new Error('failed to insert logbook');
      }

      const slug = `admin-mod-${String(Date.now() % 1_000_000)}`;
      const [challenge] = await owner.db
        .insert(challenges)
        .values({
          slug,
          title: 'Admin Mod Test',
          taxonId: otterId,
          startsOn: '2026-11-01',
          endsOn: '2026-11-30',
          rulesMd: 'Be kind.',
          status: 'live',
        })
        .returning({ id: challenges.id });
      if (challenge === undefined) {
        throw new Error('failed to insert challenge');
      }

      const [entry] = await owner.db
        .insert(challengeEntries)
        .values({
          challengeId: challenge.id,
          userId: userRow.id,
          logbookEntryId: logbook.id,
          countryCode: 'GB',
          regionLabel: 'Scotland',
          photoKey: 'photos/admin-e2e.jpg',
          pledgeAcceptedAt: new Date('2026-11-02T10:00:00.000Z'),
          status: 'pending',
          publishAfter: new Date('2026-11-09T10:00:00.000Z'),
        })
        .returning({ id: challengeEntries.id });
      if (entry === undefined) {
        throw new Error('failed to insert challenge entry');
      }
      entryId = entry.id;

      await owner.db.insert(ingestRuns).values({
        source: 'gbif',
        regionId: regionScotlandId,
        kind: 'target',
        status: 'requested',
        gbifDownloadKey: '0000000-admin-e2e',
      });
    } finally {
      await owner.pool.end();
    }

    const list = await request(server)
      .get('/v1/admin/challenge-entries')
      .query({ status: 'pending' })
      .set('Authorization', 'Bearer token-admin')
      .expect(200);
    expect(
      (list.body as { entries: { id: string }[] }).entries.some(
        (row) => row.id === String(entryId),
      ),
    ).toBe(true);

    const approved = await request(server)
      .patch(`/v1/admin/challenge-entries/${String(entryId)}`)
      .set('Authorization', 'Bearer token-admin')
      .send({ status: 'approved' })
      .expect(200);
    expect(AdminChallengeEntrySchema.parse(approved.body).status).toBe('approved');

    const runs = await request(server)
      .get('/v1/admin/ingest-runs')
      .set('Authorization', 'Bearer token-admin')
      .expect(200);
    const parsedRuns = AdminIngestRunsResponseSchema.parse(runs.body);
    expect(parsedRuns.runs.some((run) => run.gbifDownloadKey === '0000000-admin-e2e')).toBe(true);
  });
});

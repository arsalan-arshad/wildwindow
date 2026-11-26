import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  applyRoles,
  challengeEntries,
  challenges,
  createDb,
  logbookEntries,
  migrationsFolder,
  roleConnectionUrl,
  runMigrations,
  seedAll,
  taxa,
  users,
} from '@wildwindow/db';
import { assertPublicSafe, TIER_POLICY } from '@wildwindow/geoprivacy';
import {
  ChallengeEntriesResponseSchema,
  ChallengeResponseSchema,
  ChallengeSubmitOkSchema,
} from '@wildwindow/shared';
import { eq, inArray } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module.js';
import { FIREBASE_TOKEN_VERIFIER, type FirebaseTokenVerifier } from '../auth/token-verifier.js';
import { apiNestOptions } from '../bootstrap.js';

import { CHALLENGE_PUBLISH_DELAY_MS } from './challenges.service.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';
const API_PASSWORD = process.env['WW_API_DB_PASSWORD'] ?? 'ww_api_test_password';
const WORKER_PASSWORD = process.env['WW_WORKER_DB_PASSWORD'] ?? 'ww_worker_test_password';

const MOCK_UID = 'mock-firebase-uid-challenge-a';
const SLUG = `kingfisher-month-e2e-${String(Date.now() % 1_000_000)}`;

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

describe('T5.12 Challenges /v1/challenges', () => {
  let app: INestApplication;
  let previousEnv: Record<string, string | undefined>;
  let storageRoot: string;
  const mockVerifier = new MockTokenVerifier();
  let taxonId: number | undefined;
  let challengeId: number | undefined;

  beforeAll(async () => {
    await runMigrations(DATABASE_URL, migrationsFolder());
    await applyRoles(DATABASE_URL, {
      apiPassword: API_PASSWORD,
      workerPassword: WORKER_PASSWORD,
    });
    await seedAll(DATABASE_URL);

    storageRoot = await mkdtemp(join(tmpdir(), 'ww-challenge-e2e-'));

    previousEnv = {
      DATABASE_URL_API: process.env['DATABASE_URL_API'],
      NODE_ENV: process.env['NODE_ENV'],
      WAITLIST_THROTTLE_DISABLED: process.env['WAITLIST_THROTTLE_DISABLED'],
      FIREBASE_PROJECT_ID: process.env['FIREBASE_PROJECT_ID'],
      FIREBASE_SERVICE_ACCOUNT_JSON: process.env['FIREBASE_SERVICE_ACCOUNT_JSON'],
      STORAGE_DRIVER: process.env['STORAGE_DRIVER'],
      LOCAL_STORAGE_DIR: process.env['LOCAL_STORAGE_DIR'],
      STORAGE_SIGNING_SECRET: process.env['STORAGE_SIGNING_SECRET'],
      API_PUBLIC_URL: process.env['API_PUBLIC_URL'],
      LOGBOOK_ENC_KEY: process.env['LOGBOOK_ENC_KEY'],
    };

    process.env['DATABASE_URL_API'] = roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD);
    process.env['NODE_ENV'] = 'test';
    process.env['WAITLIST_THROTTLE_DISABLED'] = '1';
    process.env['STORAGE_DRIVER'] = 'local';
    process.env['LOCAL_STORAGE_DIR'] = storageRoot;
    process.env['STORAGE_SIGNING_SECRET'] = 'e2e-challenge-signing-secret';
    process.env['API_PUBLIC_URL'] = 'http://127.0.0.1:3001';
    process.env['LOGBOOK_ENC_KEY'] = Buffer.from(
      'ww-e2e-challenge-aes256-gcm-key!',
      'utf8',
    ).toString('base64');
    Reflect.deleteProperty(process.env, 'FIREBASE_PROJECT_ID');
    Reflect.deleteProperty(process.env, 'FIREBASE_SERVICE_ACCOUNT_JSON');

    mockVerifier.tokens.set('token-a', {
      uid: MOCK_UID,
      email: 'challenge-a@example.com',
      name: 'Challenger A',
    });

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
      taxonId = kf.id;

      const today = new Date();
      const startsOn = utcDateOffset(today, -2);
      const endsOn = utcDateOffset(today, 28);

      const inserted = await db
        .insert(challenges)
        .values({
          slug: SLUG,
          title: 'Kingfisher Month (e2e)',
          taxonId: kf.id,
          startsOn,
          endsOn,
          rulesMd: '## Rules\n\nNo baiting. Tick the ethics pledge.',
          status: 'active',
        })
        .returning({ id: challenges.id });
      challengeId = inserted[0]?.id;
      if (challengeId === undefined) {
        throw new Error('expected challenge insert');
      }
    } finally {
      await pool.end();
    }

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FIREBASE_TOKEN_VERIFIER)
      .useValue(mockVerifier)
      .compile();

    app = moduleRef.createNestApplication(apiNestOptions());
    await app.init();
  });

  beforeEach(async () => {
    const { db, pool } = createDb({
      connectionString: roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD),
    });
    try {
      if (challengeId !== undefined) {
        await db.delete(challengeEntries).where(eq(challengeEntries.challengeId, challengeId));
      }
      const rows = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.firebaseUid, MOCK_UID));
      const ids = rows.map((row) => row.id);
      if (ids.length > 0) {
        await db.delete(logbookEntries).where(inArray(logbookEntries.userId, ids));
      }
      await db.delete(users).where(eq(users.firebaseUid, MOCK_UID));
    } finally {
      await pool.end();
    }
  });

  afterAll(async () => {
    await app.close();
    const { db, pool } = createDb({ connectionString: DATABASE_URL });
    try {
      if (challengeId !== undefined) {
        await db.delete(challengeEntries).where(eq(challengeEntries.challengeId, challengeId));
        await db.delete(challenges).where(eq(challenges.id, challengeId));
      }
    } finally {
      await pool.end();
    }
    await rm(storageRoot, { recursive: true, force: true });
    restoreEnv(previousEnv);
  });

  async function ensureUserAndLogbook(): Promise<{ logbookEntryId: string; photoKey: string }> {
    if (taxonId === undefined) {
      throw new Error('expected taxon');
    }
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server).get('/v1/me').set('Authorization', 'Bearer token-a').expect(200);

    const { db, pool } = createDb({
      connectionString: roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD),
    });
    try {
      const rows = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.firebaseUid, MOCK_UID))
        .limit(1);
      const id = rows[0]?.id;
      if (id === undefined) {
        throw new Error('expected user after /v1/me');
      }
      const photoKey = `uploads/${id}/kingfisher.jpg`;
      const { mkdir } = await import('node:fs/promises');
      await mkdir(join(storageRoot, 'uploads', id), { recursive: true });
      await writeFile(join(storageRoot, 'uploads', id, 'kingfisher.jpg'), Buffer.from('fake-jpeg'));

      const created = await request(server)
        .post('/v1/me/logbook')
        .set('Authorization', 'Bearer token-a')
        .send({
          taxonId: String(taxonId),
          takenAt: '2026-11-20T08:00:00.000Z',
          photoKey,
          notes: 'Kingfisher perch',
        })
        .expect(201);
      return { logbookEntryId: (created.body as { id: string }).id, photoKey };
    } finally {
      await pool.end();
    }
  }

  it('GET /v1/challenges/current and /:slug return summary; assertPublicSafe', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const current = await request(server).get('/v1/challenges/current').expect(200);
    const currentBody = ChallengeResponseSchema.parse(current.body);
    expect(currentBody.slug).toBe(SLUG);
    expect(currentBody.status).toBe('active');
    expect(currentBody.taxonId).toBe(String(taxonId));
    expect(currentBody.countryCounts).toEqual([]);
    assertPublicSafe(current.body, {
      maxResolutionByTier: { open: TIER_POLICY.open.resolution },
    });

    const bySlug = await request(server).get(`/v1/challenges/${SLUG}`).expect(200);
    expect(ChallengeResponseSchema.parse(bySlug.body).slug).toBe(SLUG);
    assertPublicSafe(bySlug.body, {
      maxResolutionByTier: { open: TIER_POLICY.open.resolution },
    });
  });

  it('POST without pledge → 400; with pledge creates pending entry', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const { logbookEntryId } = await ensureUserAndLogbook();

    const noPledge = await request(server)
      .post(`/v1/challenges/${SLUG}/entries`)
      .set('Authorization', 'Bearer token-a')
      .send({
        logbookEntryId,
        pledgeAccepted: false,
        countryCode: 'GB',
        regionLabel: 'Scotland',
      })
      .expect(400);
    expect(noPledge.body).toMatchObject({ code: 'VALIDATION_ERROR' });

    const missingPledge = await request(server)
      .post(`/v1/challenges/${SLUG}/entries`)
      .set('Authorization', 'Bearer token-a')
      .send({
        logbookEntryId,
        countryCode: 'GB',
        regionLabel: 'Scotland',
      })
      .expect(400);
    expect(missingPledge.body).toMatchObject({ code: 'VALIDATION_ERROR' });

    const ok = await request(server)
      .post(`/v1/challenges/${SLUG}/entries`)
      .set('Authorization', 'Bearer token-a')
      .send({
        logbookEntryId,
        pledgeAccepted: true,
        countryCode: 'gb',
        regionLabel: 'Scotland',
      })
      .expect(201);

    const body = ChallengeSubmitOkSchema.parse(ok.body);
    expect(body.status).toBe('pending');
    const publishAfter = new Date(body.publishAfter).getTime();
    expect(publishAfter).toBeGreaterThan(Date.now() + CHALLENGE_PUBLISH_DELAY_MS - 60_000);
    assertPublicSafe(ok.body, {
      maxResolutionByTier: { open: TIER_POLICY.open.resolution },
    });
  });

  it('entry is not listed before approval or before publish_after', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const { logbookEntryId } = await ensureUserAndLogbook();

    const submitted = await request(server)
      .post(`/v1/challenges/${SLUG}/entries`)
      .set('Authorization', 'Bearer token-a')
      .send({
        logbookEntryId,
        pledgeAccepted: true,
        countryCode: 'PK',
        regionLabel: 'Sindh',
      })
      .expect(201);
    const entryId = (submitted.body as { id: string }).id;

    // Pending → not listed.
    const pendingList = await request(server).get(`/v1/challenges/${SLUG}/entries`).expect(200);
    expect(ChallengeEntriesResponseSchema.parse(pendingList.body).entries).toEqual([]);

    // Approve but keep publish_after in the future → still not listed.
    const { db, pool } = createDb({
      connectionString: roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD),
    });
    try {
      await db
        .update(challengeEntries)
        .set({
          status: 'approved',
          publishAfter: new Date(Date.now() + CHALLENGE_PUBLISH_DELAY_MS),
        })
        .where(eq(challengeEntries.id, Number(entryId)));
    } finally {
      await pool.end();
    }

    const approvedFuture = await request(server)
      .get(`/v1/challenges/${SLUG}/entries`)
      .expect(200);
    expect(ChallengeEntriesResponseSchema.parse(approvedFuture.body).entries).toEqual([]);

    // Past publish_after + approved → listed with country/region only.
    const { db: db2, pool: pool2 } = createDb({
      connectionString: roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD),
    });
    try {
      await db2
        .update(challengeEntries)
        .set({
          status: 'approved',
          publishAfter: new Date(Date.now() - 60_000),
        })
        .where(eq(challengeEntries.id, Number(entryId)));
    } finally {
      await pool2.end();
    }

    const listed = await request(server).get(`/v1/challenges/${SLUG}/entries`).expect(200);
    const parsed = ChallengeEntriesResponseSchema.parse(listed.body);
    expect(parsed.entries).toHaveLength(1);
    const entry = parsed.entries[0];
    expect(entry).toMatchObject({
      id: entryId,
      countryCode: 'PK',
      regionLabel: 'Sindh',
    });
    expect(entry?.photoUrl).toMatch(/^http/);
    expect(entry).not.toHaveProperty('lat');
    expect(entry).not.toHaveProperty('lng');
    expect(entry).not.toHaveProperty('cellR7');
    expect(entry).not.toHaveProperty('photoKey');
    assertPublicSafe(listed.body, {
      maxResolutionByTier: { open: TIER_POLICY.open.resolution },
    });

    const filtered = await request(server)
      .get(`/v1/challenges/${SLUG}/entries`)
      .query({ country: 'GB' })
      .expect(200);
    expect(ChallengeEntriesResponseSchema.parse(filtered.body).entries).toEqual([]);

    const pk = await request(server)
      .get(`/v1/challenges/${SLUG}/entries`)
      .query({ country: 'PK' })
      .expect(200);
    expect(ChallengeEntriesResponseSchema.parse(pk.body).entries).toHaveLength(1);

    const summary = await request(server).get(`/v1/challenges/${SLUG}`).expect(200);
    const summaryBody = ChallengeResponseSchema.parse(summary.body);
    expect(summaryBody.countryCounts).toEqual([{ countryCode: 'PK', count: 1 }]);
  });

  it('rejects wrong-species logbook entry', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server).get('/v1/me').set('Authorization', 'Bearer token-a').expect(200);

    const { db, pool } = createDb({ connectionString: DATABASE_URL });
    let otherTaxonId: number | undefined;
    try {
      const other = await db
        .select({ id: taxa.id })
        .from(taxa)
        .where(eq(taxa.scientificName, 'Sciurus vulgaris'))
        .limit(1);
      otherTaxonId = other[0]?.id;
    } finally {
      await pool.end();
    }
    if (otherTaxonId === undefined) {
      throw new Error('expected Sciurus vulgaris in seed');
    }

    const { db: apiDb, pool: apiPool } = createDb({
      connectionString: roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD),
    });
    try {
      const rows = await apiDb
        .select({ id: users.id })
        .from(users)
        .where(eq(users.firebaseUid, MOCK_UID))
        .limit(1);
      const id = rows[0]?.id;
      if (id === undefined) {
        throw new Error('expected user');
      }
      const photoKey = `uploads/${id}/squirrel.jpg`;
      const { mkdir } = await import('node:fs/promises');
      await mkdir(join(storageRoot, 'uploads', id), { recursive: true });
      await writeFile(join(storageRoot, 'uploads', id, 'squirrel.jpg'), Buffer.from('x'));

      const created = await request(server)
        .post('/v1/me/logbook')
        .set('Authorization', 'Bearer token-a')
        .send({
          taxonId: String(otherTaxonId),
          takenAt: '2026-11-20T09:00:00.000Z',
          photoKey,
        })
        .expect(201);

      const bad = await request(server)
        .post(`/v1/challenges/${SLUG}/entries`)
        .set('Authorization', 'Bearer token-a')
        .send({
          logbookEntryId: (created.body as { id: string }).id,
          pledgeAccepted: true,
          countryCode: 'GB',
          regionLabel: 'Scotland',
        })
        .expect(400);
      expect(bad.body).toMatchObject({ code: 'VALIDATION_ERROR' });
    } finally {
      await apiPool.end();
    }
  });

  it('POST without auth → 401', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server)
      .post(`/v1/challenges/${SLUG}/entries`)
      .send({
        logbookEntryId: '1',
        pledgeAccepted: true,
        countryCode: 'GB',
        regionLabel: 'Scotland',
      })
      .expect(401);
    expect(response.body).toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

function utcDateOffset(now: Date, dayOffset: number): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset),
  );
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${String(y)}-${m}-${day}`;
}

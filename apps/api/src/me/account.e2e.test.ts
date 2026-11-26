import { access, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
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
  regions,
  roleConnectionUrl,
  runMigrations,
  seedAll,
  taxa,
  users,
  watchlist,
} from '@wildwindow/db';
import { MeDeleteOkSchema, MeExportOkSchema } from '@wildwindow/shared';
import { eq, inArray } from 'drizzle-orm';
import { latLngToCell } from 'h3-js';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module.js';
import { FIREBASE_TOKEN_VERIFIER, type FirebaseTokenVerifier } from '../auth/token-verifier.js';
import { apiNestOptions } from '../bootstrap.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';
const API_PASSWORD = process.env['WW_API_DB_PASSWORD'] ?? 'ww_api_test_password';
const WORKER_PASSWORD = process.env['WW_WORKER_DB_PASSWORD'] ?? 'ww_worker_test_password';

const MOCK_UID = 'mock-firebase-uid-account-a';
const CELL = latLngToCell(55.86, -4.25, 7);
const EXACT = { lat: 55.8642, lng: -4.2518 };

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

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('T5.14 Account deletion and export (API)', () => {
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

    storageRoot = await mkdtemp(join(tmpdir(), 'ww-account-e2e-'));

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
      WATCHLIST_LIMIT_FREE: process.env['WATCHLIST_LIMIT_FREE'],
    };

    process.env['DATABASE_URL_API'] = roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD);
    process.env['NODE_ENV'] = 'test';
    process.env['WAITLIST_THROTTLE_DISABLED'] = '1';
    process.env['STORAGE_DRIVER'] = 'local';
    process.env['LOCAL_STORAGE_DIR'] = storageRoot;
    process.env['STORAGE_SIGNING_SECRET'] = 'e2e-account-signing-secret';
    process.env['API_PUBLIC_URL'] = 'http://127.0.0.1:3001';
    process.env['LOGBOOK_ENC_KEY'] = Buffer.from(
      'ww-e2e-account-aes256-gcm-key!!!',
      'utf8',
    ).toString('base64');
    process.env['WATCHLIST_LIMIT_FREE'] = '3';
    Reflect.deleteProperty(process.env, 'FIREBASE_PROJECT_ID');
    Reflect.deleteProperty(process.env, 'FIREBASE_SERVICE_ACCOUNT_JSON');

    mockVerifier.tokens.set('token-a', {
      uid: MOCK_UID,
      email: 'account-a@example.com',
      name: 'Account A',
    });

    const { db, pool } = createDb({ connectionString: DATABASE_URL });
    try {
      const suffix = Date.now() % 100_000_000;
      const kingfisher = await db
        .select({ id: taxa.id })
        .from(taxa)
        .where(eq(taxa.scientificName, 'Alcedo atthis'))
        .limit(1);
      taxonId = kingfisher[0]?.id;
      if (taxonId === undefined) {
        throw new Error('Expected Alcedo atthis in seed');
      }

      const insertedChallenge = await db
        .insert(challenges)
        .values({
          slug: `account-e2e-${String(suffix)}`,
          title: 'Account e2e challenge',
          taxonId,
          startsOn: '2026-11-01',
          endsOn: '2026-12-01',
          rulesMd: 'Test rules',
          status: 'live',
        })
        .returning({ id: challenges.id });
      challengeId = insertedChallenge[0]?.id;
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
      const rows = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.firebaseUid, MOCK_UID));
      const ids = rows.map((row) => row.id);
      if (ids.length > 0) {
        await db.delete(challengeEntries).where(inArray(challengeEntries.userId, ids));
        await db.delete(logbookEntries).where(inArray(logbookEntries.userId, ids));
        await db.delete(watchlist).where(inArray(watchlist.userId, ids));
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
      const rows = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.firebaseUid, MOCK_UID));
      const ids = rows.map((row) => row.id);
      if (ids.length > 0) {
        await db.delete(challengeEntries).where(inArray(challengeEntries.userId, ids));
        await db.delete(logbookEntries).where(inArray(logbookEntries.userId, ids));
        await db.delete(watchlist).where(inArray(watchlist.userId, ids));
        await db.delete(users).where(inArray(users.id, ids));
      }
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

  async function seedOwnedData(): Promise<{
    readonly userId: string;
    readonly photoKey: string;
    readonly thumbKey: string;
    readonly watchlistId: string;
    readonly logbookId: string;
    readonly challengeEntryId: string;
  }> {
    if (taxonId === undefined || challengeId === undefined) {
      throw new Error('expected taxon and challenge');
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
      const userId = rows[0]?.id;
      if (userId === undefined) {
        throw new Error('expected user after /v1/me');
      }

      const photoKey = `uploads/${userId}/export-shot.jpg`;
      const thumbKey = `uploads/${userId}/export-thumb.jpg`;
      await mkdir(join(storageRoot, 'uploads', userId), { recursive: true });
      await writeFile(join(storageRoot, photoKey), Buffer.from('fake-jpeg'));
      await writeFile(join(storageRoot, thumbKey), Buffer.from('fake-thumb'));

      const wl = await request(server)
        .post('/v1/me/watchlist')
        .set('Authorization', 'Bearer token-a')
        .send({ taxonId: String(taxonId), cellR7: CELL })
        .expect(201);

      const lb = await request(server)
        .post('/v1/me/logbook')
        .set('Authorization', 'Bearer token-a')
        .send({
          taxonId: String(taxonId),
          takenAt: '2026-11-20T08:00:00.000Z',
          cellR7: CELL,
          photoKey,
          thumbKey,
          notes: 'Export me',
          exactLocation: EXACT,
          exif: { camera: 'test' },
        })
        .expect(201);

      const logbookId = (lb.body as { id: string }).id;
      const [ce] = await db
        .insert(challengeEntries)
        .values({
          challengeId,
          userId,
          logbookEntryId: Number(logbookId),
          countryCode: 'GB',
          regionLabel: 'Scotland',
          photoKey,
          pledgeAcceptedAt: new Date('2026-11-21T00:00:00.000Z'),
          status: 'pending',
          publishAfter: new Date('2026-11-28T00:00:00.000Z'),
        })
        .returning({ id: challengeEntries.id });

      if (ce === undefined) {
        throw new Error('expected challenge entry');
      }

      return {
        userId,
        photoKey,
        thumbKey,
        watchlistId: (wl.body as { id: string }).id,
        logbookId,
        challengeEntryId: String(ce.id),
      };
    } finally {
      await pool.end();
    }
  }

  it('POST /v1/me/export returns JSON covering every user-owned record with signed photo links', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const seeded = await seedOwnedData();

    const response = await request(server)
      .post('/v1/me/export')
      .set('Authorization', 'Bearer token-a')
      .expect(200);

    const body = MeExportOkSchema.parse(response.body);
    expect(body.status).toBe('ready');
    expect(body.downloadUrl).toMatch(/^http:\/\/127\.0\.0\.1:3001\/v1\/uploads\/object\//);
    const downloadUrl = body.downloadUrl;
    if (downloadUrl === null) {
      throw new Error('expected downloadUrl');
    }

    const token = decodeURIComponent(downloadUrl.split('/').pop() ?? '');
    const fileRes = await request(server).get(`/v1/uploads/object/${encodeURIComponent(token)}`);
    expect(fileRes.status).toBe(200);
    const payload = JSON.parse(fileRes.text) as {
      user: { id: string; email: string | null };
      watchlist: Array<{ id: string }>;
      logbook: Array<{
        id: string;
        photoUrl: string;
        thumbUrl: string | null;
        exactLocation: { lat: number; lng: number } | null;
        notes: string | null;
      }>;
      challengeEntries: Array<{ id: string; photoUrl: string }>;
    };

    expect(payload.user.id).toBe(seeded.userId);
    expect(payload.user.email).toBe('account-a@example.com');
    expect(payload.watchlist.map((w) => w.id)).toContain(seeded.watchlistId);
    expect(payload.logbook).toHaveLength(1);
    expect(payload.logbook[0]?.id).toBe(seeded.logbookId);
    expect(payload.logbook[0]?.notes).toBe('Export me');
    expect(payload.logbook[0]?.exactLocation).toEqual(EXACT);
    expect(payload.logbook[0]?.photoUrl).toMatch(
      /^http:\/\/127\.0\.0\.1:3001\/v1\/uploads\/object\//,
    );
    expect(payload.logbook[0]?.thumbUrl).toMatch(
      /^http:\/\/127\.0\.0\.1:3001\/v1\/uploads\/object\//,
    );
    expect(payload.challengeEntries).toHaveLength(1);
    expect(payload.challengeEntries[0]?.id).toBe(seeded.challengeEntryId);
    expect(payload.challengeEntries[0]?.photoUrl).toMatch(
      /^http:\/\/127\.0\.0\.1:3001\/v1\/uploads\/object\//,
    );
  });

  it('DELETE /v1/me soft-deletes and blocks further auth; rows and files remain until purge', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const seeded = await seedOwnedData();

    const deleted = await request(server)
      .delete('/v1/me')
      .set('Authorization', 'Bearer token-a')
      .expect(200);
    expect(MeDeleteOkSchema.parse(deleted.body)).toEqual({ ok: true, purgeAfterDays: 30 });

    const denied = await request(server)
      .get('/v1/me')
      .set('Authorization', 'Bearer token-a')
      .expect(401);
    expect(denied.body).toMatchObject({ code: 'UNAUTHORIZED' });

    expect(await pathExists(join(storageRoot, seeded.photoKey))).toBe(true);

    const { db, pool } = createDb({ connectionString: DATABASE_URL });
    try {
      const userRows = await db
        .select({ id: users.id, deletedAt: users.deletedAt })
        .from(users)
        .where(eq(users.id, seeded.userId));
      expect(userRows).toHaveLength(1);
      expect(userRows[0]?.deletedAt).not.toBeNull();

      const wl = await db
        .select({ id: watchlist.id })
        .from(watchlist)
        .where(eq(watchlist.userId, seeded.userId));
      expect(wl).toHaveLength(1);

      const lb = await db
        .select({ id: logbookEntries.id })
        .from(logbookEntries)
        .where(eq(logbookEntries.userId, seeded.userId));
      expect(lb).toHaveLength(1);

      // Home region still resolvable from seed (sanity that seed ran).
      const scotland = await db
        .select({ id: regions.id })
        .from(regions)
        .where(eq(regions.slug, 'scotland'))
        .limit(1);
      expect(scotland[0]?.id).toBeDefined();
    } finally {
      await pool.end();
    }

    // Export and further deletes also fail once soft-deleted.
    await request(server).post('/v1/me/export').set('Authorization', 'Bearer token-a').expect(401);
    await request(server).delete('/v1/me').set('Authorization', 'Bearer token-a').expect(401);
  });
});

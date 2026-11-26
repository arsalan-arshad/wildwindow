import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  applyRoles,
  createDb,
  logbookEntries,
  migrationsFolder,
  roleConnectionUrl,
  runMigrations,
  taxa,
  users,
} from '@wildwindow/db';
import { and, eq, inArray } from 'drizzle-orm';
import { latLngToCell } from 'h3-js';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module.js';
import { FIREBASE_TOKEN_VERIFIER, type FirebaseTokenVerifier } from '../auth/token-verifier.js';
import { apiNestOptions } from '../bootstrap.js';

import { looksLikeCiphertext } from './logbook-crypto.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';
const API_PASSWORD = process.env['WW_API_DB_PASSWORD'] ?? 'ww_api_test_password';
const WORKER_PASSWORD = process.env['WW_WORKER_DB_PASSWORD'] ?? 'ww_worker_test_password';

const MOCK_UID_A = 'mock-firebase-uid-logbook-a';
const MOCK_UID_B = 'mock-firebase-uid-logbook-b';

const CELL_A = latLngToCell(55.86, -4.25, 7);
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

describe('T5.11 Logbook /v1/me/logbook', () => {
  let app: INestApplication;
  let previousEnv: Record<string, string | undefined>;
  let storageRoot: string;
  const mockVerifier = new MockTokenVerifier();
  let taxonId: string | undefined;
  let userAId: string | undefined;

  beforeAll(async () => {
    await runMigrations(DATABASE_URL, migrationsFolder());
    await applyRoles(DATABASE_URL, {
      apiPassword: API_PASSWORD,
      workerPassword: WORKER_PASSWORD,
    });

    storageRoot = await mkdtemp(join(tmpdir(), 'ww-logbook-e2e-'));

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
    process.env['STORAGE_SIGNING_SECRET'] = 'e2e-logbook-signing-secret';
    process.env['API_PUBLIC_URL'] = 'http://127.0.0.1:3001';
    // Explicit test key (32 bytes base64) — acceptance checks ciphertext at rest.
    process.env['LOGBOOK_ENC_KEY'] = Buffer.from(
      'ww-e2e-logbook-aes256-gcm-key!!!',
      'utf8',
    ).toString('base64');
    Reflect.deleteProperty(process.env, 'FIREBASE_PROJECT_ID');
    Reflect.deleteProperty(process.env, 'FIREBASE_SERVICE_ACCOUNT_JSON');

    mockVerifier.tokens.set('token-a', {
      uid: MOCK_UID_A,
      email: 'logbook-a@example.com',
      name: 'Logger A',
    });
    mockVerifier.tokens.set('token-b', {
      uid: MOCK_UID_B,
      email: 'logbook-b@example.com',
      name: 'Logger B',
    });

    const { db, pool } = createDb({ connectionString: DATABASE_URL });
    try {
      const suffix = Date.now() % 100_000_000;
      const inserted = await db
        .insert(taxa)
        .values({
          gbifTaxonKey: 1_910_000_000 + suffix,
          scientificName: `Logbook e2e taxon ${String(suffix)}`,
          commonNames: { en: 'Logbook bird' },
          group: 'bird',
          effortGroup: 'birds',
        })
        .returning({ id: taxa.id });
      taxonId = inserted[0] !== undefined ? String(inserted[0].id) : undefined;
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
        .where(inArray(users.firebaseUid, [MOCK_UID_A, MOCK_UID_B]));
      const ids = rows.map((row) => row.id);
      if (ids.length > 0) {
        await db.delete(logbookEntries).where(inArray(logbookEntries.userId, ids));
      }
      await db.delete(users).where(eq(users.firebaseUid, MOCK_UID_A));
      await db.delete(users).where(eq(users.firebaseUid, MOCK_UID_B));
      userAId = undefined;
    } finally {
      await pool.end();
    }
  });

  afterAll(async () => {
    await app.close();
    if (taxonId !== undefined) {
      const { db, pool } = createDb({ connectionString: DATABASE_URL });
      try {
        await db.delete(taxa).where(eq(taxa.id, Number(taxonId)));
      } finally {
        await pool.end();
      }
    }
    await rm(storageRoot, { recursive: true, force: true });
    restoreEnv(previousEnv);
  });

  async function ensureUserAPhoto(photoName = 'shot.jpg'): Promise<{
    readonly userId: string;
    readonly photoKey: string;
    readonly thumbKey: string;
  }> {
    // Hit an auth route so FirebaseAuthGuard upserts the user.
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server).get('/v1/me').set('Authorization', 'Bearer token-a').expect(200);

    const { db, pool } = createDb({
      connectionString: roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD),
    });
    try {
      const rows = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.firebaseUid, MOCK_UID_A))
        .limit(1);
      const id = rows[0]?.id;
      if (id === undefined) {
        throw new Error('expected user A after /v1/me');
      }
      userAId = id;
      const photoKey = `uploads/${id}/${photoName}`;
      const thumbKey = `uploads/${id}/thumb-${photoName}`;
      const { mkdir } = await import('node:fs/promises');
      await mkdir(join(storageRoot, 'uploads', id), { recursive: true });
      await writeFile(join(storageRoot, 'uploads', id, photoName), Buffer.from('fake-jpeg'));
      await writeFile(
        join(storageRoot, 'uploads', id, `thumb-${photoName}`),
        Buffer.from('fake-thumb'),
      );
      return { userId: id, photoKey, thumbKey };
    } finally {
      await pool.end();
    }
  }

  it('GET /v1/me/logbook without token → 401', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server).get('/v1/me/logbook').expect(401);
    expect(response.body).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('owner can read exact point; other user gets 404; DB stores ciphertext', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    if (taxonId === undefined) {
      throw new Error('expected seeded taxon');
    }
    const { photoKey, thumbKey } = await ensureUserAPhoto();

    const created = await request(server)
      .post('/v1/me/logbook')
      .set('Authorization', 'Bearer token-a')
      .send({
        taxonId,
        takenAt: '2026-11-26T08:00:00.000Z',
        cellR7: CELL_A,
        photoKey,
        thumbKey,
        notes: 'Kingfisher at dawn',
        exactLocation: EXACT,
        exif: { camera: 'test' },
      })
      .expect(201);

    const body = created.body as {
      id: string;
      exactLocation: { lat: number; lng: number } | null;
      notes: string | null;
    };
    expect(body.exactLocation).toEqual(EXACT);
    expect(body.notes).toBe('Kingfisher at dawn');
    const entryId = body.id;

    const got = await request(server)
      .get(`/v1/me/logbook/${entryId}`)
      .set('Authorization', 'Bearer token-a')
      .expect(200);
    expect(got.body).toMatchObject({ id: entryId, exactLocation: EXACT });

    // List omits exact coordinates (public schema).
    const listed = await request(server)
      .get('/v1/me/logbook')
      .set('Authorization', 'Bearer token-a')
      .expect(200);
    const listBody = listed.body as { items: Array<Record<string, unknown>> };
    expect(listBody.items).toHaveLength(1);
    expect(listBody.items[0]).not.toHaveProperty('exactLocation');
    expect(listBody.items[0]).not.toHaveProperty('lat');
    expect(listBody.items[0]).not.toHaveProperty('lng');

    // Other user: 404, not 403 (no existence leak).
    await request(server).get('/v1/me').set('Authorization', 'Bearer token-b').expect(200);
    const denied = await request(server)
      .get(`/v1/me/logbook/${entryId}`)
      .set('Authorization', 'Bearer token-b')
      .expect(404);
    expect(denied.body).toMatchObject({ code: 'NOT_FOUND' });

    const patchDenied = await request(server)
      .patch(`/v1/me/logbook/${entryId}`)
      .set('Authorization', 'Bearer token-b')
      .send({ notes: 'nope' })
      .expect(404);
    expect(patchDenied.body).toMatchObject({ code: 'NOT_FOUND' });

    // Database row stores ciphertext, not plaintext lat/lng.
    const { db, pool } = createDb({
      connectionString: roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD),
    });
    try {
      const rows = await db
        .select({
          exactPointEnc: logbookEntries.exactPointEnc,
          userId: logbookEntries.userId,
        })
        .from(logbookEntries)
        .where(
          and(eq(logbookEntries.id, Number(entryId)), eq(logbookEntries.userId, userAId ?? '')),
        )
        .limit(1);
      const enc = rows[0]?.exactPointEnc;
      expect(enc).toBeInstanceOf(Buffer);
      if (!(enc instanceof Buffer)) {
        return;
      }
      expect(looksLikeCiphertext(enc)).toBe(true);
      expect(enc.toString('utf8')).not.toContain(String(EXACT.lat));
      expect(enc.toString('utf8')).not.toContain('"lat"');
      expect(enc.toString('utf8')).not.toContain('"lng"');
    } finally {
      await pool.end();
    }
  });

  it('DELETE removes the row and photo objects', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const { photoKey, thumbKey, userId } = await ensureUserAPhoto('to-delete.jpg');

    const created = await request(server)
      .post('/v1/me/logbook')
      .set('Authorization', 'Bearer token-a')
      .send({
        takenAt: '2026-11-26T09:00:00.000Z',
        photoKey,
        thumbKey,
        exactLocation: EXACT,
      })
      .expect(201);
    const entryId = (created.body as { id: string }).id;

    await request(server)
      .delete(`/v1/me/logbook/${entryId}`)
      .set('Authorization', 'Bearer token-a')
      .expect(204);

    await request(server)
      .get(`/v1/me/logbook/${entryId}`)
      .set('Authorization', 'Bearer token-a')
      .expect(404);

    const { readFile } = await import('node:fs/promises');
    await expect(
      readFile(join(storageRoot, 'uploads', userId, 'to-delete.jpg')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(
      readFile(join(storageRoot, 'uploads', userId, 'thumb-to-delete.jpg')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

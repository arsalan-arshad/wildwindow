import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  applyRoles,
  createDb,
  migrationsFolder,
  regions,
  roleConnectionUrl,
  runMigrations,
  users,
} from '@wildwindow/db';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module.js';
import { apiNestOptions } from '../bootstrap.js';

import { FIREBASE_TOKEN_VERIFIER, type FirebaseTokenVerifier } from './token-verifier.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';
const API_PASSWORD = process.env['WW_API_DB_PASSWORD'] ?? 'ww_api_test_password';
const WORKER_PASSWORD = process.env['WW_WORKER_DB_PASSWORD'] ?? 'ww_worker_test_password';

const MOCK_UID_USER = 'mock-firebase-uid-user';
const MOCK_UID_ADMIN = 'mock-firebase-uid-admin';
const MOCK_EMAIL_USER = 'user@example.com';
const MOCK_EMAIL_ADMIN = 'admin@example.com';

/** In-memory verifier: token string maps to a uid (+ optional email). */
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

describe('T5.8 Firebase auth + /v1/me + admin role', () => {
  let app: INestApplication;
  let previousEnv: Record<string, string | undefined>;
  const mockVerifier = new MockTokenVerifier();

  beforeAll(async () => {
    await runMigrations(DATABASE_URL, migrationsFolder());
    await applyRoles(DATABASE_URL, {
      apiPassword: API_PASSWORD,
      workerPassword: WORKER_PASSWORD,
    });

    previousEnv = {
      DATABASE_URL_API: process.env['DATABASE_URL_API'],
      NODE_ENV: process.env['NODE_ENV'],
      WAITLIST_THROTTLE_DISABLED: process.env['WAITLIST_THROTTLE_DISABLED'],
      FIREBASE_PROJECT_ID: process.env['FIREBASE_PROJECT_ID'],
      FIREBASE_SERVICE_ACCOUNT_JSON: process.env['FIREBASE_SERVICE_ACCOUNT_JSON'],
    };

    process.env['DATABASE_URL_API'] = roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD);
    process.env['NODE_ENV'] = 'test';
    process.env['WAITLIST_THROTTLE_DISABLED'] = '1';
    // Leave Firebase env unset — e2e uses the mock verifier only.
    Reflect.deleteProperty(process.env, 'FIREBASE_PROJECT_ID');
    Reflect.deleteProperty(process.env, 'FIREBASE_SERVICE_ACCOUNT_JSON');

    mockVerifier.tokens.set('token-user', {
      uid: MOCK_UID_USER,
      email: MOCK_EMAIL_USER,
      name: 'Test User',
    });
    mockVerifier.tokens.set('token-admin', {
      uid: MOCK_UID_ADMIN,
      email: MOCK_EMAIL_ADMIN,
      name: 'Admin User',
    });
    mockVerifier.tokens.set('token-bad', { uid: '' });

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
      await db.delete(users).where(eq(users.firebaseUid, MOCK_UID_USER));
      await db.delete(users).where(eq(users.firebaseUid, MOCK_UID_ADMIN));
    } finally {
      await pool.end();
    }
  });

  afterAll(async () => {
    await app.close();
    restoreEnv(previousEnv);
  });

  it('GET /v1/me without token → 401 UNAUTHORIZED', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server).get('/v1/me').expect(401);
    expect(response.body).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('GET /v1/me with mocked token upserts user and returns profile', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server)
      .get('/v1/me')
      .set('Authorization', 'Bearer token-user')
      .expect(200);

    expect(response.body).toMatchObject({
      displayName: 'Test User',
      homeRegionSlug: null,
      locale: 'en',
      role: 'user',
    });
    const body = response.body as { id: string };
    expect(typeof body.id).toBe('string');

    const { db, pool } = createDb({
      connectionString: roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD),
    });
    try {
      const rows = await db.select().from(users).where(eq(users.firebaseUid, MOCK_UID_USER));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.email).toBe(MOCK_EMAIL_USER);
    } finally {
      await pool.end();
    }
  });

  it('PATCH /v1/me updates locale and displayName', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server).get('/v1/me').set('Authorization', 'Bearer token-user').expect(200);

    const patched = await request(server)
      .patch('/v1/me')
      .set('Authorization', 'Bearer token-user')
      .send({ locale: 'ur', displayName: 'Patched' })
      .expect(200);

    expect(patched.body).toMatchObject({
      locale: 'ur',
      displayName: 'Patched',
      homeRegionSlug: null,
      role: 'user',
    });
  });

  it('PATCH /v1/me can set homeRegionSlug when the region exists', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server).get('/v1/me').set('Authorization', 'Bearer token-user').expect(200);

    const { db, pool } = createDb({ connectionString: DATABASE_URL });
    try {
      const regionRows = await db
        .select({ id: regions.id })
        .from(regions)
        .where(eq(regions.slug, 'scotland'))
        .limit(1);
      if (regionRows[0] === undefined) {
        await pool.query(`
          INSERT INTO ref.regions (slug, name, country_code, time_zone, geom, min_res)
          VALUES (
            'scotland',
            'Scotland',
            'GB',
            'Europe/London',
            ST_GeomFromText('MULTIPOLYGON((( -5 55, -5 56, -4 56, -4 55, -5 55)))', 4326),
            3
          )
          ON CONFLICT DO NOTHING
        `);
      }
    } finally {
      await pool.end();
    }

    const patched = await request(server)
      .patch('/v1/me')
      .set('Authorization', 'Bearer token-user')
      .send({ homeRegionSlug: 'scotland' })
      .expect(200);

    expect(patched.body).toMatchObject({
      homeRegionSlug: 'scotland',
      role: 'user',
    });
  });

  it('GET /v1/admin/session as non-admin → 403 FORBIDDEN', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server).get('/v1/me').set('Authorization', 'Bearer token-user').expect(200);

    const response = await request(server)
      .get('/v1/admin/session')
      .set('Authorization', 'Bearer token-user')
      .expect(403);
    expect(response.body).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('GET /v1/admin/session as admin → 200', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    // Upsert via /v1/me first.
    await request(server).get('/v1/me').set('Authorization', 'Bearer token-admin').expect(200);

    const { db, pool } = createDb({
      connectionString: roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD),
    });
    try {
      await db
        .update(users)
        .set({ role: 'admin' })
        .where(eq(users.firebaseUid, MOCK_UID_ADMIN));
    } finally {
      await pool.end();
    }

    const response = await request(server)
      .get('/v1/admin/session')
      .set('Authorization', 'Bearer token-admin')
      .expect(200);
    expect(response.body).toMatchObject({ ok: true, role: 'admin' });
    const body = response.body as { userId: string };
    expect(typeof body.userId).toBe('string');
  });

  it('invalid mocked token → 401', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server)
      .get('/v1/me')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);
    expect(response.body).toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

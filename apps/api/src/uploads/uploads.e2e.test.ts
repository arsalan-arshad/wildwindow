import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  applyRoles,
  createDb,
  migrationsFolder,
  roleConnectionUrl,
  runMigrations,
  users,
} from '@wildwindow/db';
import {
  PresignUploadResponseSchema,
  UPLOAD_MAX_BYTES,
  type PresignUploadResponse,
} from '@wildwindow/shared';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module.js';
import { FIREBASE_TOKEN_VERIFIER, type FirebaseTokenVerifier } from '../auth/token-verifier.js';
import { apiNestOptions } from '../bootstrap.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';
const API_PASSWORD = process.env['WW_API_DB_PASSWORD'] ?? 'ww_api_test_password';
const WORKER_PASSWORD = process.env['WW_WORKER_DB_PASSWORD'] ?? 'ww_worker_test_password';

const MOCK_UID = 'mock-firebase-uid-uploads';
const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__');
const jpegWithGps = readFileSync(join(fixturesDir, 'jpeg-with-gps.jpg'));
const jpegNoGps = readFileSync(join(fixturesDir, 'jpeg-no-gps.jpg'));

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

describe('T5.10 uploads + storage + GPS EXIF', () => {
  let app: INestApplication;
  let previousEnv: Record<string, string | undefined>;
  let storageRoot: string;
  const mockVerifier = new MockTokenVerifier();

  beforeAll(async () => {
    await runMigrations(DATABASE_URL, migrationsFolder());
    await applyRoles(DATABASE_URL, {
      apiPassword: API_PASSWORD,
      workerPassword: WORKER_PASSWORD,
    });

    storageRoot = await mkdtemp(join(tmpdir(), 'ww-uploads-e2e-'));

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
    };

    process.env['DATABASE_URL_API'] = roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD);
    process.env['NODE_ENV'] = 'test';
    process.env['WAITLIST_THROTTLE_DISABLED'] = '1';
    process.env['STORAGE_DRIVER'] = 'local';
    process.env['LOCAL_STORAGE_DIR'] = storageRoot;
    process.env['STORAGE_SIGNING_SECRET'] = 'e2e-uploads-signing-secret';
    process.env['API_PUBLIC_URL'] = 'http://127.0.0.1:3001';
    Reflect.deleteProperty(process.env, 'FIREBASE_PROJECT_ID');
    Reflect.deleteProperty(process.env, 'FIREBASE_SERVICE_ACCOUNT_JSON');

    mockVerifier.tokens.set('token-uploader', {
      uid: MOCK_UID,
      email: 'uploader@example.com',
      name: 'Uploader',
    });

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
      await db.delete(users).where(eq(users.firebaseUid, MOCK_UID));
    } finally {
      await pool.end();
    }
  });

  afterAll(async () => {
    await app.close();
    restoreEnv(previousEnv);
    await rm(storageRoot, { recursive: true, force: true });
  });

  it('requires auth for presign and validates MIME / size', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server).post('/v1/uploads/presign').send({}).expect(401);

    const tooBig = await request(server)
      .post('/v1/uploads/presign')
      .set('Authorization', 'Bearer token-uploader')
      .send({ mimeType: 'image/jpeg', byteSize: UPLOAD_MAX_BYTES + 1 })
      .expect(400);
    expect(tooBig.body).toMatchObject({ code: 'VALIDATION_ERROR' });

    const badMime = await request(server)
      .post('/v1/uploads/presign')
      .set('Authorization', 'Bearer token-uploader')
      .send({ mimeType: 'image/png', byteSize: 100 })
      .expect(400);
    expect(badMime.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects a fixture JPEG with GPS and accepts one without GPS', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    const withGpsPresignRes = await request(server)
      .post('/v1/uploads/presign')
      .set('Authorization', 'Bearer token-uploader')
      .send({ mimeType: 'image/jpeg', byteSize: jpegWithGps.byteLength })
      .expect(201);
    const withGpsPresign: PresignUploadResponse = PresignUploadResponseSchema.parse(
      withGpsPresignRes.body,
    );

    expect(withGpsPresign.photoKey).toMatch(/^uploads\/.+\/.+\.jpg$/);
    expect(withGpsPresign.uploadUrl).toContain('/v1/uploads/put/');
    expect(typeof withGpsPresign.expiresAt).toBe('string');

    const withGpsUrl = new URL(withGpsPresign.uploadUrl);
    const withGpsPut = await request(server)
      .put(withGpsUrl.pathname)
      .set('Content-Type', 'image/jpeg')
      .set('Content-Length', String(jpegWithGps.byteLength))
      .send(jpegWithGps)
      .expect(400);
    expect(withGpsPut.body).toMatchObject({
      code: 'GPS_EXIF_FORBIDDEN',
    });
    const gpsBody = withGpsPut.body as { message?: unknown };
    expect(typeof gpsBody.message).toBe('string');
    expect(String(gpsBody.message)).toMatch(/GPS EXIF/i);

    const noGpsPresignRes = await request(server)
      .post('/v1/uploads/presign')
      .set('Authorization', 'Bearer token-uploader')
      .send({ mimeType: 'image/jpeg', byteSize: jpegNoGps.byteLength })
      .expect(201);
    const noGpsPresign: PresignUploadResponse = PresignUploadResponseSchema.parse(
      noGpsPresignRes.body,
    );

    const noGpsUrl = new URL(noGpsPresign.uploadUrl);
    const noGpsPut = await request(server)
      .put(noGpsUrl.pathname)
      .set('Content-Type', 'image/jpeg')
      .set('Content-Length', String(jpegNoGps.byteLength))
      .send(jpegNoGps)
      .expect(200);
    expect(noGpsPut.body).toEqual({
      ok: true,
      photoKey: noGpsPresign.photoKey,
    });
  });
});

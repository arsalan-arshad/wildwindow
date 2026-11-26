import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  applyRoles,
  createDb,
  migrationsFolder,
  roleConnectionUrl,
  runMigrations,
  taxa,
  users,
  watchlist,
} from '@wildwindow/db';
import { and, eq, inArray } from 'drizzle-orm';
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

const MOCK_UID_A = 'mock-firebase-uid-watchlist-a';
const MOCK_UID_B = 'mock-firebase-uid-watchlist-b';

/** Glasgow / Karachi / Edinburgh-ish res-7 cells for distinct pairs. */
const CELL_A = latLngToCell(55.86, -4.25, 7);
const CELL_B = latLngToCell(55.95, -3.19, 7);
const CELL_C = latLngToCell(24.86, 67.01, 7);
const CELL_D = latLngToCell(56.4, -5.0, 7);

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

describe('T5.9 Watchlist /v1/me/watchlist', () => {
  let app: INestApplication;
  let previousEnv: Record<string, string | undefined>;
  const mockVerifier = new MockTokenVerifier();
  let taxonIds: string[] = [];

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
      WATCHLIST_LIMIT_FREE: process.env['WATCHLIST_LIMIT_FREE'],
      FIREBASE_PROJECT_ID: process.env['FIREBASE_PROJECT_ID'],
      FIREBASE_SERVICE_ACCOUNT_JSON: process.env['FIREBASE_SERVICE_ACCOUNT_JSON'],
    };

    process.env['DATABASE_URL_API'] = roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD);
    process.env['NODE_ENV'] = 'test';
    process.env['WAITLIST_THROTTLE_DISABLED'] = '1';
    process.env['WATCHLIST_LIMIT_FREE'] = '3';
    Reflect.deleteProperty(process.env, 'FIREBASE_PROJECT_ID');
    Reflect.deleteProperty(process.env, 'FIREBASE_SERVICE_ACCOUNT_JSON');

    mockVerifier.tokens.set('token-a', {
      uid: MOCK_UID_A,
      email: 'watchlist-a@example.com',
      name: 'Watcher A',
    });
    mockVerifier.tokens.set('token-b', {
      uid: MOCK_UID_B,
      email: 'watchlist-b@example.com',
      name: 'Watcher B',
    });

    // Seed four taxa for distinct watchlist pairs (owner connection).
    const { db, pool } = createDb({ connectionString: DATABASE_URL });
    try {
      const suffix = Date.now() % 100_000_000;
      const inserted = await db
        .insert(taxa)
        .values(
          [0, 1, 2, 3].map((i) => ({
            gbifTaxonKey: 1_900_000_000 + suffix + i,
            scientificName: `Watchlist e2e taxon ${String(i)}`,
            commonNames: { en: `Watch bird ${String(i)}` },
            group: 'bird',
            effortGroup: 'birds',
          })),
        )
        .returning({ id: taxa.id });
      taxonIds = inserted.map((row) => String(row.id));
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
        await db.delete(watchlist).where(inArray(watchlist.userId, ids));
      }
      await db.delete(users).where(eq(users.firebaseUid, MOCK_UID_A));
      await db.delete(users).where(eq(users.firebaseUid, MOCK_UID_B));
    } finally {
      await pool.end();
    }
  });

  afterAll(async () => {
    await app.close();
    if (taxonIds.length > 0) {
      const { db, pool } = createDb({ connectionString: DATABASE_URL });
      try {
        await db.delete(taxa).where(
          inArray(
            taxa.id,
            taxonIds.map((id) => Number(id)),
          ),
        );
      } finally {
        await pool.end();
      }
    }
    restoreEnv(previousEnv);
  });

  it('GET /v1/me/watchlist without token → 401', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server).get('/v1/me/watchlist').expect(401);
    expect(response.body).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('4th item → 409 WATCHLIST_LIMIT; list returns only own items', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const [t0, t1, t2, t3] = taxonIds;
    if (t0 === undefined || t1 === undefined || t2 === undefined || t3 === undefined) {
      throw new Error('expected four seeded taxa');
    }

    const pairs = [
      { taxonId: t0, cellR7: CELL_A },
      { taxonId: t1, cellR7: CELL_B },
      { taxonId: t2, cellR7: CELL_C },
    ];

    for (const pair of pairs) {
      const created = await request(server)
        .post('/v1/me/watchlist')
        .set('Authorization', 'Bearer token-a')
        .send(pair)
        .expect(201);
      expect(created.body).toMatchObject({
        taxonId: pair.taxonId,
        cellR7: pair.cellR7,
      });
      expect(typeof (created.body as { id: string }).id).toBe('string');
      expect(typeof (created.body as { createdAt: string }).createdAt).toBe('string');
    }

    const limited = await request(server)
      .post('/v1/me/watchlist')
      .set('Authorization', 'Bearer token-a')
      .send({ taxonId: t3, cellR7: CELL_D })
      .expect(409);
    expect(limited.body).toMatchObject({ code: 'WATCHLIST_LIMIT' });

    const listed = await request(server)
      .get('/v1/me/watchlist')
      .set('Authorization', 'Bearer token-a')
      .expect(200);
    expect(listed.body).toMatchObject({ limit: 3 });
    const body = listed.body as { items: Array<{ taxonId: string; cellR7: string }> };
    expect(body.items).toHaveLength(3);
    expect(body.items.map((item) => item.taxonId).sort()).toEqual([t0, t1, t2].sort());
  });

  it('users cannot see or delete each other’s items', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const taxonId = taxonIds[0];
    if (taxonId === undefined) {
      throw new Error('expected seeded taxon');
    }

    const created = await request(server)
      .post('/v1/me/watchlist')
      .set('Authorization', 'Bearer token-a')
      .send({ taxonId, cellR7: CELL_A })
      .expect(201);
    const itemId = (created.body as { id: string }).id;

    // User B’s list is empty — no cross-user leak.
    const bList = await request(server)
      .get('/v1/me/watchlist')
      .set('Authorization', 'Bearer token-b')
      .expect(200);
    expect(bList.body).toMatchObject({ items: [], limit: 3 });

    // User B cannot delete A’s item (404, not 403 — no existence leak).
    const denied = await request(server)
      .delete(`/v1/me/watchlist/${itemId}`)
      .set('Authorization', 'Bearer token-b')
      .expect(404);
    expect(denied.body).toMatchObject({ code: 'NOT_FOUND' });

    // Item still present for A.
    const aList = await request(server)
      .get('/v1/me/watchlist')
      .set('Authorization', 'Bearer token-a')
      .expect(200);
    const aBody = aList.body as { items: Array<{ id: string }> };
    expect(aBody.items.map((item) => item.id)).toContain(itemId);

    // Owner can delete.
    await request(server)
      .delete(`/v1/me/watchlist/${itemId}`)
      .set('Authorization', 'Bearer token-a')
      .expect(204);

    const after = await request(server)
      .get('/v1/me/watchlist')
      .set('Authorization', 'Bearer token-a')
      .expect(200);
    expect((after.body as { items: unknown[] }).items).toHaveLength(0);

    // Confirm DB row is gone (and never visible under B’s user_id filter).
    const { db, pool } = createDb({
      connectionString: roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD),
    });
    try {
      const userA = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.firebaseUid, MOCK_UID_A))
        .limit(1);
      const aId = userA[0]?.id;
      expect(aId).toBeDefined();
      if (aId === undefined) {
        return;
      }
      const leftover = await db
        .select({ id: watchlist.id })
        .from(watchlist)
        .where(and(eq(watchlist.userId, aId), eq(watchlist.id, Number(itemId))));
      expect(leftover).toHaveLength(0);
    } finally {
      await pool.end();
    }
  });

  it('POST with invalid cellR7 → 400 VALIDATION_ERROR', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const taxonId = taxonIds[0];
    if (taxonId === undefined) {
      throw new Error('expected seeded taxon');
    }

    const response = await request(server)
      .post('/v1/me/watchlist')
      .set('Authorization', 'Bearer token-a')
      .send({ taxonId, cellR7: 'not-a-cell' })
      .expect(400);
    expect(response.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

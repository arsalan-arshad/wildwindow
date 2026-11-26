/**
 * T10.2 Kingfisher Month go-live acceptance:
 * dry run with 5 test entries — submitted → approved → visible after 7 days (test clock).
 */
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  applyRoles,
  auditLog,
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
  AdminChallengeEntrySchema,
  ChallengeEntriesResponseSchema,
  ChallengeSubmitOkSchema,
  loadChallengeSeedFile,
} from '@wildwindow/shared';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module.js';
import { FIREBASE_TOKEN_VERIFIER, type FirebaseTokenVerifier } from '../auth/token-verifier.js';
import { apiNestOptions } from '../bootstrap.js';

import { CHALLENGE_PUBLISH_DELAY_MS, ChallengesService } from './challenges.service.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';
const API_PASSWORD = process.env['WW_API_DB_PASSWORD'] ?? 'ww_api_test_password';
const WORKER_PASSWORD = process.env['WW_WORKER_DB_PASSWORD'] ?? 'ww_worker_test_password';

const KINGFISHER_SEED_SLUG = 'kingfisher-month-2026-11';
/** Isolated dry-run challenge (same taxon / rules shape as Kingfisher Month). */
const DRY_RUN_SLUG = `kingfisher-golive-dryrun-${String(Date.now() % 1_000_000)}`;

const MOCK_UID_ADMIN = 'mock-firebase-uid-t102-admin';
const SUBMITTERS = [
  { token: 'token-s0', uid: 'mock-firebase-uid-t102-s0', country: 'GB', region: 'Scotland' },
  { token: 'token-s1', uid: 'mock-firebase-uid-t102-s1', country: 'GB', region: 'Scotland' },
  { token: 'token-s2', uid: 'mock-firebase-uid-t102-s2', country: 'PK', region: 'Sindh' },
  { token: 'token-s3', uid: 'mock-firebase-uid-t102-s3', country: 'PK', region: 'Sindh' },
  { token: 'token-s4', uid: 'mock-firebase-uid-t102-s4', country: 'GB', region: 'Scotland' },
] as const;

/** Fixed submit instant — mid Kingfisher Month window. */
const T0 = new Date('2026-11-10T12:00:00.000Z');
const BEFORE_PUBLISH = new Date(T0.getTime() + CHALLENGE_PUBLISH_DELAY_MS - 60_000);
const AT_PUBLISH = new Date(T0.getTime() + CHALLENGE_PUBLISH_DELAY_MS);

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

/** Mutable test clock for ChallengesService (ARCHITECTURE: pass `now` in). */
class TestClock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current.getTime());
  }

  set(next: Date): void {
    this.current = new Date(next.getTime());
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

describe('T10.2 Kingfisher Month go-live dry run', () => {
  let app: INestApplication;
  let previousEnv: Record<string, string | undefined>;
  let storageRoot: string;
  const mockVerifier = new MockTokenVerifier();
  let taxonId: number;
  let challengeId: number;
  const clock = new TestClock(T0);

  beforeAll(async () => {
    await runMigrations(DATABASE_URL, migrationsFolder());
    await applyRoles(DATABASE_URL, {
      apiPassword: API_PASSWORD,
      workerPassword: WORKER_PASSWORD,
    });
    await seedAll(DATABASE_URL);

    storageRoot = await mkdtemp(join(tmpdir(), 'ww-t102-golive-'));

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
    process.env['STORAGE_SIGNING_SECRET'] = 'e2e-t102-golive-signing';
    process.env['API_PUBLIC_URL'] = 'http://127.0.0.1:3001';
    process.env['LOGBOOK_ENC_KEY'] = Buffer.from(
      'ww-e2e-t102-golive-aes256-gcm!!!',
      'utf8',
    ).toString('base64');
    Reflect.deleteProperty(process.env, 'FIREBASE_PROJECT_ID');
    Reflect.deleteProperty(process.env, 'FIREBASE_SERVICE_ACCOUNT_JSON');

    mockVerifier.tokens.set('token-admin', {
      uid: MOCK_UID_ADMIN,
      email: 't102-admin@example.com',
      name: 'T10.2 Admin',
    });
    for (const s of SUBMITTERS) {
      mockVerifier.tokens.set(s.token, {
        uid: s.uid,
        email: `${s.uid}@example.com`,
        name: `Submitter ${s.uid.slice(-2)}`,
      });
    }

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

      // Keep seed dates intact; isolate dry-run on its own live row.
      await db
        .update(challenges)
        .set({ status: 'closed' })
        .where(and(ne(challenges.slug, KINGFISHER_SEED_SLUG), inLiveStatus(challenges.status)));

      const inserted = await db
        .insert(challenges)
        .values({
          slug: DRY_RUN_SLUG,
          title: 'Kingfisher Month (T10.2 dry run)',
          taxonId: kf.id,
          startsOn: '2026-11-01',
          endsOn: '2026-11-30',
          rulesMd:
            '## Rules\n\nDry-run ethics pledge: no baiting, no playback, no nest disturbance.',
          status: 'live',
        })
        .returning({ id: challenges.id });
      const row = inserted[0];
      if (row === undefined) {
        throw new Error('expected dry-run challenge insert');
      }
      challengeId = row.id;
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

  afterAll(async () => {
    const { db, pool } = createDb({ connectionString: DATABASE_URL });
    try {
      await db.delete(challengeEntries).where(eq(challengeEntries.challengeId, challengeId));
      await db.delete(challenges).where(eq(challenges.id, challengeId));
      const uids = [MOCK_UID_ADMIN, ...SUBMITTERS.map((s) => s.uid)];
      const userRows = await db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.firebaseUid, uids));
      const ids = userRows.map((r) => r.id);
      if (ids.length > 0) {
        await db.delete(auditLog).where(inArray(auditLog.actorUserId, ids));
        await db.delete(logbookEntries).where(inArray(logbookEntries.userId, ids));
      }
      await db.delete(users).where(inArray(users.firebaseUid, uids));
      // Restore seed challenge to live for sibling suites.
      await db
        .update(challenges)
        .set({
          startsOn: '2026-11-01',
          endsOn: '2026-11-30',
          status: 'live',
        })
        .where(eq(challenges.slug, KINGFISHER_SEED_SLUG));
    } finally {
      await pool.end();
    }
    await app.close();
    await rm(storageRoot, { recursive: true, force: true });
    restoreEnv(previousEnv);
  });

  it('committed Kingfisher Month seed has go-live dates set', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const repoRoot = resolve(here, '../../../..');
    const seed = loadChallengeSeedFile(
      join(repoRoot, 'data', 'challenges', 'kingfisher-month.yaml'),
    );
    expect(seed.slug).toBe(KINGFISHER_SEED_SLUG);
    expect(seed.startsOn).toBe('2026-11-01');
    expect(seed.endsOn).toBe('2026-11-30');
    expect(seed.status).toBe('live');
    expect(seed.regions).toEqual(['scotland', 'sindh']);
  });

  it('5 entries: submitted → approved → visible after 7 days (test clock)', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const challengesService = app.get(ChallengesService);
    clock.set(T0);

    // Promote admin.
    await request(server).get('/v1/me').set('Authorization', 'Bearer token-admin').expect(200);
    const { db: apiDb, pool: apiPool } = createDb({
      connectionString: roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD),
    });
    try {
      await apiDb.update(users).set({ role: 'admin' }).where(eq(users.firebaseUid, MOCK_UID_ADMIN));
    } finally {
      await apiPool.end();
    }

    const submittedIds: string[] = [];

    for (const submitter of SUBMITTERS) {
      await request(server)
        .get('/v1/me')
        .set('Authorization', `Bearer ${submitter.token}`)
        .expect(200);

      const { db, pool } = createDb({
        connectionString: roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD),
      });
      let userId: string;
      try {
        const rows = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.firebaseUid, submitter.uid))
          .limit(1);
        const row = rows[0];
        if (row === undefined) {
          throw new Error(`expected user for ${submitter.uid}`);
        }
        userId = row.id;
      } finally {
        await pool.end();
      }

      const photoKey = `uploads/${userId}/kingfisher-dryrun.jpg`;
      await mkdir(join(storageRoot, 'uploads', userId), { recursive: true });
      await writeFile(
        join(storageRoot, 'uploads', userId, 'kingfisher-dryrun.jpg'),
        Buffer.from('fake-jpeg'),
      );

      const logbook = await request(server)
        .post('/v1/me/logbook')
        .set('Authorization', `Bearer ${submitter.token}`)
        .send({
          taxonId: String(taxonId),
          takenAt: '2026-11-08T09:00:00.000Z',
          photoKey,
          notes: 'T10.2 dry-run kingfisher',
        })
        .expect(201);
      const logbookEntryId = (logbook.body as { id: string }).id;

      // Submit via service with the test clock (sets publish_after from T0).
      const created = await challengesService.submit(
        DRY_RUN_SLUG,
        userId,
        {
          logbookEntryId,
          pledgeAccepted: true,
          countryCode: submitter.country,
          regionLabel: submitter.region,
        },
        clock.now(),
      );
      const parsed = ChallengeSubmitOkSchema.parse(created);
      expect(parsed.status).toBe('pending');
      expect(new Date(parsed.publishAfter).getTime()).toBe(AT_PUBLISH.getTime());
      submittedIds.push(parsed.id);
    }

    expect(submittedIds).toHaveLength(5);

    // Pending → not in public gallery (even at publish time).
    clock.set(AT_PUBLISH);
    const pendingList = await challengesService.listEntries(DRY_RUN_SLUG, {}, clock.now());
    expect(ChallengeEntriesResponseSchema.parse(pendingList).entries).toEqual([]);

    // Approve all five via admin API.
    for (const entryId of submittedIds) {
      const approved = await request(server)
        .patch(`/v1/admin/challenge-entries/${entryId}`)
        .set('Authorization', 'Bearer token-admin')
        .send({ status: 'approved' })
        .expect(200);
      expect(AdminChallengeEntrySchema.parse(approved.body).status).toBe('approved');
    }

    // Approved but clock still before publish_after → still hidden.
    clock.set(BEFORE_PUBLISH);
    const early = await challengesService.listEntries(DRY_RUN_SLUG, {}, clock.now());
    expect(ChallengeEntriesResponseSchema.parse(early).entries).toEqual([]);

    // Advance test clock past 7 days → all five visible.
    clock.set(AT_PUBLISH);
    const visible = await challengesService.listEntries(DRY_RUN_SLUG, {}, clock.now());
    const listed = ChallengeEntriesResponseSchema.parse(visible);
    expect(listed.entries).toHaveLength(5);

    const ids = new Set(listed.entries.map((e) => e.id));
    for (const id of submittedIds) {
      expect(ids.has(id)).toBe(true);
    }

    for (const entry of listed.entries) {
      expect(entry.countryCode === 'GB' || entry.countryCode === 'PK').toBe(true);
      expect(entry.regionLabel === 'Scotland' || entry.regionLabel === 'Sindh').toBe(true);
      expect(entry.photoUrl).toMatch(/^http/);
      expect(entry).not.toHaveProperty('lat');
      expect(entry).not.toHaveProperty('lng');
      expect(entry).not.toHaveProperty('cellR7');
      expect(entry).not.toHaveProperty('photoKey');
    }

    assertPublicSafe(listed, {
      maxResolutionByTier: { open: TIER_POLICY.open.resolution },
    });

    const gb = await challengesService.listEntries(DRY_RUN_SLUG, { country: 'GB' }, clock.now());
    expect(ChallengeEntriesResponseSchema.parse(gb).entries).toHaveLength(3);

    const pk = await challengesService.listEntries(DRY_RUN_SLUG, { country: 'PK' }, clock.now());
    expect(ChallengeEntriesResponseSchema.parse(pk).entries).toHaveLength(2);

    const summary = await challengesService.getBySlug(DRY_RUN_SLUG, clock.now());
    expect(summary.countryCounts).toEqual(
      expect.arrayContaining([
        { countryCode: 'GB', count: 3 },
        { countryCode: 'PK', count: 2 },
      ]),
    );
  });
});

function inLiveStatus(column: typeof challenges.status) {
  return sql`${column} IN ('active', 'live')`;
}

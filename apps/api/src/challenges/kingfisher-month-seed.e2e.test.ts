import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  applyRoles,
  challenges,
  createDb,
  migrationsFolder,
  roleConnectionUrl,
  runMigrations,
  seedAll,
} from '@wildwindow/db';
import { assertPublicSafe, TIER_POLICY } from '@wildwindow/geoprivacy';
import { ChallengeResponseSchema } from '@wildwindow/shared';
import { and, eq, ne, sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module.js';
import { apiNestOptions } from '../bootstrap.js';

import { ChallengesService } from './challenges.service.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';
const API_PASSWORD = process.env['WW_API_DB_PASSWORD'] ?? 'ww_api_test_password';
const WORKER_PASSWORD = process.env['WW_WORKER_DB_PASSWORD'] ?? 'ww_worker_test_password';

const KINGFISHER_SLUG = 'kingfisher-month-2026-11';
/** Midpoint of the seeded challenge window (data/challenges/kingfisher-month.yaml). */
const DURING_CHALLENGE = new Date('2026-11-15T12:00:00.000Z');

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

describe('T8.4 Seed Kingfisher Month → GET /v1/challenges/current', () => {
  let app: INestApplication | undefined;
  let previousEnv: Record<string, string | undefined>;

  beforeAll(async () => {
    await runMigrations(DATABASE_URL, migrationsFolder());
    await applyRoles(DATABASE_URL, {
      apiPassword: API_PASSWORD,
      workerPassword: WORKER_PASSWORD,
    });
    await seedAll(DATABASE_URL);

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
    process.env['LOCAL_STORAGE_DIR'] = '/tmp/ww-kingfisher-seed-e2e';
    process.env['STORAGE_SIGNING_SECRET'] = 'e2e-kingfisher-seed-signing';
    process.env['API_PUBLIC_URL'] = 'http://127.0.0.1:3001';
    process.env['LOGBOOK_ENC_KEY'] = Buffer.from(
      'ww-e2e-challenge-aes256-gcm-key!',
      'utf8',
    ).toString('base64');
    Reflect.deleteProperty(process.env, 'FIREBASE_PROJECT_ID');
    Reflect.deleteProperty(process.env, 'FIREBASE_SERVICE_ACCOUNT_JSON');

    // Isolate acceptance: only the seeded Kingfisher Month is live.
    const { db, pool } = createDb({ connectionString: DATABASE_URL });
    try {
      await db
        .update(challenges)
        .set({ status: 'closed' })
        .where(and(ne(challenges.slug, KINGFISHER_SLUG), inLiveStatus(challenges.status)));
      await db
        .update(challenges)
        .set({ status: 'live' })
        .where(eq(challenges.slug, KINGFISHER_SLUG));
    } finally {
      await pool.end();
    }

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication(apiNestOptions());
    await app.init();
  });

  afterAll(async () => {
    if (app !== undefined) {
      await app.close();
    }
    restoreEnv(previousEnv);
  });

  it('current() returns the seed during configured dates (service clock)', async () => {
    const nest = requireApp(app);
    // Restore committed window in case a sibling test stretched dates for HTTP.
    const { db, pool } = createDb({ connectionString: DATABASE_URL });
    try {
      await db
        .update(challenges)
        .set({
          startsOn: '2026-11-01',
          endsOn: '2026-11-30',
          status: 'live',
        })
        .where(eq(challenges.slug, KINGFISHER_SLUG));
    } finally {
      await pool.end();
    }

    const service = nest.get(ChallengesService);
    const summary = await service.current(DURING_CHALLENGE);
    const parsed = ChallengeResponseSchema.parse(summary);
    expect(parsed.slug).toBe(KINGFISHER_SLUG);
    expect(parsed.title).toBe('Kingfisher Month');
    expect(parsed.status).toBe('active');
    expect(parsed.startsOn).toBe('2026-11-01');
    expect(parsed.endsOn).toBe('2026-11-30');
    expect(parsed.rulesMd.toLowerCase()).toMatch(/baiting/);
    expect(parsed.rulesMd.toLowerCase()).toMatch(/playback/);
    expect(parsed.rulesMd.toLowerCase()).toMatch(/nest/);
  });

  it('GET /v1/challenges/current returns the seed (T8.4 acceptance)', async () => {
    const nest = requireApp(app);
    // HTTP uses the wall clock; ensure the seeded row covers "today" without
    // relying on the calendar month still being November.
    const { db, pool } = createDb({ connectionString: DATABASE_URL });
    try {
      await db
        .update(challenges)
        .set({
          startsOn: utcDateOffset(new Date(), -1),
          endsOn: utcDateOffset(new Date(), 1),
          status: 'live',
        })
        .where(eq(challenges.slug, KINGFISHER_SLUG));
      await db
        .update(challenges)
        .set({ status: 'closed' })
        .where(and(ne(challenges.slug, KINGFISHER_SLUG), inLiveStatus(challenges.status)));
    } finally {
      await pool.end();
    }

    const server = nest.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server).get('/v1/challenges/current').expect(200);
    const body = ChallengeResponseSchema.parse(response.body);
    expect(body.slug).toBe(KINGFISHER_SLUG);
    expect(body.title).toBe('Kingfisher Month');
    expect(body.status).toBe('active');
    expect(body.rulesMd.toLowerCase()).toMatch(/ethics pledge/);
    assertPublicSafe(response.body, {
      maxResolutionByTier: { open: TIER_POLICY.open.resolution },
    });
  });

  it('GET /v1/challenges/:slug returns the seed by slug', async () => {
    const nest = requireApp(app);
    const server = nest.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server).get(`/v1/challenges/${KINGFISHER_SLUG}`).expect(200);
    const body = ChallengeResponseSchema.parse(response.body);
    expect(body.slug).toBe(KINGFISHER_SLUG);
    expect(body.rulesMd.toLowerCase()).toMatch(/scotland/);
    expect(body.rulesMd.toLowerCase()).toMatch(/sindh/);
  });
});

function requireApp(app: INestApplication | undefined): INestApplication {
  if (app === undefined) {
    throw new Error('Nest app was not initialised');
  }
  return app;
}

function inLiveStatus(column: typeof challenges.status) {
  return sql`${column} IN ('active', 'live')`;
}

function utcDateOffset(now: Date, dayOffset: number): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset),
  );
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${String(y)}-${m}-${day}`;
}

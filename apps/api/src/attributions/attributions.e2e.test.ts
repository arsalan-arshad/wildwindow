import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  applyRoles,
  createDb,
  datasets,
  migrationsFolder,
  roleConnectionUrl,
  runMigrations,
} from '@wildwindow/db';
import { assertPublicSafe, TIER_POLICY } from '@wildwindow/geoprivacy';
import { AttributionsResponseSchema } from '@wildwindow/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module.js';
import { apiNestOptions } from '../bootstrap.js';

const PUBLIC_SAFE_OPTS = {
  maxResolutionByTier: { open: TIER_POLICY.open.resolution },
} as const;

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

describe('T5.15 GET /v1/attributions', () => {
  let app: INestApplication;
  let previousEnv: Record<string, string | undefined>;

  beforeAll(async () => {
    await runMigrations(DATABASE_URL, migrationsFolder());
    await applyRoles(DATABASE_URL, {
      apiPassword: API_PASSWORD,
      workerPassword: WORKER_PASSWORD,
    });

    previousEnv = {
      DATABASE_URL_API: process.env['DATABASE_URL_API'],
      NODE_ENV: process.env['NODE_ENV'],
      WEATHER_PROVIDER: process.env['WEATHER_PROVIDER'],
      TIDE_PROVIDER: process.env['TIDE_PROVIDER'],
      WAITLIST_THROTTLE_DISABLED: process.env['WAITLIST_THROTTLE_DISABLED'],
      WAITLIST_EMAIL_ENABLED: process.env['WAITLIST_EMAIL_ENABLED'],
    };

    process.env['DATABASE_URL_API'] = roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD);
    process.env['NODE_ENV'] = 'test';
    process.env['WEATHER_PROVIDER'] = 'openmeteo';
    process.env['TIDE_PROVIDER'] = 'none';
    process.env['WAITLIST_THROTTLE_DISABLED'] = '1';
    process.env['WAITLIST_EMAIL_ENABLED'] = 'false';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication(apiNestOptions());
    await app.init();
  });

  beforeEach(async () => {
    // Owner role: ww_api is SELECT-only on ref.* (ARCHITECTURE §6.3).
    const { db, pool } = createDb({ connectionString: DATABASE_URL });
    try {
      await db.delete(datasets);
    } finally {
      await pool.end();
    }
  });

  afterAll(async () => {
    await app.close();
    restoreEnv(previousEnv);
  });

  it('returns datasets with DOIs and weather/tide provider credits', async () => {
    const { db, pool } = createDb({ connectionString: DATABASE_URL });
    try {
      await db.insert(datasets).values([
        {
          gbifDatasetKey: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          title: 'Zebra observations',
          publisher: 'Test Museum',
          license: 'CC0_1_0',
          citation: 'https://doi.org/10.15468/dl.t515aa',
        },
        {
          gbifDatasetKey: '11111111-2222-3333-4444-555555555555',
          title: 'Alpha checklist',
          publisher: 'GBIF',
          license: 'CC_BY_4_0',
          citation: 'GBIF occurrence download',
        },
      ]);
    } finally {
      await pool.end();
    }

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server).get('/v1/attributions').expect(200);

    const parsed = AttributionsResponseSchema.parse(response.body);
    assertPublicSafe(parsed, PUBLIC_SAFE_OPTS);

    expect(parsed.datasets).toHaveLength(2);
    // Ordered by title ascending.
    expect(parsed.datasets[0]?.title).toBe('Alpha checklist');
    expect(parsed.datasets[0]?.doi).toBeNull();
    expect(parsed.datasets[1]?.title).toBe('Zebra observations');
    expect(parsed.datasets[1]?.doi).toBe('10.15468/dl.t515aa');
    expect(parsed.datasets[1]?.license).toBe('CC0_1_0');

    const providerIds = parsed.providers.map((p) => p.id);
    expect(providerIds).toContain('weather-openmeteo');
    expect(providerIds).toContain('tide-none');
    expect(providerIds).toContain('geonames');
    expect(JSON.stringify(parsed)).not.toMatch(/lat|lng|latitude|longitude/i);
  });

  it('returns empty datasets with providers when no GBIF datasets are loaded', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server).get('/v1/attributions').expect(200);
    const parsed = AttributionsResponseSchema.parse(response.body);
    expect(parsed.datasets).toEqual([]);
    expect(parsed.providers.length).toBeGreaterThanOrEqual(2);
    assertPublicSafe(parsed, PUBLIC_SAFE_OPTS);
  });
});

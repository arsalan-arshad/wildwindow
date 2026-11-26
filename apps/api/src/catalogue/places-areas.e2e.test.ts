import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  applyRoles,
  migrationsFolder,
  roleConnectionUrl,
  runMigrations,
  seedAll,
} from '@wildwindow/db';
import { assertPublicSafe, TIER_POLICY } from '@wildwindow/geoprivacy';
import { AreaResponseSchema, PlacesResponseSchema } from '@wildwindow/shared';
import { cellToParent, latLngToCell } from 'h3-js';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module.js';
import { apiNestOptions, configureApiApp } from '../bootstrap.js';

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

describe('T5.5 places and areas', () => {
  let app: INestApplication;
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
    };
    process.env['DATABASE_URL_API'] = roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD);
    process.env['NODE_ENV'] = 'test';
    process.env['WAITLIST_THROTTLE_DISABLED'] = '1';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication(apiNestOptions());
    configureApiApp(app);
    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app.close();
    restoreEnv(previousEnv);
  });

  it('GET /v1/places?q=glasg finds Glasgow via trigram', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server).get('/v1/places').query({ q: 'glasg' }).expect(200);
    const parsed = PlacesResponseSchema.parse(response.body);
    expect(parsed.places.some((p) => p.name === 'Glasgow')).toBe(true);
    const glasgow = parsed.places.find((p) => p.name === 'Glasgow');
    expect(glasgow?.regionSlug).toBe('scotland');
    expect(glasgow?.cellR7).toMatch(/^[0-9a-f]+$/i);
    assertPublicSafe(response.body, {
      maxResolutionByTier: { open: TIER_POLICY.open.resolution },
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /geom|latitude|longitude|"lat"|"lng"|coordinates/i,
    );
  });

  it('GET /v1/places?region= filters to that beta region', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server)
      .get('/v1/places')
      .query({ q: 'Karachi', region: 'sindh' })
      .expect(200);
    const parsed = PlacesResponseSchema.parse(response.body);
    expect(parsed.places.some((p) => p.name === 'Karachi')).toBe(true);
    expect(parsed.places.every((p) => p.regionSlug === 'sindh')).toBe(true);
  });

  it('GET /v1/areas/:cellR7 returns label for a Glasgow cell', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const glasgowR7 = latLngToCell(55.86515, -4.25763, 7);
    const response = await request(server).get(`/v1/areas/${glasgowR7}`).expect(200);
    const parsed = AreaResponseSchema.parse(response.body);
    expect(parsed.cellR7).toBe(glasgowR7);
    expect(parsed.covered).toBe(true);
    expect(parsed.regionSlug).toBe('scotland');
    expect(parsed.label.toLowerCase()).toContain('glasgow');
    expect(parsed.label).not.toMatch(/[-+]?\d{1,3}\.\d+/);
    assertPublicSafe(response.body, {
      maxResolutionByTier: { open: TIER_POLICY.open.resolution },
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /geom|latitude|longitude|"lat"|"lng"|coordinates/i,
    );
  });

  it('GET /v1/areas/:cellR7 outside beta regions → covered:false', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    // Central London — outside Scotland and Sindh polygons.
    const outsideR7 = latLngToCell(51.5074, -0.1278, 7);
    const response = await request(server).get(`/v1/areas/${outsideR7}`).expect(200);
    const parsed = AreaResponseSchema.parse(response.body);
    expect(parsed.cellR7).toBe(outsideR7);
    expect(parsed.covered).toBe(false);
    expect(parsed.regionSlug).toBeNull();
    expect(parsed.label).toBe('Not covered yet');
    assertPublicSafe(response.body, {
      maxResolutionByTier: { open: TIER_POLICY.open.resolution },
    });
  });

  it('GET /v1/areas/:cellR7 with invalid cell → 400', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const invalid = await request(server).get('/v1/areas/not-a-valid-h3-cell').expect(400);
    expect(invalid.body).toMatchObject({ code: 'VALIDATION_ERROR' });

    // Valid H3 but wrong resolution (res 5 parent of Glasgow).
    const glasgowR7 = latLngToCell(55.86515, -4.25763, 7);
    const res5 = cellToParent(glasgowR7, 5);
    const wrongRes = await request(server).get(`/v1/areas/${res5}`).expect(400);
    expect(wrongRes.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

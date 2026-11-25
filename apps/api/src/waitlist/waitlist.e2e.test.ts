import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  applyRoles,
  createDb,
  migrationsFolder,
  roleConnectionUrl,
  runMigrations,
  waitlist,
} from '@wildwindow/db';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../app.module.js';

import { WaitlistService } from './waitlist.service.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';
const API_PASSWORD = process.env['WW_API_DB_PASSWORD'] ?? 'ww_api_test_password';
const WORKER_PASSWORD = process.env['WW_WORKER_DB_PASSWORD'] ?? 'ww_worker_test_password';
const ADMIN_TOKEN = 'test-admin-token-waitlist';

function restoreEnv(snapshot: Record<string, string | undefined>): void {
  for (const key of Object.keys(snapshot)) {
    const value = snapshot[key];
    if (value === undefined) {
      // Reflect.deleteProperty avoids dynamic-delete lint on process.env.
      Reflect.deleteProperty(process.env, key);
    } else {
      process.env[key] = value;
    }
  }
}

describe('POST /v1/waitlist + admin export', () => {
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
      ADMIN_TOKEN: process.env['ADMIN_TOKEN'],
      WAITLIST_EMAIL_ENABLED: process.env['WAITLIST_EMAIL_ENABLED'],
      NODE_ENV: process.env['NODE_ENV'],
      WAITLIST_THROTTLE_DISABLED: process.env['WAITLIST_THROTTLE_DISABLED'],
    };

    process.env['DATABASE_URL_API'] = roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD);
    process.env['ADMIN_TOKEN'] = ADMIN_TOKEN;
    process.env['WAITLIST_EMAIL_ENABLED'] = 'false';
    process.env['NODE_ENV'] = 'test';
    // Avoid cross-test IP budget exhaustion; throttle is covered in a dedicated suite.
    process.env['WAITLIST_THROTTLE_DISABLED'] = '1';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(async () => {
    const { db, pool } = createDb({
      connectionString: roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD),
    });
    try {
      await db.delete(waitlist);
    } finally {
      await pool.end();
    }
  });

  afterAll(async () => {
    await app.close();
    restoreEnv(previousEnv);
  });

  it('inserts a signup and returns ok', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server)
      .post('/v1/waitlist')
      .send({
        email: 'Alex@Example.com',
        name: 'Alex',
        regionSlug: 'scotland',
        role: 'hobby_photographer',
        platform: 'ios',
        favouriteSpecies: 'Common kingfisher',
        consent: true,
        source: 'landing',
      })
      .expect(200);

    expect(response.body).toEqual({ ok: true });

    const { db, pool } = createDb({
      connectionString: roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD),
    });
    try {
      const rows = await db.select().from(waitlist);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.email).toBe('alex@example.com');
      expect(rows[0]?.name).toBe('Alex');
      expect(rows[0]?.regionSlug).toBe('scotland');
      expect(rows[0]?.consentAt).toBeInstanceOf(Date);
    } finally {
      await pool.end();
    }
  });

  it('returns 400 VALIDATION_ERROR without consent', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server)
      .post('/v1/waitlist')
      .send({ email: 'ok@example.com', consent: false })
      .expect(400);
    expect(response.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('treats duplicate lower(email) as ok without a second row', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server)
      .post('/v1/waitlist')
      .send({ email: 'Name@x.com', consent: true, source: 'waitlist' })
      .expect(200);
    await request(server)
      .post('/v1/waitlist')
      .send({ email: 'name@x.com', consent: true, source: 'waitlist' })
      .expect(200);

    const { db, pool } = createDb({
      connectionString: roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD),
    });
    try {
      const rows = await db.select().from(waitlist);
      expect(rows).toHaveLength(1);
    } finally {
      await pool.end();
    }
  });

  it('silently discards honeypot submissions', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server)
      .post('/v1/waitlist')
      .send({
        email: 'bot@example.com',
        consent: true,
        company: 'Spam Corp',
      })
      .expect(200);

    const { db, pool } = createDb({
      connectionString: roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD),
    });
    try {
      const rows = await db.select().from(waitlist);
      expect(rows).toHaveLength(0);
    } finally {
      await pool.end();
    }
  });

  it('invokes the email sender stub when WAITLIST_EMAIL_ENABLED=false', async () => {
    const service = app.get(WaitlistService);
    const sender = service.getEmailSender();
    const spy = vi.spyOn(sender, 'sendSignupAck');

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server)
      .post('/v1/waitlist')
      .send({ email: 'mailcheck@example.com', consent: true })
      .expect(200);

    expect(spy).toHaveBeenCalledTimes(1);
    await expect(spy.mock.results[0]?.value).resolves.toBeUndefined();
    spy.mockRestore();
  });

  it('rejects CSV export without token', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server).get('/v1/admin/waitlist/export').expect(401);
    expect(response.body).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('exports CSV with admin bearer token', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server)
      .post('/v1/waitlist')
      .send({
        email: 'csv@example.com',
        name: 'Csv User',
        regionSlug: 'sindh',
        consent: true,
        source: 'waitlist',
      })
      .expect(200);

    const response = await request(server)
      .get('/v1/admin/waitlist/export')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect(200);

    expect(response.headers['content-type']).toMatch(/text\/csv/);
    const text = response.text;
    expect(text).toContain(
      'id,email,name,region_slug,role,platform,favourite_species,consent_at,source,created_at',
    );
    expect(text).toContain('csv@example.com');
    expect(text).toContain('Csv User');
    expect(text).toContain('sindh');
  });
});

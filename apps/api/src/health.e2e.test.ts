import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from './app.module.js';
import { apiNestOptions, configureApiApp } from './bootstrap.js';
import { corsOptionsFromWebOrigin } from './cors.js';

describe('GET /v1/health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication(apiNestOptions());
    configureApiApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 with status ok', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server).get('/v1/health').expect(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});

describe('CORS for WEB_ORIGIN', () => {
  const webOrigin = 'https://wildwindow.arsalandev.studio';
  let app: INestApplication;
  let previousWebOrigin: string | undefined;

  beforeEach(async () => {
    previousWebOrigin = process.env['WEB_ORIGIN'];
    process.env['WEB_ORIGIN'] = `${webOrigin}/`;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication(apiNestOptions());
    const cors = corsOptionsFromWebOrigin(process.env['WEB_ORIGIN']);
    expect(cors).toBeDefined();
    app.enableCors(cors);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    if (previousWebOrigin === undefined) {
      delete process.env['WEB_ORIGIN'];
    } else {
      process.env['WEB_ORIGIN'] = previousWebOrigin;
    }
  });

  it('echoes Access-Control-Allow-Origin for the configured web origin', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server).get('/v1/health').set('Origin', webOrigin).expect(200);

    expect(response.headers['access-control-allow-origin']).toBe(webOrigin);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('answers OPTIONS preflight with CORS headers', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server)
      .options('/v1/health')
      .set('Origin', webOrigin)
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe(webOrigin);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });
});

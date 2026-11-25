import { PassThrough } from 'node:stream';

import { Controller, Get, Module, type INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Logger } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { apiNestOptions, configureApiApp } from './bootstrap.js';
import { ApiConfigModule } from './config/api-config.module.js';
import { HealthController } from './health.controller.js';
import { ThrottlerExceptionFilter } from './http/throttler-exception.filter.js';
import { ApiLoggerModule } from './logging/logger.module.js';
import { LOG_REDACT_CENSOR } from './logging/redact.js';

@Controller('v1/foundations-probe')
class FoundationsProbeController {
  @Get()
  probe(): { ok: true } {
    return { ok: true };
  }
}

describe('T5.2 API foundations', () => {
  describe('pino redacts lat query values', () => {
    let app: INestApplication;
    let logChunks: string[];

    beforeAll(async () => {
      logChunks = [];
      const destination = new PassThrough();
      destination.on('data', (chunk: Buffer | string) => {
        logChunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
      });

      @Module({
        imports: [
          ApiConfigModule,
          ApiLoggerModule.forRoot({ destination, level: 'info' }),
          ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 1000 }]),
        ],
        controllers: [HealthController],
        providers: [
          { provide: APP_GUARD, useClass: ThrottlerGuard },
          { provide: APP_FILTER, useClass: ThrottlerExceptionFilter },
          { provide: APP_PIPE, useClass: ZodValidationPipe },
        ],
      })
      class LogCaptureModule {}

      const moduleRef = await Test.createTestingModule({
        imports: [LogCaptureModule],
      }).compile();

      app = moduleRef.createNestApplication(apiNestOptions());
      app.useLogger(app.get(Logger));
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('redacts lat= from captured request logs', async () => {
      const secretLat = '55.864237';
      const server = app.getHttpServer() as Parameters<typeof request>[0];
      await request(server).get(`/v1/health?lat=${secretLat}&cell=871f1d489ffffff`).expect(200);

      // Allow pino async flush into the PassThrough.
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 50);
      });

      const combined = logChunks.join('');
      expect(combined.length).toBeGreaterThan(0);
      expect(combined).not.toContain(secretLat);
      expect(combined).toContain(LOG_REDACT_CENSOR);
    });
  });

  describe('global throttler (60/min)', () => {
    let app: INestApplication;

    beforeAll(async () => {
      @Module({
        imports: [
          ApiConfigModule,
          ApiLoggerModule.forRoot({ level: 'silent' }),
          ThrottlerModule.forRoot([
            {
              name: 'default',
              ttl: 60_000,
              limit: 60,
            },
          ]),
        ],
        controllers: [FoundationsProbeController],
        providers: [
          { provide: APP_GUARD, useClass: ThrottlerGuard },
          { provide: APP_FILTER, useClass: ThrottlerExceptionFilter },
        ],
      })
      class ThrottleSixtyModule {}

      const moduleRef = await Test.createTestingModule({
        imports: [ThrottleSixtyModule],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('returns 429 on the 61st request in a minute', async () => {
      const server = app.getHttpServer() as Parameters<typeof request>[0];
      const ip = '203.0.113.61';

      for (let i = 0; i < 60; i += 1) {
        await request(server).get('/v1/foundations-probe').set('X-Forwarded-For', ip).expect(200);
      }

      const limited = await request(server)
        .get('/v1/foundations-probe')
        .set('X-Forwarded-For', ip)
        .expect(429);

      expect(limited.body).toMatchObject({ code: 'RATE_LIMIT' });
    });
  });

  describe('OpenAPI /docs outside production', () => {
    let app: INestApplication;
    let previousNodeEnv: string | undefined;

    beforeAll(async () => {
      previousNodeEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'test';

      @Module({
        imports: [
          ApiConfigModule,
          ApiLoggerModule.forRoot({ level: 'silent' }),
          ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 1000 }]),
        ],
        controllers: [HealthController],
      })
      class DocsModule {}

      const moduleRef = await Test.createTestingModule({
        imports: [DocsModule],
      }).compile();

      app = moduleRef.createNestApplication(apiNestOptions());
      configureApiApp(app);
      await app.init();
    });

    afterAll(async () => {
      await app.close();
      if (previousNodeEnv === undefined) {
        delete process.env['NODE_ENV'];
      } else {
        process.env['NODE_ENV'] = previousNodeEnv;
      }
    });

    it('serves swagger UI at /docs', async () => {
      const server = app.getHttpServer() as Parameters<typeof request>[0];
      const response = await request(server).get('/docs').expect(200);
      expect(response.text.toLowerCase()).toContain('swagger');
    });
  });
});

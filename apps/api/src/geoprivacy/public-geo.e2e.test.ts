import { PassThrough } from 'node:stream';

import {
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  Module,
  type INestApplication,
} from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { apiNestOptions } from '../bootstrap.js';
import { ApiConfigModule } from '../config/api-config.module.js';
import { ApiLoggerModule } from '../logging/logger.module.js';

import { OwnerLocation, type RequestWithOptionalUser } from './owner-location.js';
import { PublicGeoInterceptor } from './public-geo.interceptor.js';

@Controller('v1/geo-probe')
class DirtyPublicController {
  @Get('public')
  publicDirty(): { lat: number } {
    return { lat: 1 };
  }
}

@Controller('v1/geo-probe')
class DirtyOwnerController {
  @OwnerLocation()
  @Get('owner')
  ownerDirty(): { lat: number } {
    return { lat: 1 };
  }
}

/** Test-only guard that stamps `req.user` when `X-Test-User-Id` is set. */
@Injectable()
class TestOwnerAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<RequestWithOptionalUser & { headers: Record<string, string | undefined> }>();
    const id = req.headers['x-test-user-id'];
    if (typeof id === 'string' && id.length > 0) {
      req.user = { id };
    }
    return true;
  }
}

describe('T5.3 PublicGeoInterceptor', () => {
  describe('public route returning {lat:1}', () => {
    let app: INestApplication;
    let logChunks: string[];

    beforeAll(async () => {
      logChunks = [];
      const destination = new PassThrough();
      destination.on('data', (chunk: Buffer | string) => {
        logChunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
      });

      @Module({
        imports: [ApiConfigModule, ApiLoggerModule.forRoot({ destination, level: 'error' })],
        controllers: [DirtyPublicController],
        providers: [{ provide: APP_INTERCEPTOR, useClass: PublicGeoInterceptor }],
      })
      class PublicProbeModule {}

      const moduleRef = await Test.createTestingModule({
        imports: [PublicProbeModule],
      }).compile();

      app = moduleRef.createNestApplication(apiNestOptions());
      app.useLogger(app.get(Logger));
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('returns 500 and logs GeoPrivacyViolation', async () => {
      const server = app.getHttpServer() as Parameters<typeof request>[0];
      const response = await request(server).get('/v1/geo-probe/public').expect(500);

      expect(response.body).toMatchObject({ code: 'INTERNAL_ERROR' });

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 50);
      });

      const combined = logChunks.join('');
      expect(combined).toContain('GeoPrivacyViolation');
    });
  });

  describe('@OwnerLocation() with owner auth', () => {
    let app: INestApplication;

    beforeAll(async () => {
      @Module({
        imports: [ApiConfigModule, ApiLoggerModule.forRoot({ level: 'silent' })],
        controllers: [DirtyOwnerController],
        providers: [
          { provide: APP_INTERCEPTOR, useClass: PublicGeoInterceptor },
          { provide: APP_GUARD, useClass: TestOwnerAuthGuard },
        ],
      })
      class OwnerProbeModule {}

      const moduleRef = await Test.createTestingModule({
        imports: [OwnerProbeModule],
      }).compile();

      app = moduleRef.createNestApplication(apiNestOptions());
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('allows {lat:1} when the owner is authenticated', async () => {
      const server = app.getHttpServer() as Parameters<typeof request>[0];
      const response = await request(server)
        .get('/v1/geo-probe/owner')
        .set('X-Test-User-Id', 'owner-user-1')
        .expect(200);

      expect(response.body).toEqual({ lat: 1 });
    });

    it('still rejects {lat:1} without owner authentication', async () => {
      const server = app.getHttpServer() as Parameters<typeof request>[0];
      const response = await request(server).get('/v1/geo-probe/owner').expect(500);

      expect(response.body).toMatchObject({ code: 'INTERNAL_ERROR' });
    });
  });
});

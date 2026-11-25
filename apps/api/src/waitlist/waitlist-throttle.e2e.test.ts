import { Controller, Get, Module, type INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ThrottlerExceptionFilter } from '../http/throttler-exception.filter.js';

@Controller('v1/throttle-probe')
class ThrottleProbeController {
  @Get()
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  probe(): { ok: true } {
    return { ok: true };
  }
}

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 2,
      },
    ]),
  ],
  controllers: [ThrottleProbeController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: ThrottlerExceptionFilter },
  ],
})
class ThrottleProbeModule {}

describe('Throttler → RATE_LIMIT', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottleProbeModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 429 with RATE_LIMIT after the IP budget is spent', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server)
      .get('/v1/throttle-probe')
      .set('X-Forwarded-For', '203.0.113.50')
      .expect(200);
    await request(server)
      .get('/v1/throttle-probe')
      .set('X-Forwarded-For', '203.0.113.50')
      .expect(200);
    const limited = await request(server)
      .get('/v1/throttle-probe')
      .set('X-Forwarded-For', '203.0.113.50')
      .expect(429);
    expect(limited.body).toMatchObject({ code: 'RATE_LIMIT' });
  });
});

import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';

import { ApiConfigModule } from './config/api-config.module.js';
import { DbModule } from './db/db.module.js';
import { HealthController } from './health.controller.js';
import { ThrottlerExceptionFilter } from './http/throttler-exception.filter.js';
import { ApiLoggerModule } from './logging/logger.module.js';
import { WaitlistModule } from './waitlist/waitlist.module.js';

@Module({
  imports: [
    ApiConfigModule,
    ApiLoggerModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        // Global public default (ARCHITECTURE §7); waitlist overrides tighter.
        name: 'default',
        ttl: 60_000,
        limit: 60,
        skipIf: () => process.env['WAITLIST_THROTTLE_DISABLED'] === '1',
      },
    ]),
    DbModule,
    WaitlistModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: ThrottlerExceptionFilter,
    },
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';
import { ZodValidationPipe } from 'nestjs-zod';

import { AdminModule } from './admin/admin.module.js';
import { AttributionsModule } from './attributions/attributions.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BugReportsModule } from './bug-reports/bug-reports.module.js';
import { CatalogueModule } from './catalogue/catalogue.module.js';
import { ChallengesModule } from './challenges/challenges.module.js';
import { ApiConfigModule } from './config/api-config.module.js';
import { DbModule } from './db/db.module.js';
import { ForecastModule } from './forecast/forecast.module.js';
import { PublicGeoInterceptor } from './geoprivacy/public-geo.interceptor.js';
import { HealthController } from './health.controller.js';
import { ThrottlerExceptionFilter } from './http/throttler-exception.filter.js';
import { ApiLoggerModule } from './logging/logger.module.js';
import { LogbookModule } from './me/logbook.module.js';
import { WeatherModule } from './providers/weather/weather.module.js';
import { UploadsModule } from './uploads/uploads.module.js';
import { WaitlistModule } from './waitlist/waitlist.module.js';

@Module({
  imports: [
    SentryModule.forRoot(),
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
    AuthModule,
    AdminModule,
    WeatherModule,
    UploadsModule,
    LogbookModule,
    ChallengesModule,
    WaitlistModule,
    BugReportsModule,
    AttributionsModule,
    CatalogueModule,
    ForecastModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
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
    {
      provide: APP_INTERCEPTOR,
      useClass: PublicGeoInterceptor,
    },
  ],
})
export class AppModule {}

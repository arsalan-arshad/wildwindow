import './instrument.js';
import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { apiNestOptions, configureApiApp } from './bootstrap.js';
import { loadApiEnv } from './config/api-env.js';
import { initApiAnalytics, shutdownApiAnalytics } from './observability/analytics.js';

async function bootstrap(): Promise<void> {
  const env = loadApiEnv();
  initApiAnalytics();
  const app = await NestFactory.create(AppModule, apiNestOptions());
  configureApiApp(app);
  app.enableShutdownHooks();
  process.once('beforeExit', () => {
    void shutdownApiAnalytics();
  });
  await app.listen(env.PORT);
}

void bootstrap();

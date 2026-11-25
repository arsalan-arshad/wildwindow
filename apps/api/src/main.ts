import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { apiNestOptions, configureApiApp } from './bootstrap.js';
import { loadApiEnv } from './config/api-env.js';

async function bootstrap(): Promise<void> {
  const env = loadApiEnv();
  const app = await NestFactory.create(AppModule, apiNestOptions());
  configureApiApp(app);
  await app.listen(env.PORT);
}

void bootstrap();

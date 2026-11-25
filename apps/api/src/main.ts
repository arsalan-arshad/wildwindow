import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { corsOptionsFromWebOrigin } from './cors.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const cors = corsOptionsFromWebOrigin(process.env['WEB_ORIGIN']);
  if (cors !== undefined) {
    app.enableCors(cors);
  }
  const port = Number(process.env['PORT'] ?? 3001);
  await app.listen(port);
}

void bootstrap();

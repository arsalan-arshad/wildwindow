import { type INestApplication, type NestApplicationOptions } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { cleanupOpenApiDoc } from 'nestjs-zod';

import { loadApiEnv } from './config/api-env.js';
import { corsOptionsFromWebOrigin } from './cors.js';

/**
 * Nest create options used by `main` and e2e (buffer pino until useLogger).
 * Nest types `NestApplicationContextOptions` as a class; the public API still
 * accepts a plain options bag — cast once here for eslint.
 */
export function apiNestOptions(): NestApplicationOptions {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-class-instance-assignment -- Nest options bag
  const options: NestApplicationOptions = { bufferLogs: true };
  return options;
}

/**
 * Shared Nest bootstrap for production and e2e (T5.2):
 * Helmet, CORS, pino logger, OpenAPI at `/docs` outside production.
 */
export function configureApiApp(app: INestApplication): void {
  const env = loadApiEnv();

  app.use(helmet());

  const cors = corsOptionsFromWebOrigin(env.WEB_ORIGIN ?? process.env['WEB_ORIGIN']);
  if (cors !== undefined) {
    app.enableCors(cors);
  }

  app.useLogger(app.get(Logger));

  if (env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('WildWindow API')
      .setDescription('REST `/v1` — ARCHITECTURE §7')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, cleanupOpenApiDoc(document));
  }
}

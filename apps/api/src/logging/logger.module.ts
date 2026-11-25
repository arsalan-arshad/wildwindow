import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { stdSerializers } from 'pino-http';

import { LOG_REDACT_CENSOR, PINO_REDACT_PATHS, scrubSensitiveQueryFromUrl } from './redact.js';

import type { IncomingMessage } from 'node:http';
import type { DestinationStream } from 'pino';
import type { Options as PinoHttpOptions } from 'pino-http';

export type ApiLoggerOptions = {
  /** Optional pino destination (tests capture logs here). */
  readonly destination?: DestinationStream;
  /** Override log level (default info; silent in test unless destination set). */
  readonly level?: string;
};

function buildPinoHttp(options: ApiLoggerOptions = {}): PinoHttpOptions {
  const level =
    options.level ??
    (options.destination !== undefined
      ? 'info'
      : process.env['NODE_ENV'] === 'test'
        ? 'silent'
        : 'info');

  const pinoHttp: PinoHttpOptions = {
    level,
    redact: {
      paths: [...PINO_REDACT_PATHS],
      censor: LOG_REDACT_CENSOR,
    },
    serializers: {
      req(req: IncomingMessage & { url?: string; query?: unknown }) {
        const serialized = stdSerializers.req(req) as unknown as {
          url?: string;
          [key: string]: unknown;
        };
        if (typeof serialized.url === 'string') {
          serialized.url = scrubSensitiveQueryFromUrl(serialized.url);
        }
        return serialized;
      },
    },
  };

  if (options.destination !== undefined) {
    pinoHttp.stream = options.destination;
  }

  return pinoHttp;
}

/**
 * Root logger module (T5.2). Import once in `AppModule`.
 * Pass `destination` from tests to capture and assert redaction.
 */
@Module({})
export class ApiLoggerModule {
  static forRoot(options: ApiLoggerOptions = {}) {
    return PinoLoggerModule.forRoot({
      pinoHttp: buildPinoHttp(options),
    });
  }
}

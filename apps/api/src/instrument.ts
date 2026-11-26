/**
 * Sentry bootstrap for the Nest API (T9.1).
 * Import this module before any other application imports in `main.ts`.
 */
import * as Sentry from '@sentry/nestjs';
import { scrubSentryEvent } from '@wildwindow/shared/sentry-scrub';

const dsn = process.env['SENTRY_DSN']?.trim();

if (dsn !== undefined && dsn.length > 0) {
  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    // ARCHITECTURE §11 — sample; no session replay in the MVP.
    tracesSampleRate: 0.1,
    beforeSend(event) {
      return scrubSentryEvent(
        event as unknown as Record<string, unknown>,
      ) as unknown as typeof event;
    },
  });
}

export function isApiSentryEnabled(): boolean {
  return typeof dsn === 'string' && dsn.length > 0;
}

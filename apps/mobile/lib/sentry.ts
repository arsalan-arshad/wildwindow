/**
 * Sentry for the mobile shell (T9.1).
 * Scrubs PII and location via `@wildwindow/shared/sentry-scrub` before send.
 */
import * as Sentry from '@sentry/react-native';
import { scrubSentryEvent } from '@wildwindow/shared/sentry-scrub';

export type SentryLikeError = Error | string | unknown;

let enabled = false;

function readDsn(): string | undefined {
  const dsn = process.env['EXPO_PUBLIC_SENTRY_DSN']?.trim();
  return dsn !== undefined && dsn.length > 0 ? dsn : undefined;
}

/**
 * Init when `EXPO_PUBLIC_SENTRY_DSN` is present. Safe to call from the root layout.
 */
export function initSentry(): void {
  const dsn = readDsn();
  enabled = dsn !== undefined;
  if (!enabled || dsn === undefined) {
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    tracesSampleRate: 0.1,
    beforeSend(event) {
      return scrubSentryEvent(
        event as unknown as Record<string, unknown>,
      ) as unknown as typeof event;
    },
  });
}

export function isSentryEnabled(): boolean {
  return enabled;
}

/**
 * Capture an exception. Logs in development when Sentry is not configured.
 */
export function captureException(error: SentryLikeError, context?: Record<string, unknown>): void {
  if (enabled) {
    Sentry.captureException(error, context !== undefined ? { extra: context } : undefined);
    return;
  }
  if (process.env['NODE_ENV'] !== 'production') {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[sentry]', message, context ?? {});
  }
}

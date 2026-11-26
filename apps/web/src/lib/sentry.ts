import { scrubSentryEvent } from '@wildwindow/shared/sentry-scrub';

export type SentryLikeError = Error | string | unknown;

let enabled = false;

function readDsn(): string | undefined {
  const fromPublic = process.env['NEXT_PUBLIC_SENTRY_DSN']?.trim();
  if (fromPublic !== undefined && fromPublic.length > 0) {
    return fromPublic;
  }
  const fromServer = process.env['SENTRY_DSN']?.trim();
  if (fromServer !== undefined && fromServer.length > 0) {
    return fromServer;
  }
  return undefined;
}

/**
 * Init Sentry for the Next.js app (T9.1). Safe no-op without a DSN.
 * Client and server both call this; the SDK is imported dynamically.
 */
export async function initSentry(): Promise<void> {
  const dsn = readDsn();
  enabled = dsn !== undefined;
  if (!enabled || dsn === undefined) {
    return;
  }

  const Sentry = await import('@sentry/nextjs');
  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    tracesSampleRate: 0.1,
    // ARCHITECTURE §11 — no session replay in the MVP.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
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

export async function captureException(
  error: SentryLikeError,
  context?: Record<string, unknown>,
): Promise<void> {
  if (!enabled) {
    if (process.env['NODE_ENV'] !== 'production') {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[sentry]', message, context ?? {});
    }
    return;
  }
  const Sentry = await import('@sentry/nextjs');
  Sentry.captureException(error, context !== undefined ? { extra: context } : undefined);
}

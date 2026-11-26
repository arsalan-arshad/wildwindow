/**
 * Sentry placeholder for the mobile shell (T6.1).
 * Full SDK wiring (DSN, PII/location scrub) is T9.1 — do not add @sentry/* here yet.
 */

export type SentryLikeError = Error | string | unknown;

let enabled = false;

/**
 * No-op until `EXPO_PUBLIC_SENTRY_DSN` (or T9.1 config) is present.
 * Safe to call from the root layout on every launch.
 */
export function initSentry(): void {
  const dsn = process.env['EXPO_PUBLIC_SENTRY_DSN'];
  enabled = typeof dsn === 'string' && dsn.trim().length > 0;
  if (!enabled) {
    return;
  }
  // T9.1: Sentry.init({ dsn, ...scrubbers })
}

export function isSentryEnabled(): boolean {
  return enabled;
}

/**
 * Capture an exception. Logs in development when Sentry is not configured.
 */
export function captureException(error: SentryLikeError, context?: Record<string, unknown>): void {
  if (enabled) {
    // T9.1: Sentry.captureException(error, { extra: context })
    return;
  }
  if (process.env['NODE_ENV'] !== 'production') {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[sentry:placeholder]', message, context ?? {});
  }
}

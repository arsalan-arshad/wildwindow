/** Keys that must never appear with real values in structured API logs (T5.2 / §7). */
export const LOG_REDACT_KEYS = ['lat', 'lng', 'latitude', 'longitude', 'authorization'] as const;

export type LogRedactKey = (typeof LOG_REDACT_KEYS)[number];

export const LOG_REDACT_CENSOR = '[Redacted]';

/**
 * Pino redact paths covering query, headers, body, and shallow/nested objects.
 * Also used when scrubbing `req.url` query strings (redact does not rewrite URLs).
 */
export const PINO_REDACT_PATHS: readonly string[] = [
  ...LOG_REDACT_KEYS.flatMap((key) => [
    key,
    `*.${key}`,
    `req.query.${key}`,
    `req.params.${key}`,
    `req.headers.${key}`,
    `req.body.${key}`,
  ]),
  'req.headers.authorization',
];

const REDACT_QUERY_KEYS = new Set<string>(LOG_REDACT_KEYS.filter((key) => key !== 'authorization'));

/**
 * Replace sensitive query values in a request URL path+search string.
 * pino-http logs `req.url` as a raw string; path-based redact alone is not enough.
 */
export function scrubSensitiveQueryFromUrl(url: string): string {
  const qIndex = url.indexOf('?');
  if (qIndex < 0) {
    return url;
  }
  const path = url.slice(0, qIndex);
  const search = url.slice(qIndex + 1);
  const params = new URLSearchParams(search);
  let changed = false;
  for (const key of [...params.keys()]) {
    if (REDACT_QUERY_KEYS.has(key.toLowerCase())) {
      params.set(key, LOG_REDACT_CENSOR);
      changed = true;
    }
  }
  if (!changed) {
    return url;
  }
  const next = params.toString();
  return next.length > 0 ? `${path}?${next}` : path;
}

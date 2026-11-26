import { FORBIDDEN_PUBLIC_KEYS } from '@wildwindow/geoprivacy';

/**
 * Location keys stripped from Sentry payloads (ARCHITECTURE §5.3 / T9.1).
 * Same geoprivacy list as public outputs, plus common cell aliases.
 */
export const SENTRY_LOCATION_KEYS = [
  ...FORBIDDEN_PUBLIC_KEYS,
  'cell',
  'cellR7',
  'cell_r7',
  'displayCell',
  'display_cell',
  'h3',
  'h3Index',
  'h3_index',
] as const;

/** User / request PII fields we never send to Sentry in the MVP. */
export const SENTRY_PII_KEYS = [
  'email',
  'ip_address',
  'ipAddress',
  'username',
  'user_name',
  'authorization',
  'cookie',
  'cookies',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'idToken',
] as const;

const LOCATION_KEY_SET = new Set(SENTRY_LOCATION_KEYS.map((key) => key.toLowerCase()));
const PII_KEY_SET = new Set(SENTRY_PII_KEYS.map((key) => key.toLowerCase()));
const ALL_SCRUB_KEYS = new Set([...LOCATION_KEY_SET, ...PII_KEY_SET]);

export const SENTRY_REDACT_CENSOR = '[Filtered]';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function shouldScrubKey(key: string): boolean {
  return ALL_SCRUB_KEYS.has(key.toLowerCase());
}

/**
 * Deep-scrub a JSON-like value: drop location keys, replace PII values with a
 * censor token, and scrub nested objects / arrays.
 */
export function scrubSentryValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => scrubSentryValue(item));
  }
  if (!isPlainObject(value)) {
    return value;
  }

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const lower = key.toLowerCase();
    if (LOCATION_KEY_SET.has(lower)) {
      continue;
    }
    if (PII_KEY_SET.has(lower)) {
      out[key] = SENTRY_REDACT_CENSOR;
      continue;
    }
    out[key] = scrubSentryValue(child);
  }
  return out;
}

/**
 * Scrub query values whose keys are location or PII (pino-style URL safety).
 */
export function scrubSentryQueryString(search: string): string {
  const trimmed = search.startsWith('?') ? search.slice(1) : search;
  if (trimmed.length === 0) {
    return search.startsWith('?') ? '?' : '';
  }
  const params = new URLSearchParams(trimmed);
  let changed = false;
  for (const key of [...params.keys()]) {
    if (shouldScrubKey(key)) {
      params.set(key, SENTRY_REDACT_CENSOR);
      changed = true;
    }
  }
  if (!changed) {
    return search;
  }
  const next = params.toString();
  return search.startsWith('?') ? `?${next}` : next;
}

type SentryLikeEvent = {
  user?: Record<string, unknown> | null;
  request?: {
    url?: string;
    query_string?: string | Record<string, unknown> | null;
    headers?: Record<string, unknown> | null;
    data?: unknown;
    [key: string]: unknown;
  } | null;
  extra?: Record<string, unknown> | null;
  contexts?: Record<string, unknown> | null;
  tags?: Record<string, unknown> | null;
  breadcrumbs?:
    | {
        values?: Array<Record<string, unknown>>;
      }
    | Array<Record<string, unknown>>
    | null;
  [key: string]: unknown;
};

/**
 * `beforeSend` helper: strip PII and location from a Sentry event in place-ish
 * (returns a new object tree). Safe to use from api / web / mobile SDK inits.
 */
export function scrubSentryEvent<T extends SentryLikeEvent>(event: T): T {
  const next = scrubSentryValue(event) as T;

  if (next.user && isPlainObject(next.user)) {
    const user: Record<string, unknown> = { ...next.user };
    for (const key of Object.keys(user)) {
      if (shouldScrubKey(key)) {
        user[key] = SENTRY_REDACT_CENSOR;
      }
    }
    // Never keep email / IP even if casing slipped through scrubSentryValue.
    delete user['email'];
    delete user['ip_address'];
    delete user['ipAddress'];
    next.user = user;
  }

  if (next.request && isPlainObject(next.request)) {
    const request = { ...next.request };
    if (typeof request.url === 'string') {
      const q = request.url.indexOf('?');
      if (q >= 0) {
        request.url = request.url.slice(0, q) + scrubSentryQueryString(request.url.slice(q));
      }
    }
    if (typeof request.query_string === 'string') {
      request.query_string = scrubSentryQueryString(request.query_string);
    } else if (isPlainObject(request.query_string)) {
      request.query_string = scrubSentryValue(request.query_string) as Record<string, unknown>;
    }
    if (request.headers && isPlainObject(request.headers)) {
      const headers: Record<string, unknown> = { ...request.headers };
      for (const key of Object.keys(headers)) {
        if (shouldScrubKey(key) || key.toLowerCase() === 'authorization') {
          headers[key] = SENTRY_REDACT_CENSOR;
        }
      }
      request.headers = headers;
    }
    if (request.data !== undefined) {
      request.data = scrubSentryValue(request.data);
    }
    next.request = request;
  }

  return next;
}

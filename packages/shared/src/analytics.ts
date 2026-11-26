import { FORBIDDEN_PUBLIC_KEYS } from '@wildwindow/geoprivacy';

/**
 * Extra location keys that must never leave the device in product analytics
 * (ARCHITECTURE §2 Observability / PRD PR5 — no cells or coordinates).
 * Case-insensitive; includes the geoprivacy public forbidden list.
 */
export const ANALYTICS_FORBIDDEN_KEYS = [
  ...FORBIDDEN_PUBLIC_KEYS,
  'cell',
  'cellR7',
  'cell_r7',
  'displayCell',
  'display_cell',
  'h3',
  'h3Index',
  'h3_index',
  'geometry',
  'geojson',
] as const;

const FORBIDDEN_KEY_SET = new Set(ANALYTICS_FORBIDDEN_KEYS.map((key) => key.toLowerCase()));

/**
 * Allowlisted PostHog events and their permitted property keys.
 * Properties outside the list (or on the forbidden list) are dropped.
 */
export const ANALYTICS_EVENT_ALLOWLIST = {
  forecast_viewed: ['taxonId', 'tier', 'region'],
  species_viewed: ['taxonId', 'tier', 'region'],
  waitlist_submitted: ['source', 'role', 'platform'],
  onboarding_completed: ['region'],
  challenge_viewed: ['slug', 'region'],
  share_card_created: ['kind', 'region'],
} as const satisfies Record<string, readonly string[]>;

export type AnalyticsEventName = keyof typeof ANALYTICS_EVENT_ALLOWLIST;

export type AnalyticsProperties = Readonly<Record<string, unknown>>;

export type SanitizedAnalyticsEvent = {
  readonly name: AnalyticsEventName;
  readonly properties: Record<string, string | number | boolean>;
};

export type AnalyticsTransport = {
  capture: (
    name: AnalyticsEventName,
    properties: Record<string, string | number | boolean>,
  ) => void;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isForbiddenAnalyticsKey(key: string): boolean {
  return FORBIDDEN_KEY_SET.has(key.toLowerCase());
}

function isPrimitiveProperty(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

/**
 * Drop forbidden location / geometry keys (any case, nested) from a property bag.
 * Reuses `FORBIDDEN_PUBLIC_KEYS` from `@wildwindow/geoprivacy` plus cell aliases.
 */
export function scrubAnalyticsProperties(input: unknown): Record<string, unknown> {
  if (!isPlainObject(input)) {
    return {};
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (isForbiddenAnalyticsKey(key)) {
      continue;
    }
    if (isPlainObject(value)) {
      out[key] = scrubAnalyticsProperties(value);
      continue;
    }
    if (Array.isArray(value)) {
      out[key] = value.map((item): unknown =>
        isPlainObject(item) ? scrubAnalyticsProperties(item) : item,
      );
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * Validate event name against the allowlist, scrub forbidden keys, then keep
 * only the properties declared for that event. Returns `null` when the name
 * is not allowlisted (unknown events are never forwarded).
 */
export function sanitizeAnalyticsEvent(
  name: string,
  properties: AnalyticsProperties = {},
): SanitizedAnalyticsEvent | null {
  if (!Object.prototype.hasOwnProperty.call(ANALYTICS_EVENT_ALLOWLIST, name)) {
    return null;
  }
  const eventName = name as AnalyticsEventName;
  const allowedKeys = new Set<string>(ANALYTICS_EVENT_ALLOWLIST[eventName]);
  const scrubbed = scrubAnalyticsProperties(properties);
  const next: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(scrubbed)) {
    if (!allowedKeys.has(key) || isForbiddenAnalyticsKey(key)) {
      continue;
    }
    if (!isPrimitiveProperty(value)) {
      continue;
    }
    next[key] = value;
  }

  return { name: eventName, properties: next };
}

/**
 * Product-analytics wrapper: allowlist + geoprivacy scrub before any transport.
 * When `transport` is null/undefined, `track` still sanitizes (for tests) but
 * does not send.
 */
export function createAnalytics(transport?: AnalyticsTransport | null): {
  track: (name: string, properties?: AnalyticsProperties) => SanitizedAnalyticsEvent | null;
  isEnabled: () => boolean;
} {
  return {
    isEnabled: () => transport != null,
    track(name, properties = {}) {
      const sanitized = sanitizeAnalyticsEvent(name, properties);
      if (sanitized === null) {
        return null;
      }
      transport?.capture(sanitized.name, sanitized.properties);
      return sanitized;
    },
  };
}

/** Default PostHog EU ingest host (ARCHITECTURE §2 — PostHog EU). */
export const POSTHOG_EU_HOST = 'https://eu.i.posthog.com';

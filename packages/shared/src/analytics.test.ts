import { FORBIDDEN_PUBLIC_KEYS } from '@wildwindow/geoprivacy';
import { describe, expect, it, vi } from 'vitest';

import {
  ANALYTICS_EVENT_ALLOWLIST,
  ANALYTICS_FORBIDDEN_KEYS,
  createAnalytics,
  POSTHOG_EU_HOST,
  sanitizeAnalyticsEvent,
  scrubAnalyticsProperties,
} from './analytics.js';

describe('analytics wrapper (T9.1)', () => {
  it('reuses every geoprivacy forbidden public key in the analytics denylist', () => {
    for (const key of FORBIDDEN_PUBLIC_KEYS) {
      expect(ANALYTICS_FORBIDDEN_KEYS.map((k) => k.toLowerCase())).toContain(key.toLowerCase());
    }
  });

  it('drops forbidden keys (any case) from property bags', () => {
    const scrubbed = scrubAnalyticsProperties({
      taxonId: 123,
      tier: 'open',
      region: 'scotland',
      lat: 55.86,
      LNG: -4.25,
      Latitude: 1,
      coordinates: [1, 2],
      cell: '8928308280fffff',
      cellR7: '8928308280fffff',
      displayCell: '852830827ffffff',
      nested: { longitude: 10, ok: true },
    });

    expect(scrubbed).toEqual({
      taxonId: 123,
      tier: 'open',
      region: 'scotland',
      nested: { ok: true },
    });
    for (const key of FORBIDDEN_PUBLIC_KEYS) {
      expect(scrubbed).not.toHaveProperty(key);
      expect(scrubbed).not.toHaveProperty(key.toUpperCase());
    }
  });

  it('sanitizeAnalyticsEvent keeps only allowlisted properties for forecast_viewed', () => {
    const result = sanitizeAnalyticsEvent('forecast_viewed', {
      taxonId: 2498260,
      tier: 'protected',
      region: 'scotland',
      cell: '8928308280fffff',
      lat: 55.86,
      lng: -4.25,
      extra: 'drop-me',
    });

    expect(result).toEqual({
      name: 'forecast_viewed',
      properties: {
        taxonId: 2498260,
        tier: 'protected',
        region: 'scotland',
      },
    });
  });

  it('drops the entire event when the name is not on the allowlist', () => {
    expect(sanitizeAnalyticsEvent('secret_pin_dropped', { region: 'sindh' })).toBeNull();
  });

  it('createAnalytics forwards only sanitized allowlisted events', () => {
    const capture = vi.fn();
    const analytics = createAnalytics({ capture });

    expect(
      analytics.track('forecast_viewed', {
        taxonId: 1,
        tier: 'open',
        region: 'sindh',
        lat: 24.86,
        cellR7: '8928308280fffff',
      }),
    ).toEqual({
      name: 'forecast_viewed',
      properties: { taxonId: 1, tier: 'open', region: 'sindh' },
    });
    expect(capture).toHaveBeenCalledWith('forecast_viewed', {
      taxonId: 1,
      tier: 'open',
      region: 'sindh',
    });

    expect(analytics.track('not_a_real_event', { region: 'scotland' })).toBeNull();
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it('documents the forecast_viewed allowlist shape from TASKS.md', () => {
    expect(ANALYTICS_EVENT_ALLOWLIST.forecast_viewed).toEqual(['taxonId', 'tier', 'region']);
    expect(POSTHOG_EU_HOST).toBe('https://eu.i.posthog.com');
  });
});

import { FORBIDDEN_PUBLIC_KEYS } from '@wildwindow/geoprivacy';
import { describe, expect, it } from 'vitest';

import {
  scrubSentryEvent,
  scrubSentryQueryString,
  scrubSentryValue,
  SENTRY_LOCATION_KEYS,
  SENTRY_REDACT_CENSOR,
} from './sentry-scrub.js';

describe('sentry scrub (T9.1)', () => {
  it('includes every geoprivacy forbidden public key', () => {
    for (const key of FORBIDDEN_PUBLIC_KEYS) {
      expect(SENTRY_LOCATION_KEYS.map((k) => k.toLowerCase())).toContain(key.toLowerCase());
    }
  });

  it('drops location keys and censors PII in nested values', () => {
    const scrubbed = scrubSentryValue({
      message: 'boom',
      lat: 55.86,
      extra: {
        email: 'user@example.com',
        cellR7: '8928308280fffff',
        taxonId: 1,
      },
    }) as Record<string, unknown>;

    expect(scrubbed).toEqual({
      message: 'boom',
      extra: {
        email: SENTRY_REDACT_CENSOR,
        taxonId: 1,
      },
    });
  });

  it('scrubs query strings for location keys', () => {
    const scrubbed = scrubSentryQueryString('?taxonId=1&lat=55.8&lng=-4.2');
    const params = new URLSearchParams(scrubbed.replace(/^\?/, ''));
    expect(params.get('taxonId')).toBe('1');
    expect(params.get('lat')).toBe(SENTRY_REDACT_CENSOR);
    expect(params.get('lng')).toBe(SENTRY_REDACT_CENSOR);
  });

  it('scrubSentryEvent strips user email/ip and request location query', () => {
    const event = scrubSentryEvent({
      message: 'err',
      user: { id: 'u1', email: 'a@b.c', ip_address: '1.2.3.4' },
      request: {
        url: 'https://api.example/v1/forecast?cell=abc&lat=1',
        headers: { authorization: 'Bearer secret', 'content-type': 'application/json' },
        data: { lng: -4, tier: 'open' },
      },
      extra: { coordinates: [1, 2], region: 'scotland' },
    });

    expect(event.user).toEqual({ id: 'u1' });
    const requestUrl = event.request.url;
    expect(requestUrl).toEqual(expect.stringContaining('forecast?'));
    if (typeof requestUrl !== 'string') {
      throw new Error('expected scrubbed request.url to remain a string');
    }
    const query = new URL(requestUrl).searchParams;
    expect(query.get('lat')).toBe(SENTRY_REDACT_CENSOR);
    expect(query.get('cell')).toBe(SENTRY_REDACT_CENSOR);
    expect(event.request.headers).toMatchObject({
      authorization: SENTRY_REDACT_CENSOR,
      'content-type': 'application/json',
    });
    expect(event.request.data).toEqual({ tier: 'open' });
    expect(event.extra).toEqual({ region: 'scotland' });
  });
});

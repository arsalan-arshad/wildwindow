import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { MetNoProvider, parseExpiresHeader } from './met-no.js';

const FIXTURE = JSON.parse(
  readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '__fixtures__/met-no-compact.json'),
    'utf8',
  ),
) as unknown;

const BASE = 'http://metno.test/compact';
const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe('MetNoProvider', () => {
  it('sends User-Agent, honours Expires, and derives precipProb from amount', async () => {
    let seenUa: string | null = null;
    let seenLat: string | null = null;
    let seenLon: string | null = null;

    server.use(
      http.get(BASE, ({ request }) => {
        seenUa = request.headers.get('user-agent');
        const url = new URL(request.url);
        seenLat = url.searchParams.get('lat');
        seenLon = url.searchParams.get('lon');
        return HttpResponse.json(FIXTURE as Record<string, unknown>, {
          headers: { Expires: 'Wed, 25 Nov 2026 14:00:00 GMT' },
        });
      }),
    );

    const provider = new MetNoProvider({
      userAgent: 'WildWindow/0.0 (+https://example.test; ww@example.test)',
      baseUrl: BASE,
      now: () => new Date('2026-11-25T12:00:00Z'),
    });

    const result = await provider.hourly(55.86, -4.25, new Date('2026-11-25T12:00:00Z'), 3);

    expect(seenUa).toContain('WildWindow');
    expect(seenLat).toBe('55.86');
    expect(seenLon).toBe('-4.25');
    expect(result.expiresAt?.toISOString()).toBe('2026-11-25T14:00:00.000Z');
    expect(result.hours).toHaveLength(3);

    const noon = result.hours[0];
    expect(noon?.precipProb).toBeCloseTo(0.1);
    expect(noon?.windKph).toBeCloseTo(18);

    // Missing probability_of_precipitation → min(1, 1.5/2) = 0.75
    const rainy = result.hours[1];
    expect(rainy?.precipMm).toBe(1.5);
    expect(rainy?.precipProb).toBeCloseTo(0.75);
  });

  it('requires a non-empty User-Agent', () => {
    expect(() => new MetNoProvider({ userAgent: '  ' })).toThrow(/WEATHER_USER_AGENT/);
  });
});

describe('parseExpiresHeader', () => {
  const now = new Date('2026-11-25T12:00:00Z');

  it('parses a future Expires header', () => {
    expect(parseExpiresHeader('Wed, 25 Nov 2026 13:00:00 GMT', now)?.toISOString()).toBe(
      '2026-11-25T13:00:00.000Z',
    );
  });

  it('returns null for missing or past Expires', () => {
    expect(parseExpiresHeader(null, now)).toBeNull();
    expect(parseExpiresHeader('Wed, 25 Nov 2026 11:00:00 GMT', now)).toBeNull();
  });
});

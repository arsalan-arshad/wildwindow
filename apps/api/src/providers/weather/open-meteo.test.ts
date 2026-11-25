import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { OpenMeteoProvider } from './open-meteo.js';

const FIXTURE = JSON.parse(
  readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '__fixtures__/open-meteo.json'),
    'utf8',
  ),
) as unknown;

const BASE = 'http://open-meteo.test/v1/forecast';
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

describe('OpenMeteoProvider', () => {
  it('parses hourly fixture and derives missing precipProb', async () => {
    server.use(http.get(BASE, () => HttpResponse.json(FIXTURE as Record<string, unknown>)));

    const provider = new OpenMeteoProvider({ baseUrl: BASE, nodeEnv: 'test' });
    const result = await provider.hourly(55.86, -4.25, new Date('2026-11-25T12:00:00Z'), 3);

    expect(result.expiresAt).toBeNull();
    expect(result.hours).toHaveLength(3);
    expect(result.hours[0]?.precipProb).toBeCloseTo(0.1);
    expect(result.hours[1]?.precipProb).toBeCloseTo(0.75);
    expect(result.hours[1]?.windKph).toBeCloseTo(28.8);
  });

  it('warns when constructed under NODE_ENV=production', () => {
    const warn = vi.fn();
    new OpenMeteoProvider({
      baseUrl: BASE,
      nodeEnv: 'production',
      logger: { warn },
    });
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/development only/i);
  });
});

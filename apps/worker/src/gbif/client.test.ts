import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createGbifClient } from './client.js';
import { GbifHttpError, GbifRetryExhaustedError } from './errors.js';

const BASE = 'http://gbif.test';

const credentials = {
  user: 'ww-test',
  password: 'secret',
  email: 'ww@example.com',
};

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

function client(overrides: { sleep?: (ms: number) => Promise<void>; maxAttempts?: number } = {}) {
  return createGbifClient({
    credentials,
    baseUrl: BASE,
    backoffBaseMs: 1,
    maxAttempts: overrides.maxAttempts ?? 4,
    sleep: overrides.sleep ?? (() => Promise.resolve()),
  });
}

describe('GbifClient.requestDownload', () => {
  it('POSTs BASIC auth + email notification and returns the download key', async () => {
    let seenAuth: string | null = null;
    let seenBody: unknown;

    server.use(
      http.post(`${BASE}/v1/occurrence/download/request`, async ({ request }) => {
        seenAuth = request.headers.get('Authorization');
        seenBody = await request.json();
        return new HttpResponse('0001234-testkey', {
          status: 201,
          headers: { 'Content-Type': 'text/plain' },
        });
      }),
    );

    const key = await client().requestDownload({
      predicate: {
        type: 'equals',
        key: 'COUNTRY',
        value: 'GB',
      },
    });

    expect(key).toBe('0001234-testkey');
    expect(seenAuth).toBe(`Basic ${Buffer.from('ww-test:secret', 'utf8').toString('base64')}`);
    expect(seenBody).toEqual({
      creator: 'ww-test',
      notificationAddresses: ['ww@example.com'],
      sendNotification: true,
      format: 'SIMPLE_CSV',
      predicate: {
        type: 'equals',
        key: 'COUNTRY',
        value: 'GB',
      },
    });
  });

  it('throws GbifHttpError on 401 without retrying forever', async () => {
    let hits = 0;
    server.use(
      http.post(`${BASE}/v1/occurrence/download/request`, () => {
        hits += 1;
        return HttpResponse.text('unauthorized', { status: 401 });
      }),
    );

    await expect(
      client({ maxAttempts: 3 }).requestDownload({
        predicate: { type: 'equals', key: 'COUNTRY', value: 'GB' },
      }),
    ).rejects.toBeInstanceOf(GbifHttpError);
    expect(hits).toBe(1);
  });
});

describe('GbifClient.getDownload', () => {
  it('parses status, DOI, link and totalRecords', async () => {
    server.use(
      http.get(`${BASE}/v1/occurrence/download/0001234-testkey`, () =>
        HttpResponse.json({
          key: '0001234-testkey',
          status: 'SUCCEEDED',
          doi: '10.15468/dl.example',
          downloadLink: `${BASE}/v1/occurrence/download/request/0001234-testkey.zip`,
          totalRecords: 42,
          size: 99,
          license: 'CC_BY_4_0',
          extraIgnored: true,
        }),
      ),
    );

    const download = await client().getDownload('0001234-testkey');
    expect(download).toEqual({
      key: '0001234-testkey',
      status: 'SUCCEEDED',
      doi: '10.15468/dl.example',
      downloadLink: `${BASE}/v1/occurrence/download/request/0001234-testkey.zip`,
      totalRecords: 42,
      size: 99,
      license: 'CC_BY_4_0',
    });
  });
});

describe('GbifClient.downloadFile', () => {
  it('streams the zip to disk', async () => {
    const zipBytes = Buffer.from('PK\u0003\u0004-fake-zip');
    server.use(
      http.get(
        `${BASE}/v1/occurrence/download/request/0001234-testkey.zip`,
        () =>
          new HttpResponse(zipBytes, {
            status: 200,
            headers: { 'Content-Type': 'application/zip' },
          }),
      ),
    );

    const dir = await mkdtemp(path.join(tmpdir(), 'ww-gbif-'));
    const dest = path.join(dir, 'out', 'download.zip');
    try {
      await client().downloadFile('0001234-testkey', dest);
      const written = await readFile(dest);
      expect(written.equals(zipBytes)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('GbifClient retries', () => {
  it('retries 503 then succeeds', async () => {
    let hits = 0;
    const sleep = vi.fn(() => Promise.resolve());

    server.use(
      http.get(`${BASE}/v1/occurrence/download/flaky`, () => {
        hits += 1;
        if (hits < 3) {
          return HttpResponse.text('busy', { status: 503 });
        }
        return HttpResponse.json({
          key: 'flaky',
          status: 'RUNNING',
        });
      }),
    );

    const download = await client({ sleep, maxAttempts: 4 }).getDownload('flaky');
    expect(download.status).toBe('RUNNING');
    expect(hits).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('exhausts retries on persistent 429', async () => {
    let hits = 0;
    server.use(
      http.get(`${BASE}/v1/occurrence/download/rate`, () => {
        hits += 1;
        return HttpResponse.text('slow down', { status: 429 });
      }),
    );

    await expect(client({ maxAttempts: 3 }).getDownload('rate')).rejects.toBeInstanceOf(
      GbifRetryExhaustedError,
    );
    expect(hits).toBe(3);
  });
});

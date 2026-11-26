import { describe, expect, it, vi } from 'vitest';

import { ApiClientError, createApiClient } from './client.js';

describe('createApiClient', () => {
  it('GETs /v1/health and parses the response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const client = createApiClient({
      baseUrl: 'https://api.example.test/',
      fetch: fetchMock,
    });

    await expect(client.health.get()).resolves.toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/v1/health',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('attaches the bearer token from getToken', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      getToken: () => 'token-abc',
      fetch: fetchMock,
    });

    await client.health.get();
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toMatchObject({ authorization: 'Bearer token-abc' });
  });

  it('GETs /v1/admin/session with bearer token (T7.6)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          role: 'admin',
          userId: '11111111-1111-4111-8111-111111111111',
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      getToken: () => 'admin-token',
      fetch: fetchMock,
    });

    await expect(client.admin.session()).resolves.toEqual({
      ok: true,
      role: 'admin',
      userId: '11111111-1111-4111-8111-111111111111',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/v1/admin/session',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('throws ApiClientError on non-OK responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 'WATCHLIST_LIMIT', message: 'Limit reached' }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      fetch: fetchMock,
    });

    await expect(
      client.me.watchlist.add({ taxonId: '1', cellR7: '871f1d489ffffff' }),
    ).rejects.toBeInstanceOf(ApiClientError);
  });
});

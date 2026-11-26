import { createMobileApiClient, getApiBaseUrl } from '@/lib/api';

describe('mobile API client (T6.1 / T6.7)', () => {
  it('exposes a base URL from EXPO_PUBLIC_API_URL or the default', () => {
    const url = getApiBaseUrl();
    expect(url.length).toBeGreaterThan(0);
    expect(url.endsWith('/')).toBe(false);
  });

  it('builds a typed client with health.get', async () => {
    const fetchMock = jest.fn(async () =>
      Response.json({ status: 'ok' }, { status: 200 }),
    ) as unknown as typeof fetch;

    const client = createMobileApiClient({ fetch: fetchMock });
    const health = await client.health.get();

    expect(health).toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalled();
    const [calledUrl] = (fetchMock as jest.Mock).mock.calls[0] as [string];
    expect(calledUrl).toContain('/v1/health');
  });

  it('attaches Authorization Bearer from getToken (T6.7)', async () => {
    const fetchMock = jest.fn(async () =>
      Response.json(
        {
          id: '00000000-0000-4000-8000-000000000001',
          displayName: null,
          homeRegionSlug: null,
          locale: 'en',
          role: 'user',
        },
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const client = createMobileApiClient({
      fetch: fetchMock,
      getToken: async () => 'firebase-id-token',
    });
    await client.me.get();

    const init = (fetchMock as jest.Mock).mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['authorization']).toBe('Bearer firebase-id-token');
  });
});

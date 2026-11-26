import { createMobileApiClient, getApiBaseUrl } from '@/lib/api';

describe('mobile API client (T6.1)', () => {
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
});

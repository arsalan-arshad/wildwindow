export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
  }
}

function emptyAsync<T>(value: T): () => Promise<T> {
  return async () => value;
}

/**
 * Jest stub for `@wildwindow/shared/client`.
 * Screens under test should inject a richer `apiClient` via AppProviders.
 */
export function createApiClient(options: {
  readonly baseUrl: string;
  readonly getToken?: () => string | undefined | Promise<string | undefined>;
  readonly fetch?: typeof fetch;
}) {
  const fetcher = options.fetch ?? fetch;
  const base = options.baseUrl.replace(/\/+$/, '');

  async function authHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (options.getToken !== undefined) {
      const token = await options.getToken();
      if (token !== undefined && token.length > 0) {
        headers['authorization'] = `Bearer ${token}`;
      }
    }
    return headers;
  }

  return {
    health: {
      get: async () => {
        const response = await fetcher(`${base}/v1/health`, {
          method: 'GET',
          headers: await authHeaders(),
        });
        const data: unknown = await response.json();
        return data;
      },
    },
    regions: {
      list: emptyAsync({ regions: [] }),
      species: emptyAsync({ regionSlug: 'scotland', species: [] }),
    },
    species: {
      get: emptyAsync({
        taxonId: '0',
        scientificName: '',
        commonNames: { en: '' },
        group: 'bird',
        regionSlug: 'scotland',
        tier: 'open',
        coastal: false,
        tidePref: null,
        activityPattern: null,
        challengeEligible: false,
        card: null,
      }),
      seasonality: emptyAsync({
        taxonId: '0',
        regionSlug: 'scotland',
        weeks: Array.from({ length: 52 }, () => 0),
      }),
      map: emptyAsync({ taxonId: '0', regionSlug: 'scotland', cells: [] }),
    },
    places: {
      search: emptyAsync({ places: [] }),
    },
    areas: {
      get: emptyAsync({
        cellR7: '',
        label: '',
        regionSlug: 'scotland',
        covered: false,
      }),
    },
    forecast: {
      get: emptyAsync({ status: 'unavailable' }),
    },
    attributions: {
      list: emptyAsync({ items: [] }),
    },
    waitlist: {
      join: emptyAsync({ ok: true }),
    },
    me: {
      get: async () => {
        const response = await fetcher(`${base}/v1/me`, {
          method: 'GET',
          headers: await authHeaders(),
        });
        const data: unknown = await response.json();
        return data;
      },
      patch: emptyAsync({}),
      delete: emptyAsync({ ok: true }),
      export: emptyAsync({ ok: true }),
      watchlist: {
        list: emptyAsync({ items: [], limit: 3 }),
        add: emptyAsync({}),
        remove: emptyAsync(undefined),
      },
      logbook: {
        list: emptyAsync({ items: [] }),
        create: emptyAsync({}),
        get: emptyAsync({}),
        patch: emptyAsync({}),
        remove: emptyAsync(undefined),
      },
    },
    uploads: {
      presign: emptyAsync({}),
    },
    challenges: {
      current: emptyAsync({}),
      get: emptyAsync({}),
      entries: emptyAsync({ entries: [] }),
      submit: emptyAsync({ ok: true }),
    },
    admin: {
      species: {
        get: emptyAsync({}),
        patch: emptyAsync({}),
      },
      taxonRegion: {
        get: emptyAsync({}),
        patch: emptyAsync({}),
      },
      challengeEntries: {
        list: emptyAsync({ entries: [] }),
        get: emptyAsync({}),
        patch: emptyAsync({}),
      },
      ingestRuns: {
        list: emptyAsync({ runs: [] }),
      },
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
export type CreateApiClientOptions = Parameters<typeof createApiClient>[0];

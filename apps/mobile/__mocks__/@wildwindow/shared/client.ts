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

export function createApiClient(options: {
  readonly baseUrl: string;
  readonly getToken?: () => string | undefined | Promise<string | undefined>;
  readonly fetch?: typeof fetch;
}) {
  const fetcher = options.fetch ?? fetch;

  return {
    health: {
      get: async () => {
        const response = await fetcher(`${options.baseUrl.replace(/\/+$/, '')}/v1/health`, {
          method: 'GET',
          headers: { accept: 'application/json' },
        });
        const data: unknown = await response.json();
        return data;
      },
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
export type CreateApiClientOptions = Parameters<typeof createApiClient>[0];

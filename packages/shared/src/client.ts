import {
  WaitlistSignupOkSchema,
  WaitlistSignupRequestSchema,
  type WaitlistSignupOk,
  type WaitlistSignupRequest,
} from './api/waitlist.js';

export type CreateApiClientOptions = {
  readonly baseUrl: string;
  readonly getToken?: () => string | undefined | Promise<string | undefined>;
  readonly fetch?: typeof fetch;
};

export type ApiClient = {
  readonly waitlist: {
    join: (body: WaitlistSignupRequest) => Promise<WaitlistSignupOk>;
  };
};

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

/**
 * Typed HTTP client for Nest `/v1` (ARCHITECTURE §7).
 * Browser and mobile use this with `NEXT_PUBLIC_API_URL` / `EXPO_PUBLIC_API_URL`.
 */
export function createApiClient(options: CreateApiClientOptions): ApiClient {
  const fetcher = options.fetch ?? fetch;

  async function postJson<T>(path: string, body: unknown, parse: (data: unknown) => T): Promise<T> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json',
    };
    const token = options.getToken !== undefined ? await options.getToken() : undefined;
    if (token !== undefined && token.length > 0) {
      headers['authorization'] = `Bearer ${token}`;
    }

    const response = await fetcher(joinUrl(options.baseUrl, path), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const code =
        typeof data === 'object' && data !== null && 'code' in data && typeof data.code === 'string'
          ? (data as { code: string }).code
          : 'HTTP_ERROR';
      const message =
        typeof data === 'object' &&
        data !== null &&
        'message' in data &&
        typeof data.message === 'string'
          ? (data as { message: string }).message
          : `Request failed with status ${String(response.status)}`;
      throw new ApiClientError(code, message, response.status);
    }

    return parse(data);
  }

  return {
    waitlist: {
      async join(body) {
        const parsed = WaitlistSignupRequestSchema.parse(body);
        return postJson('/v1/waitlist', parsed, (data) => WaitlistSignupOkSchema.parse(data));
      },
    },
  };
}

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

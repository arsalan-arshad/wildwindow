import { createApiClient, type ApiClient } from '@wildwindow/shared/client';
import Constants from 'expo-constants';

function readConfiguredApiUrl(): string | undefined {
  const fromEnv = process.env['EXPO_PUBLIC_API_URL'];
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }

  const extra = Constants.expoConfig?.extra;
  if (extra !== undefined && typeof extra === 'object' && extra !== null && 'apiUrl' in extra) {
    const value = extra['apiUrl'];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

export function getApiBaseUrl(): string {
  const url = readConfiguredApiUrl() ?? 'http://localhost:3001';
  return url.replace(/\/+$/, '');
}

export type CreateMobileApiClientOptions = {
  readonly getToken?: () => string | undefined | Promise<string | undefined>;
  readonly fetch?: typeof fetch;
};

/**
 * Typed `/v1` client for the Expo app (ARCHITECTURE §7, T5.1 / T6.7).
 * Pass `getToken` from Auth so Nest receives `Authorization: Bearer <idToken>`.
 */
export function createMobileApiClient(options: CreateMobileApiClientOptions = {}): ApiClient {
  return createApiClient({
    baseUrl: getApiBaseUrl(),
    ...(options.getToken !== undefined ? { getToken: options.getToken } : {}),
    ...(options.fetch !== undefined ? { fetch: options.fetch } : {}),
  });
}

import { createApiClient, type ApiClient } from '@wildwindow/shared/client';

export function getApiBaseUrl(): string {
  const url = process.env['NEXT_PUBLIC_API_URL'];
  if (url === undefined || url.trim().length === 0) {
    throw new Error('NEXT_PUBLIC_API_URL is not configured');
  }
  return url.replace(/\/+$/, '');
}

export function getBrowserApiClient(): ApiClient {
  return createApiClient({ baseUrl: getApiBaseUrl() });
}

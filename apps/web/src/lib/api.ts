import { createApiClient, type ApiClient } from '@wildwindow/shared/client';

export function tryGetApiBaseUrl(): string | null {
  const url = process.env['NEXT_PUBLIC_API_URL'];
  if (url === undefined || url.trim().length === 0) {
    return null;
  }
  return url.replace(/\/+$/, '');
}

export function getApiBaseUrl(): string {
  const url = tryGetApiBaseUrl();
  if (url === null) {
    throw new Error('NEXT_PUBLIC_API_URL is not configured');
  }
  return url;
}

export function getBrowserApiClient(): ApiClient {
  return createApiClient({ baseUrl: getApiBaseUrl() });
}

/** Server-side client for ISR / static generation. Returns null when env is unset (CI build). */
export function tryGetServerApiClient(): ApiClient | null {
  const baseUrl = tryGetApiBaseUrl();
  if (baseUrl === null) {
    return null;
  }
  return createApiClient({ baseUrl });
}

export function getSiteUrl(): string {
  return process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://wildwindow.arsalandev.studio';
}

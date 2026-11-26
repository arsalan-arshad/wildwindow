import Constants from 'expo-constants';

/** Matches the web default when `NEXT_PUBLIC_SITE_URL` is unset (docs/RAILWAY.md). */
export const DEFAULT_SITE_URL = 'https://wildwindow.arsalandev.studio';

function readConfiguredSiteUrl(): string | undefined {
  const fromEnv = process.env['EXPO_PUBLIC_SITE_URL'];
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }

  const extra = Constants.expoConfig?.extra;
  if (extra !== undefined && typeof extra === 'object' && extra !== null && 'siteUrl' in extra) {
    const value = extra['siteUrl'];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

/** Canonical public web origin used for `/api/og/...` share-card previews (T6.11 / T7.4). */
export function getSiteUrl(): string {
  const url = readConfiguredSiteUrl() ?? DEFAULT_SITE_URL;
  return url.replace(/\/+$/, '');
}

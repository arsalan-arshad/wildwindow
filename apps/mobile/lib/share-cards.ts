/**
 * Share-card URL builders and expo-sharing helper (S-15 / T6.11).
 * Preview images come from the web `/api/og/...` routes (T7.4).
 * Card URLs must never carry lat/lng — only taxon/cell/start or entryId.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { getSiteUrl } from '@/lib/site-url';

/** Decimal degrees-ish fragments (e.g. 55.865, -4.257). Matches web og/public-safe. */
const COORD_FRAGMENT_PATTERN = /[-+]?\d{1,3}\.\d{3,}/;

export type ForecastShareParams = {
  readonly taxonId: string;
  readonly cell: string;
  readonly start: string;
};

export type ChallengeShareParams = {
  readonly entryId: string;
  readonly slug?: string;
};

export type ShareCardTarget =
  | ({ readonly kind: 'forecast' } & ForecastShareParams)
  | ({ readonly kind: 'challenge' } & ChallengeShareParams);

export type ShareCardResult = 'shared' | 'unavailable';

export type ShareCardDeps = {
  readonly downloadAsync?: typeof FileSystem.downloadAsync;
  readonly cacheDirectory?: string | null;
  readonly isAvailableAsync?: typeof Sharing.isAvailableAsync;
  readonly shareAsync?: typeof Sharing.shareAsync;
  readonly now?: () => number;
};

/** True when a URL string looks like it embeds lat/lng coordinates (T6.11 acceptance). */
export function cardUrlHasCoordinates(url: string): boolean {
  return COORD_FRAGMENT_PATTERN.test(url);
}

export function buildForecastCardUrl(
  params: ForecastShareParams,
  siteUrl: string = getSiteUrl(),
): string {
  const base = siteUrl.replace(/\/+$/, '');
  const query = new URLSearchParams({
    taxonId: params.taxonId,
    cell: params.cell,
    start: params.start,
  });
  const url = `${base}/api/og/forecast?${query.toString()}`;
  if (cardUrlHasCoordinates(url)) {
    throw new Error('forecast share card URL must not include coordinates');
  }
  return url;
}

export function buildChallengeCardUrl(
  params: ChallengeShareParams,
  siteUrl: string = getSiteUrl(),
): string {
  const base = siteUrl.replace(/\/+$/, '');
  const entryId = encodeURIComponent(params.entryId.trim());
  const query =
    params.slug !== undefined && params.slug.trim().length > 0
      ? `?${new URLSearchParams({ slug: params.slug.trim() }).toString()}`
      : '';
  const url = `${base}/api/og/challenge/${entryId}${query}`;
  if (cardUrlHasCoordinates(url)) {
    throw new Error('challenge share card URL must not include coordinates');
  }
  return url;
}

export function buildShareCardUrl(target: ShareCardTarget, siteUrl?: string): string {
  if (target.kind === 'forecast') {
    return buildForecastCardUrl(target, siteUrl);
  }
  return buildChallengeCardUrl(target, siteUrl);
}

/**
 * Download the OG PNG to the device cache and open the native share sheet.
 * Shares the image file (not the OG URL), so H3 cells in the query never leave the device as a link.
 */
export async function downloadAndShareCard(
  imageUrl: string,
  deps: ShareCardDeps = {},
): Promise<ShareCardResult> {
  if (cardUrlHasCoordinates(imageUrl)) {
    throw new Error('refusing to download a share card URL that contains coordinates');
  }

  const isAvailable = deps.isAvailableAsync ?? Sharing.isAvailableAsync;
  const shareAsync = deps.shareAsync ?? Sharing.shareAsync;
  const downloadAsync = deps.downloadAsync ?? FileSystem.downloadAsync;
  const cacheDirectory =
    deps.cacheDirectory !== undefined ? deps.cacheDirectory : FileSystem.cacheDirectory;

  if (!(await isAvailable())) {
    return 'unavailable';
  }
  if (cacheDirectory === null || cacheDirectory.length === 0) {
    return 'unavailable';
  }

  const stamp = (deps.now ?? Date.now)();
  const dest = `${cacheDirectory}wildwindow-share-${stamp}.png`;
  const downloaded = await downloadAsync(imageUrl, dest);
  await shareAsync(downloaded.uri, {
    mimeType: 'image/png',
    UTI: 'public.png',
    dialogTitle: 'WildWindow',
  });
  return 'shared';
}

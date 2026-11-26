/**
 * Watchlist helpers (S-03 / T6.8, US-10).
 * Free tier caps at WATCHLIST_LIMIT_FREE (default 3); no paywall copy in MVP.
 */

export const WATCHLIST_LIMIT_CODE = 'WATCHLIST_LIMIT' as const;

/** Default free-tier capacity when the API response has no limit yet. */
export const WATCHLIST_LIMIT_FREE_DEFAULT = 3;

export function isWatchlistLimitError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  if (!('code' in error)) {
    return false;
  }
  return (error as { code: unknown }).code === WATCHLIST_LIMIT_CODE;
}

export function isAtWatchlistLimit(itemCount: number, limit: number): boolean {
  return itemCount >= limit;
}

export type WatchlistItemWire = {
  readonly id: string;
  readonly taxonId: string;
  readonly cellR7: string;
  readonly createdAt: string;
};

export type WatchlistResponseWire = {
  readonly items: readonly WatchlistItemWire[];
  readonly limit: number;
};

/** Find a saved pair for the current species + cell (cell match is case-insensitive). */
export function findWatchlistItem(
  items: readonly WatchlistItemWire[],
  taxonId: string,
  cellR7: string,
): WatchlistItemWire | undefined {
  const cell = cellR7.toLowerCase();
  return items.find((item) => item.taxonId === taxonId && item.cellR7.toLowerCase() === cell);
}

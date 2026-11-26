import {
  findWatchlistItem,
  isAtWatchlistLimit,
  isWatchlistLimitError,
  WATCHLIST_LIMIT_CODE,
} from '@/lib/watchlist';

describe('watchlist helpers (T6.8)', () => {
  it('detects WATCHLIST_LIMIT from objects with a code field', () => {
    expect(isWatchlistLimitError({ code: WATCHLIST_LIMIT_CODE, status: 409 })).toBe(true);
    const err = new Error('full') as Error & { code: string };
    err.code = WATCHLIST_LIMIT_CODE;
    expect(isWatchlistLimitError(err)).toBe(true);
    expect(isWatchlistLimitError(new Error('nope'))).toBe(false);
    expect(isWatchlistLimitError(null)).toBe(false);
  });

  it('treats itemCount >= limit as full', () => {
    expect(isAtWatchlistLimit(3, 3)).toBe(true);
    expect(isAtWatchlistLimit(2, 3)).toBe(false);
    expect(isAtWatchlistLimit(4, 3)).toBe(true);
  });

  it('finds a pair by taxon and cell (case-insensitive cell)', () => {
    const items = [
      {
        id: '1',
        taxonId: '2481',
        cellR7: '871f1d489ffffff',
        createdAt: '2026-11-26T12:00:00.000Z',
      },
    ];
    expect(findWatchlistItem(items, '2481', '871F1D489FFFFFF')?.id).toBe('1');
    expect(findWatchlistItem(items, '999', '871f1d489ffffff')).toBeUndefined();
  });
});

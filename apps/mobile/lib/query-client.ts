/**
 * TanStack Query client defaults for mobile (T6.13).
 * gcTime must cover the persist maxAge so dehydrated forecasts/cards survive.
 */
import { QueryClient, type Query } from '@tanstack/react-query';

/** Keep device cache for 24 hours (S5 / T6.13). */
export const QUERY_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24;

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: QUERY_CACHE_MAX_AGE_MS,
        retry: 1,
      },
    },
  });
}

/**
 * Persist only forecast and species (field-card) queries.
 * Watchlist / auth / challenge traffic stays in-memory.
 */
export function shouldPersistQuery(query: Query): boolean {
  if (query.state.status !== 'success') {
    return false;
  }
  const root = query.queryKey[0];
  return root === 'forecast' || root === 'species';
}

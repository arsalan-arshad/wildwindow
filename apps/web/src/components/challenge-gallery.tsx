'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  ChallengeCountryCount,
  ChallengeEntriesQuery,
  ChallengeEntriesResponse,
  ChallengeEntryPublic,
} from '@wildwindow/shared/api';

import { getBrowserApiClient } from '@/lib/api';
import { countryDisplayName, formatEntryPlace } from '@/lib/challenge';

export type ChallengeGalleryProps = {
  readonly slug: string;
  readonly countryCounts: readonly ChallengeCountryCount[];
  /**
   * Injected loader for tests / SSR fixtures.
   * Defaults to GET /v1/challenges/:slug/entries via the typed client.
   */
  readonly loadEntries?: (
    slug: string,
    query: ChallengeEntriesQuery,
  ) => Promise<ChallengeEntriesResponse>;
};

type CountryFilter = 'all' | string;

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ok' }
  | { readonly status: 'error'; readonly message: string };

async function defaultLoadEntries(
  slug: string,
  query: ChallengeEntriesQuery,
): Promise<ChallengeEntriesResponse> {
  return getBrowserApiClient().challenges.entries(slug, query);
}

/**
 * Public challenge gallery (W-04): country tabs + cursor pagination.
 * Entries show country and region only (No-Pin).
 */
export function ChallengeGallery({ slug, countryCounts, loadEntries }: ChallengeGalleryProps) {
  const fetchEntries = loadEntries ?? defaultLoadEntries;
  const [country, setCountry] = useState<CountryFilter>('all');
  const [entries, setEntries] = useState<ChallengeEntryPublic[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [loadingMore, setLoadingMore] = useState(false);

  const tabs = useMemo(() => {
    const allCount = countryCounts.reduce((sum, row) => sum + row.count, 0);
    const items: { readonly id: CountryFilter; readonly label: string }[] = [
      { id: 'all', label: `All (${String(allCount)})` },
    ];
    for (const row of countryCounts) {
      items.push({
        id: row.countryCode,
        label: `${countryDisplayName(row.countryCode)} (${String(row.count)})`,
      });
    }
    return items;
  }, [countryCounts]);

  const reload = useCallback(
    async (filter: CountryFilter) => {
      setLoadState({ status: 'loading' });
      setEntries([]);
      setNextCursor(null);
      try {
        const query: ChallengeEntriesQuery = filter === 'all' ? {} : { country: filter };
        const page = await fetchEntries(slug, query);
        setEntries([...page.entries]);
        setNextCursor(page.nextCursor);
        setLoadState({ status: 'ok' });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Could not load challenge entries.';
        setLoadState({ status: 'error', message });
      }
    },
    [fetchEntries, slug],
  );

  useEffect(() => {
    void reload(country);
  }, [country, reload]);

  async function onLoadMore() {
    if (nextCursor === null || loadingMore) {
      return;
    }
    setLoadingMore(true);
    try {
      const query: ChallengeEntriesQuery = {
        ...(country !== 'all' ? { country } : {}),
        cursor: nextCursor,
      };
      const page = await fetchEntries(slug, query);
      setEntries((prev) => [...prev, ...page.entries]);
      setNextCursor(page.nextCursor);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not load more challenge entries.';
      setLoadState({ status: 'error', message });
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section
      className="space-y-6"
      data-testid="challenge-gallery"
      aria-labelledby="gallery-heading"
    >
      <div>
        <h2
          id="gallery-heading"
          className="font-[family-name:var(--font-fraunces)] text-2xl text-forest-800"
        >
          Gallery
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Approved entries show country and region only — never an exact spot.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Filter by country"
        className="flex flex-wrap gap-2"
        data-testid="challenge-gallery-tabs"
      >
        {tabs.map((tab) => {
          const selected = tab.id === country;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              data-testid={`challenge-gallery-tab-${tab.id}`}
              onClick={() => {
                setCountry(tab.id);
              }}
              className={
                selected
                  ? 'rounded-md bg-forest-800 px-3.5 py-2 text-sm font-semibold text-paper'
                  : 'rounded-md border border-forest-800/15 bg-mist/40 px-3.5 py-2 text-sm font-medium text-ink-muted transition hover:border-forest-600 hover:text-forest-600'
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {loadState.status === 'loading' ? (
        <p className="text-ink-muted" role="status" data-testid="challenge-gallery-loading">
          Loading entries…
        </p>
      ) : null}

      {loadState.status === 'error' ? (
        <p className="text-danger" role="alert" data-testid="challenge-gallery-error">
          {loadState.message}
        </p>
      ) : null}

      {loadState.status === 'ok' && entries.length === 0 ? (
        <p className="text-ink-muted" role="status" data-testid="challenge-gallery-empty">
          No published entries for this filter yet.
        </p>
      ) : null}

      {entries.length > 0 ? (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2" data-testid="challenge-gallery-grid">
          {entries.map((entry) => (
            <li
              key={entry.id}
              data-testid={`challenge-gallery-item-${entry.id}`}
              className="overflow-hidden rounded-lg border border-forest-800/10 bg-mist/30"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- signed CDN URLs; sizes vary */}
              <img
                src={entry.photoUrl}
                alt=""
                className="aspect-square w-full object-cover bg-mist"
                data-testid={`challenge-gallery-photo-${entry.id}`}
              />
              <div className="space-y-1 px-4 py-3">
                <p
                  className="font-semibold text-ink"
                  data-testid={`challenge-gallery-place-${entry.id}`}
                >
                  {formatEntryPlace(entry.regionLabel, entry.countryCode)}
                </p>
                <p
                  className="text-sm text-ink-muted"
                  data-testid={`challenge-gallery-country-${entry.id}`}
                >
                  {countryDisplayName(entry.countryCode)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {loadState.status === 'ok' && nextCursor !== null ? (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            data-testid="challenge-gallery-more"
            onClick={() => {
              void onLoadMore();
            }}
            disabled={loadingMore}
            className="rounded-md border border-forest-800/20 px-5 py-2.5 text-sm font-semibold text-forest-600 transition hover:border-forest-600 disabled:opacity-60"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      ) : null}
    </section>
  );
}

import type { ApiClient } from '@wildwindow/shared/client';
import type {
  AreaResponse,
  AttributionsResponse,
  LogbookCreateRequest,
  LogbookEntryOwner,
  LogbookEntryPublic,
  LogbookPatchRequest,
  MeExportOk,
  MePatchRequest,
  MeProfile,
  PlaceSummary,
  PresignUploadRequest,
  PresignUploadResponse,
} from '@wildwindow/shared';

import type {
  ChallengeEntriesPage,
  ChallengeEntryPublic,
  ChallengeLogbookCandidate,
  ChallengeSummary,
} from '@/lib/challenge';
import type { ForecastResponse } from '@/lib/forecast';
import type { SeasonalityResponse, SpeciesDetail, SpeciesListItem } from '@/lib/species';

export type MockSpeciesApi = {
  readonly list: SpeciesListItem[];
  readonly detailById: Readonly<Record<string, SpeciesDetail>>;
  readonly seasonalityById: Readonly<Record<string, SeasonalityResponse>>;
};

export type MockPlacesApi = {
  readonly places?: readonly PlaceSummary[];
  readonly areasByCell?: Readonly<Record<string, AreaResponse>>;
};

export type MockForecastApi = {
  readonly byKey?: Readonly<Record<string, ForecastResponse>>;
  readonly get?: (query: {
    readonly taxonId: string;
    readonly cell: string;
    readonly start: string;
  }) => Promise<ForecastResponse>;
};

export type MockLogbookApi = {
  readonly items?: LogbookEntryPublic[];
  readonly byId?: Readonly<Record<string, LogbookEntryOwner>>;
  readonly create?: (body: LogbookCreateRequest) => Promise<LogbookEntryOwner>;
  readonly patch?: (id: string, body: LogbookPatchRequest) => Promise<LogbookEntryOwner>;
  readonly remove?: (id: string) => Promise<void>;
  readonly presign?: (body: PresignUploadRequest) => Promise<PresignUploadResponse>;
};

export type MockChallengeApi = {
  readonly current?: ChallengeSummary | null;
  readonly bySlug?: Readonly<Record<string, ChallengeSummary>>;
  readonly entriesBySlug?: Readonly<Record<string, readonly ChallengeEntryPublic[]>>;
  /** Convenience seed for challenge submit tests (overrides logbook list items). */
  readonly logbookItems?: readonly ChallengeLogbookCandidate[];
  readonly submit?: (slug: string, body: unknown) => Promise<{ id: string; status: 'pending' }>;
};

export type MockWatchlistItem = {
  readonly id: string;
  readonly taxonId: string;
  readonly cellR7: string;
  readonly createdAt?: string;
};

export type MockWatchlistApi = {
  readonly items?: readonly MockWatchlistItem[];
  readonly limit?: number;
  readonly add?: (body: { taxonId: string; cellR7: string }) => Promise<MockWatchlistItem>;
  readonly remove?: (id: string) => Promise<void>;
};

export type MockMeApi = {
  readonly profile?: MeProfile;
  readonly patch?: (body: MePatchRequest) => Promise<MeProfile>;
  readonly delete?: () => Promise<{ ok: true; purgeAfterDays: 30 }>;
  readonly export?: () => Promise<MeExportOk>;
};

export type MockAttributionsApi = {
  readonly data?: AttributionsResponse;
  readonly list?: () => Promise<AttributionsResponse>;
};

export type MockBugReportsApi = {
  readonly create?: (
    body: unknown,
  ) => Promise<
    | { readonly status: 'filed'; readonly issueNumber: number }
    | { readonly status: 'fallback'; readonly url: string }
  >;
};

export const emptyAttributionsFixture: AttributionsResponse = {
  datasets: [],
  providers: [],
};

const EMPTY_WEEKS = Array.from({ length: 52 }, () => 0);

export function forecastFixtureKey(taxonId: string, cell: string, start: string): string {
  return `${taxonId}|${cell}|${start}`;
}

export function createMockSpeciesApiClient(
  fixtures: MockSpeciesApi,
  placesFixtures: MockPlacesApi = {},
  forecastFixtures: MockForecastApi = {},
  logbookFixtures: MockLogbookApi = {},
  challengeFixtures: MockChallengeApi = {},
  watchlistFixtures: MockWatchlistApi = {},
  meFixtures: MockMeApi = {},
  attributionsFixtures: MockAttributionsApi = {},
  bugReportsFixtures: MockBugReportsApi = {},
): ApiClient {
  const places = placesFixtures.places ?? [];
  const areasByCell = placesFixtures.areasByCell ?? {};
  const forecastByKey = forecastFixtures.byKey ?? {};
  const challengeBySlug = challengeFixtures.bySlug ?? {};
  const entriesBySlug = challengeFixtures.entriesBySlug ?? {};
  const watchlistLimit = watchlistFixtures.limit ?? 3;

  let watchlistItems: MockWatchlistItem[] = [...(watchlistFixtures.items ?? [])];

  let logbookItems: LogbookEntryPublic[] =
    challengeFixtures.logbookItems !== undefined
      ? challengeFixtures.logbookItems.map((row) => ({
          id: row.id,
          taxonId: row.taxonId,
          takenAt: row.takenAt,
          cellR7: null,
          photoKey: `photos/${row.id}.jpg`,
          thumbKey: null,
          exif: {},
          notes: row.notes,
          createdAt: row.takenAt,
          updatedAt: row.takenAt,
        }))
      : [...(logbookFixtures.items ?? [])];

  const logbookById: Record<string, LogbookEntryOwner> = {
    ...(logbookFixtures.byId ?? {}),
  };

  async function resolveChallenge(slug: string): Promise<ChallengeSummary> {
    const hit = challengeBySlug[slug];
    if (hit !== undefined) {
      return hit;
    }
    if (challengeFixtures.current !== undefined && challengeFixtures.current?.slug === slug) {
      return challengeFixtures.current;
    }
    const err = new Error(`missing challenge ${slug}`) as Error & { status: number };
    err.status = 404;
    throw err;
  }

  return {
    health: { get: async () => ({ status: 'ok' as const }) },
    regions: {
      list: async () => ({ regions: [] }),
      species: async (_slug: string, query?: { q?: string; group?: string }) => {
        let species = fixtures.list;
        const group = query?.group;
        if (group !== undefined) {
          species = species.filter((item) => item.group === group);
        }
        const q = query?.q?.trim().toLowerCase();
        if (q !== undefined && q.length > 0) {
          species = species.filter((item) => {
            const haystack = [item.scientificName, item.commonNames.en, item.commonNames.ur ?? '']
              .join(' ')
              .toLowerCase();
            return haystack.includes(q);
          });
        }
        return { regionSlug: 'scotland' as const, species };
      },
    },
    species: {
      get: async (taxonId: string) => {
        const detail = fixtures.detailById[taxonId];
        if (detail === undefined) {
          throw new Error(`missing species ${taxonId}`);
        }
        return detail;
      },
      seasonality: async (taxonId: string) => {
        const seasonality = fixtures.seasonalityById[taxonId];
        if (seasonality === undefined) {
          return {
            taxonId,
            regionSlug: 'scotland',
            weeks: EMPTY_WEEKS,
          };
        }
        return seasonality;
      },
      map: async (taxonId: string) => ({
        taxonId,
        regionSlug: 'scotland' as const,
        cells: [],
      }),
    },
    places: {
      search: async (query: { q: string; region?: string }) => {
        const q = query.q.trim().toLowerCase();
        const filtered = places.filter((place) => {
          if (query.region !== undefined && place.regionSlug !== query.region) {
            return false;
          }
          return place.name.toLowerCase().includes(q);
        });
        return { places: filtered };
      },
    },
    areas: {
      get: async (cellR7: string) => {
        const area = areasByCell[cellR7];
        if (area !== undefined) {
          return area;
        }
        return {
          cellR7,
          label: 'Not covered yet',
          regionSlug: null,
          covered: false,
        } satisfies AreaResponse;
      },
    },
    forecast: {
      get:
        forecastFixtures.get ??
        (async (query: { taxonId: string; cell: string; start: string }) => {
          const key = forecastFixtureKey(query.taxonId, query.cell, query.start);
          const hit = forecastByKey[key];
          if (hit !== undefined) {
            return hit;
          }
          // Fall back to any fixture for this taxon+cell (start may vary in tests).
          const prefix = `${query.taxonId}|${query.cell}|`;
          const match = Object.entries(forecastByKey).find(([k]) => k.startsWith(prefix));
          if (match !== undefined) {
            return match[1];
          }
          throw new Error(`missing forecast ${key}`);
        }),
    },
    attributions: {
      list:
        attributionsFixtures.list ??
        (async () => attributionsFixtures.data ?? emptyAttributionsFixture),
    },
    waitlist: {
      join: async () => ({ ok: true as const }),
    },
    bugReports: {
      create:
        bugReportsFixtures.create ??
        (async () => ({
          status: 'fallback' as const,
          url: 'https://github.com/arsalan-arshad/wildwindow/issues/new?template=bug_report.yml',
        })),
    },
    me: {
      get: async () =>
        meFixtures.profile ?? {
          id: '00000000-0000-4000-8000-000000000001',
          displayName: null,
          homeRegionSlug: 'scotland' as const,
          locale: 'en' as const,
          role: 'user' as const,
        },
      patch:
        meFixtures.patch ??
        (async (body: MePatchRequest) => {
          const base: MeProfile = meFixtures.profile ?? {
            id: '00000000-0000-4000-8000-000000000001',
            displayName: null,
            homeRegionSlug: 'scotland',
            locale: 'en',
            role: 'user',
          };
          return {
            ...base,
            ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
            ...(body.homeRegionSlug !== undefined ? { homeRegionSlug: body.homeRegionSlug } : {}),
            ...(body.locale !== undefined ? { locale: body.locale } : {}),
          };
        }),
      delete:
        meFixtures.delete ?? (async () => ({ ok: true as const, purgeAfterDays: 30 as const })),
      export:
        meFixtures.export ??
        (async () => ({
          status: 'ready' as const,
          downloadUrl: 'https://example.test/export.json',
        })),
      watchlist: {
        list: async () => ({
          items: watchlistItems.map((item) => ({
            id: item.id,
            taxonId: item.taxonId,
            cellR7: item.cellR7,
            createdAt: item.createdAt ?? '2026-11-26T12:00:00.000Z',
          })),
          limit: watchlistLimit,
        }),
        add:
          watchlistFixtures.add ??
          (async (body: { taxonId: string; cellR7: string }) => {
            if (watchlistItems.length >= watchlistLimit) {
              const err = new Error(
                `Watchlist limit of ${String(watchlistLimit)} reached`,
              ) as Error & { code: string; status: number };
              err.code = 'WATCHLIST_LIMIT';
              err.status = 409;
              throw err;
            }
            const cell = body.cellR7.toLowerCase();
            const existing = watchlistItems.find(
              (item) => item.taxonId === body.taxonId && item.cellR7.toLowerCase() === cell,
            );
            if (existing !== undefined) {
              return {
                id: existing.id,
                taxonId: existing.taxonId,
                cellR7: existing.cellR7,
                createdAt: existing.createdAt ?? '2026-11-26T12:00:00.000Z',
              };
            }
            const created: MockWatchlistItem = {
              id: `wl-${String(watchlistItems.length + 1)}`,
              taxonId: body.taxonId,
              cellR7: cell,
              createdAt: '2026-11-26T12:00:00.000Z',
            };
            watchlistItems = [...watchlistItems, created];
            return {
              id: created.id,
              taxonId: created.taxonId,
              cellR7: created.cellR7,
              createdAt: created.createdAt ?? '2026-11-26T12:00:00.000Z',
            };
          }),
        remove:
          watchlistFixtures.remove ??
          (async (id: string) => {
            watchlistItems = watchlistItems.filter((item) => item.id !== id);
          }),
      },
      logbook: {
        list: async () => ({ items: logbookItems }),
        create:
          logbookFixtures.create ??
          (async (body: LogbookCreateRequest) => {
            const id = `lb-${String(logbookItems.length + 1)}`;
            const now = '2026-11-26T12:00:00.000Z';
            const entry: LogbookEntryOwner = {
              id,
              taxonId: body.taxonId ?? null,
              takenAt: body.takenAt,
              cellR7: body.cellR7 ?? null,
              photoKey: body.photoKey,
              thumbKey: body.thumbKey ?? null,
              exif: body.exif ?? {},
              notes: body.notes ?? null,
              createdAt: now,
              updatedAt: now,
              exactLocation: body.exactLocation ?? null,
            };
            logbookById[id] = entry;
            const { exactLocation: _exact, ...publicRow } = entry;
            logbookItems = [...logbookItems, publicRow];
            return entry;
          }),
        get: async (id: string) => {
          const hit = logbookById[id];
          if (hit === undefined) {
            throw new Error(`missing logbook ${id}`);
          }
          return hit;
        },
        patch:
          logbookFixtures.patch ??
          (async (id: string, body: LogbookPatchRequest) => {
            const hit = logbookById[id];
            if (hit === undefined) {
              throw new Error(`missing logbook ${id}`);
            }
            const next: LogbookEntryOwner = {
              ...hit,
              ...(body.taxonId !== undefined ? { taxonId: body.taxonId } : {}),
              ...(body.notes !== undefined ? { notes: body.notes } : {}),
              ...(body.cellR7 !== undefined ? { cellR7: body.cellR7 } : {}),
              ...(body.exactLocation !== undefined ? { exactLocation: body.exactLocation } : {}),
              updatedAt: '2026-11-26T13:00:00.000Z',
            };
            logbookById[id] = next;
            logbookItems = logbookItems.map((item) =>
              item.id === id
                ? {
                    id: next.id,
                    taxonId: next.taxonId,
                    takenAt: next.takenAt,
                    cellR7: next.cellR7,
                    photoKey: next.photoKey,
                    thumbKey: next.thumbKey,
                    exif: next.exif,
                    notes: next.notes,
                    createdAt: next.createdAt,
                    updatedAt: next.updatedAt,
                  }
                : item,
            );
            return next;
          }),
        remove:
          logbookFixtures.remove ??
          (async (id: string) => {
            delete logbookById[id];
            logbookItems = logbookItems.filter((item) => item.id !== id);
          }),
      },
    },
    uploads: {
      presign:
        logbookFixtures.presign ??
        (async (body: PresignUploadRequest) => ({
          uploadUrl: 'https://example.test/upload',
          photoKey: `uploads/user-1/${String(body.byteSize)}.jpg`,
          headers: { 'content-type': body.mimeType },
          expiresAt: '2026-11-26T13:00:00.000Z',
        })),
    },
    challenges: {
      current: async () => {
        if (challengeFixtures.current === null) {
          const err = new Error('No current challenge') as Error & { status: number };
          err.status = 404;
          throw err;
        }
        if (challengeFixtures.current !== undefined) {
          return challengeFixtures.current;
        }
        const err = new Error('No current challenge') as Error & { status: number };
        err.status = 404;
        throw err;
      },
      get: async (slug: string) => resolveChallenge(slug),
      entries: async (slug: string, query?: { country?: string; cursor?: string }) => {
        let entries = [...(entriesBySlug[slug] ?? [])];
        if (query?.country !== undefined) {
          entries = entries.filter((row) => row.countryCode === query.country);
        }
        // Simple cursor: skip until after the cursor id.
        if (query?.cursor !== undefined) {
          const idx = entries.findIndex((row) => row.id === query.cursor);
          entries = idx >= 0 ? entries.slice(idx + 1) : entries;
        }
        const pageSize = 20;
        const page = entries.slice(0, pageSize);
        const nextCursor =
          entries.length > pageSize && page[page.length - 1] !== undefined
            ? page[page.length - 1]!.id
            : null;
        return { entries: page, nextCursor } satisfies ChallengeEntriesPage;
      },
      submit:
        challengeFixtures.submit ??
        (async (_slug: string) => ({
          id: 'ce-1',
          status: 'pending' as const,
          publishAfter: '2026-12-03T12:00:00.000Z',
        })),
    },
  } as unknown as ApiClient;
}

export function weeksFromPattern(pattern: readonly number[]): number[] {
  const out = [...pattern];
  while (out.length < 52) {
    out.push(0);
  }
  return out.slice(0, 52);
}

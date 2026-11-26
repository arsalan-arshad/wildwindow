import type { ApiClient } from '@wildwindow/shared/client';
import type {
  AreaResponse,
  LogbookCreateRequest,
  LogbookEntryOwner,
  LogbookEntryPublic,
  LogbookPatchRequest,
  PlaceSummary,
  PresignUploadRequest,
  PresignUploadResponse,
} from '@wildwindow/shared';

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

const EMPTY_WEEKS = Array.from({ length: 52 }, () => 0);

export function forecastFixtureKey(taxonId: string, cell: string, start: string): string {
  return `${taxonId}|${cell}|${start}`;
}

export function createMockSpeciesApiClient(
  fixtures: MockSpeciesApi,
  placesFixtures: MockPlacesApi = {},
  forecastFixtures: MockForecastApi = {},
  logbookFixtures: MockLogbookApi = {},
): ApiClient {
  const places = placesFixtures.places ?? [];
  const areasByCell = placesFixtures.areasByCell ?? {};
  const forecastByKey = forecastFixtures.byKey ?? {};
  let logbookItems = [...(logbookFixtures.items ?? [])];
  const logbookById: Record<string, LogbookEntryOwner> = {
    ...(logbookFixtures.byId ?? {}),
  };

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
    me: {
      get: async () => ({
        id: '00000000-0000-4000-8000-000000000001',
        displayName: null,
        homeRegionSlug: 'scotland' as const,
        locale: 'en' as const,
        role: 'user' as const,
      }),
      patch: async () => {
        throw new Error('not implemented in mock');
      },
      delete: async () => ({ ok: true as const, purgeAfterDays: 30 as const }),
      export: async () => ({
        status: 'ready' as const,
        downloadUrl: 'https://example.test/export.json',
      }),
      watchlist: {
        list: async () => ({ items: [] }),
        add: async () => {
          throw new Error('not implemented in mock');
        },
        remove: async () => undefined,
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
  } as unknown as ApiClient;
}

export function weeksFromPattern(pattern: readonly number[]): number[] {
  const out = [...pattern];
  while (out.length < 52) {
    out.push(0);
  }
  return out.slice(0, 52);
}

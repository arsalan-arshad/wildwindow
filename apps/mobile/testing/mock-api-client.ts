import type { ApiClient } from '@wildwindow/shared/client';
import type { AreaResponse, PlaceSummary } from '@wildwindow/shared';

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

const EMPTY_WEEKS = Array.from({ length: 52 }, () => 0);

export function forecastFixtureKey(taxonId: string, cell: string, start: string): string {
  return `${taxonId}|${cell}|${start}`;
}

export function createMockSpeciesApiClient(
  fixtures: MockSpeciesApi,
  placesFixtures: MockPlacesApi = {},
  forecastFixtures: MockForecastApi = {},
): ApiClient {
  const places = placesFixtures.places ?? [];
  const areasByCell = placesFixtures.areasByCell ?? {};
  const forecastByKey = forecastFixtures.byKey ?? {};

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
  } as unknown as ApiClient;
}

export function weeksFromPattern(pattern: readonly number[]): number[] {
  const out = [...pattern];
  while (out.length < 52) {
    out.push(0);
  }
  return out.slice(0, 52);
}

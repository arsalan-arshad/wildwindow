import type { ApiClient } from '@wildwindow/shared/client';
import type { AreaResponse, PlaceSummary } from '@wildwindow/shared';

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

const EMPTY_WEEKS = Array.from({ length: 52 }, () => 0);

export function createMockSpeciesApiClient(
  fixtures: MockSpeciesApi,
  placesFixtures: MockPlacesApi = {},
): ApiClient {
  const places = placesFixtures.places ?? [];
  const areasByCell = placesFixtures.areasByCell ?? {};

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
  } as unknown as ApiClient;
}

export function weeksFromPattern(pattern: readonly number[]): number[] {
  const out = [...pattern];
  while (out.length < 52) {
    out.push(0);
  }
  return out.slice(0, 52);
}

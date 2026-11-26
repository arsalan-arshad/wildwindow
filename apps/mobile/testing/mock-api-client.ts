import type { ApiClient } from '@wildwindow/shared/client';

import type {
  SeasonalityResponse,
  SpeciesDetail,
  SpeciesListItem,
} from '@/lib/species';

export type MockSpeciesApi = {
  readonly list: SpeciesListItem[];
  readonly detailById: Readonly<Record<string, SpeciesDetail>>;
  readonly seasonalityById: Readonly<Record<string, SeasonalityResponse>>;
};

const EMPTY_WEEKS = Array.from({ length: 52 }, () => 0);

export function createMockSpeciesApiClient(fixtures: MockSpeciesApi): ApiClient {
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
            const haystack = [
              item.scientificName,
              item.commonNames.en,
              item.commonNames.ur ?? '',
            ]
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
  } as unknown as ApiClient;
}

export function weeksFromPattern(pattern: readonly number[]): number[] {
  const out = [...pattern];
  while (out.length < 52) {
    out.push(0);
  }
  return out.slice(0, 52);
}

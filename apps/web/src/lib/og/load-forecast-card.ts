import { ForecastQuerySchema, RegionIdSchema, type ForecastQuery } from '@wildwindow/shared/api';
import type { ApiClient } from '@wildwindow/shared/client';
import type { z } from 'zod';

import {
  buildForecastCardModel,
  siteHostFromUrl,
  type ForecastCardModel,
  type ForecastSpeciesNames,
} from '@/lib/og/forecast-model';

type RegionId = z.infer<typeof RegionIdSchema>;

const REGION_FALLBACKS: readonly RegionId[] = RegionIdSchema.options;

export async function loadForecastCardModel(
  client: ApiClient,
  query: ForecastQuery,
  siteUrl: string,
): Promise<ForecastCardModel | null> {
  const forecast = await client.forecast.get(query);
  if (forecast.status !== 'ok') {
    return null;
  }
  const species = await resolveSpeciesNames(client, query.taxonId, query.cell);
  return buildForecastCardModel(forecast, species, siteHostFromUrl(siteUrl));
}

export function parseForecastOgQuery(searchParams: URLSearchParams): ForecastQuery | null {
  const parsed = ForecastQuerySchema.safeParse({
    taxonId: searchParams.get('taxonId') ?? undefined,
    cell: searchParams.get('cell') ?? undefined,
    start: searchParams.get('start') ?? undefined,
  });
  return parsed.success ? parsed.data : null;
}

async function resolveSpeciesNames(
  client: ApiClient,
  taxonId: string,
  cell: string,
): Promise<ForecastSpeciesNames> {
  const regions = await preferredRegions(client, cell);
  for (const region of regions) {
    try {
      const detail = await client.species.get(taxonId, { region });
      return {
        commonName: detail.commonNames.en,
        scientificName: detail.scientificName,
      };
    } catch {
      // Try the next region (species may only be listed in one beta region).
    }
  }

  // Last resort: scan region catalogues (still no coordinates).
  for (const region of regions) {
    try {
      const list = await client.regions.species(region);
      const hit = list.species.find((row) => row.taxonId === taxonId);
      if (hit !== undefined) {
        return {
          commonName: hit.commonNames.en,
          scientificName: hit.scientificName,
        };
      }
    } catch {
      // continue
    }
  }

  // Forecast is still shareable with a generic label if catalogue lookup fails.
  return {
    commonName: 'Wildlife',
    scientificName: 'Species',
  };
}

async function preferredRegions(client: ApiClient, cell: string): Promise<readonly RegionId[]> {
  try {
    const area = await client.areas.get(cell);
    if (area.regionSlug !== null) {
      return [area.regionSlug, ...REGION_FALLBACKS.filter((r) => r !== area.regionSlug)];
    }
  } catch {
    // fall through
  }
  return REGION_FALLBACKS;
}

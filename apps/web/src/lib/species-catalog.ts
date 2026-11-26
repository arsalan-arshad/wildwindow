import type { SeasonalityResponse, SpeciesDetail, SpeciesListItem } from '@wildwindow/shared/api';
import { RegionIdSchema } from '@wildwindow/shared/api';
import type { ApiClient } from '@wildwindow/shared/client';
import type { z } from 'zod';

import { isReviewedCard } from '@/lib/field-card';
import { uniqueSpeciesSlug } from '@/lib/species-slug';

type RegionId = z.infer<typeof RegionIdSchema>;

export type SpeciesPageParams = {
  readonly region: RegionId;
  readonly species: string;
};

export type SpeciesPageEntry = {
  readonly params: SpeciesPageParams;
  readonly taxonId: string;
  readonly detail: SpeciesDetail;
};

export type RegionSpeciesSnapshot = {
  readonly region: RegionId;
  readonly species: readonly SpeciesListItem[];
  /** Details keyed by taxonId — only reviewed cards need to be present. */
  readonly detailsByTaxonId: Readonly<Record<string, SpeciesDetail>>;
};

/**
 * Pure: build ISR/static params for every species that has a reviewed card.
 * Acceptance (T7.3): one page path per reviewed card.
 */
export function collectReviewedSpeciesParams(
  snapshots: readonly RegionSpeciesSnapshot[],
): SpeciesPageParams[] {
  const out: SpeciesPageParams[] = [];

  for (const snapshot of snapshots) {
    const taken = new Set<string>();
    for (const item of snapshot.species) {
      const detail = snapshot.detailsByTaxonId[item.taxonId];
      if (detail === undefined || !isReviewedCard(detail.card)) {
        continue;
      }
      const slug = uniqueSpeciesSlug(item.commonNames.en, item.taxonId, taken);
      taken.add(slug);
      out.push({ region: snapshot.region, species: slug });
    }
  }

  return out;
}

/** Resolve a species slug within a region snapshot to a taxon id + detail. */
export function resolveSpeciesSlug(
  snapshot: RegionSpeciesSnapshot,
  speciesSlug: string,
): SpeciesPageEntry | null {
  const taken = new Set<string>();
  for (const item of snapshot.species) {
    const detail = snapshot.detailsByTaxonId[item.taxonId];
    if (detail === undefined || !isReviewedCard(detail.card)) {
      continue;
    }
    const slug = uniqueSpeciesSlug(item.commonNames.en, item.taxonId, taken);
    taken.add(slug);
    if (slug === speciesSlug) {
      return {
        params: { region: snapshot.region, species: slug },
        taxonId: item.taxonId,
        detail,
      };
    }
  }
  return null;
}

export function parseRegionParam(raw: string): RegionId | null {
  const parsed = RegionIdSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

const REGION_NAMES: Readonly<Record<RegionId, string>> = {
  scotland: 'Scotland',
  sindh: 'Sindh',
};

const REGION_TIME_ZONES: Readonly<Record<RegionId, string>> = {
  scotland: 'Europe/London',
  sindh: 'Asia/Karachi',
};

export function regionDisplayName(region: RegionId): string {
  return REGION_NAMES[region];
}

export function regionTimeZone(region: RegionId): string {
  return REGION_TIME_ZONES[region];
}

/**
 * Fetch reviewed-card species for static generation.
 * Returns [] when the API is unreachable or returns nothing reviewed.
 * Never calls the map endpoint (W-03: no maps).
 */
export async function fetchReviewedSpeciesParams(client: ApiClient): Promise<SpeciesPageParams[]> {
  const regions = await client.regions.list();
  const snapshots: RegionSpeciesSnapshot[] = [];

  for (const region of regions.regions) {
    const list = await client.regions.species(region.slug);
    const detailsByTaxonId: Record<string, SpeciesDetail> = {};

    // Detail lookups; only keep reviewed cards (never call species map).
    for (const item of list.species) {
      try {
        const detail = await client.species.get(item.taxonId, { region: region.slug });
        if (isReviewedCard(detail.card)) {
          detailsByTaxonId[item.taxonId] = detail;
        }
      } catch {
        // Skip taxa that fail detail fetch at build time.
      }
    }

    snapshots.push({
      region: region.slug,
      species: list.species,
      detailsByTaxonId,
    });
  }

  return collectReviewedSpeciesParams(snapshots);
}

export type LoadedSpeciesPage = {
  readonly entry: SpeciesPageEntry;
  readonly seasonality: SeasonalityResponse;
};

/**
 * Load a single species page by region + slug.
 * Returns null when the region/slug is unknown or the card is not reviewed.
 * Never fetches map cells.
 */
export async function loadSpeciesPage(
  client: ApiClient,
  regionRaw: string,
  speciesSlug: string,
): Promise<LoadedSpeciesPage | null> {
  const region = parseRegionParam(regionRaw);
  if (region === null) {
    return null;
  }

  const list = await client.regions.species(region);
  const detailsByTaxonId: Record<string, SpeciesDetail> = {};

  // Load details in list order so uniqueSpeciesSlug matches generateStaticParams.
  for (const item of list.species) {
    try {
      const detail = await client.species.get(item.taxonId, { region });
      if (isReviewedCard(detail.card)) {
        detailsByTaxonId[item.taxonId] = detail;
      }
    } catch {
      // Skip taxa that fail detail fetch.
    }
  }

  const snapshot: RegionSpeciesSnapshot = {
    region,
    species: list.species,
    detailsByTaxonId,
  };
  const entry = resolveSpeciesSlug(snapshot, speciesSlug);
  if (entry === null) {
    return null;
  }

  const seasonality = await client.species.seasonality(entry.taxonId, { region });
  return { entry, seasonality };
}

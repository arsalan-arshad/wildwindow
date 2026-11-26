import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { SpeciesPageView } from '@/components/species-page';
import { getSiteUrl, tryGetServerApiClient } from '@/lib/api';
import { buildSpeciesJsonLd } from '@/lib/json-ld';
import {
  fetchReviewedSpeciesParams,
  loadSpeciesPage,
  parseRegionParam,
  regionDisplayName,
} from '@/lib/species-catalog';

/** ISR: refresh reviewed cards and seasonality periodically (ARCHITECTURE W-03). */
export const revalidate = 3600;

/** Allow on-demand generation when new reviewed cards land after build. */
export const dynamicParams = true;

type RouteParams = {
  readonly region: string;
  readonly species: string;
};

type PageProps = {
  readonly params: Promise<RouteParams>;
};

export async function generateStaticParams(): Promise<RouteParams[]> {
  const client = tryGetServerApiClient();
  if (client === null) {
    // CI / local builds without NEXT_PUBLIC_API_URL still succeed.
    return [];
  }
  try {
    const params = await fetchReviewedSpeciesParams(client);
    return params.map((p) => ({ region: p.region, species: p.species }));
  } catch {
    // API down at build time: ship empty static set; ISR fills in on demand.
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { region: regionRaw, species: speciesSlug } = await params;
  const region = parseRegionParam(regionRaw);
  if (region === null) {
    return { title: 'Species' };
  }

  const client = tryGetServerApiClient();
  if (client === null) {
    return { title: 'Species' };
  }

  try {
    const loaded = await loadSpeciesPage(client, region, speciesSlug);
    if (loaded === null) {
      return { title: 'Species' };
    }
    const common = loaded.entry.detail.commonNames.en;
    const regionName = regionDisplayName(region);
    return {
      title: `${common} · ${regionName}`,
      description: `Seasonality and reviewed field card for ${common} (${loaded.entry.detail.scientificName}) in ${regionName}. No maps.`,
      openGraph: {
        title: `${common} · ${regionName}`,
        description: `When ${common} is reported in ${regionName} — relative reporting rate and fieldcraft. No pins.`,
        type: 'article',
      },
    };
  } catch {
    return { title: 'Species' };
  }
}

export default async function SpeciesPage({ params }: PageProps) {
  const { region: regionRaw, species: speciesSlug } = await params;
  const client = tryGetServerApiClient();
  if (client === null) {
    notFound();
  }

  let loaded;
  try {
    loaded = await loadSpeciesPage(client, regionRaw, speciesSlug);
  } catch {
    notFound();
  }

  if (loaded === null) {
    notFound();
  }

  const siteUrl = getSiteUrl().replace(/\/+$/, '');
  const pageUrl = `${siteUrl}/${loaded.entry.params.region}/${loaded.entry.params.species}`;
  const jsonLd = buildSpeciesJsonLd({
    detail: loaded.entry.detail,
    pageUrl,
    siteUrl,
    regionName: regionDisplayName(loaded.entry.detail.regionSlug),
  });

  return (
    <SpeciesPageView
      detail={loaded.entry.detail}
      seasonality={loaded.seasonality}
      jsonLd={JSON.stringify(jsonLd)}
    />
  );
}

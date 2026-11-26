import type { SpeciesDetail } from '@wildwindow/shared/api';

export type SpeciesJsonLd = {
  readonly '@context': 'https://schema.org';
  readonly '@type': 'WebPage';
  readonly name: string;
  readonly description: string;
  readonly url: string;
  readonly about: {
    readonly '@type': 'Taxon';
    readonly name: string;
    readonly alternateName: string;
  };
  readonly isPartOf: {
    readonly '@type': 'WebSite';
    readonly name: 'WildWindow';
    readonly url: string;
  };
};

/** Build Schema.org JSON-LD for a species page. Never includes coordinates or cells. */
export function buildSpeciesJsonLd(input: {
  readonly detail: SpeciesDetail;
  readonly pageUrl: string;
  readonly siteUrl: string;
  readonly regionName: string;
}): SpeciesJsonLd {
  const common = input.detail.commonNames.en;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${common} · ${input.regionName}`,
    description: `Seasonality and reviewed field card for ${common} (${input.detail.scientificName}) in ${input.regionName}. No maps — WildWindow No-Pin Promise.`,
    url: input.pageUrl,
    about: {
      '@type': 'Taxon',
      name: input.detail.scientificName,
      alternateName: common,
    },
    isPartOf: {
      '@type': 'WebSite',
      name: 'WildWindow',
      url: input.siteUrl,
    },
  };
}

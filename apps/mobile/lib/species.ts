/**
 * Species browse / detail helpers (S-04, S-05).
 * Local wire shapes so jest does not need the shared package build.
 */

export const SENSITIVITY_TIERS = ['open', 'protected', 'highly_protected', 'no_forecast'] as const;
export type SensitivityTier = (typeof SENSITIVITY_TIERS)[number];

/** Browse filter chips (PRD S-04: birds, mammals, marine). */
export const SPECIES_BROWSE_GROUPS = ['bird', 'mammal', 'marine'] as const;
export type SpeciesBrowseGroup = (typeof SPECIES_BROWSE_GROUPS)[number];

export const SPECIES_GROUPS = [
  'bird',
  'mammal',
  'marine',
  'reptile',
  'amphibian',
  'invertebrate',
] as const;
export type SpeciesGroup = (typeof SPECIES_GROUPS)[number];

export type SpeciesCommonNames = {
  readonly en: string;
  readonly ur?: string;
};

export type SpeciesListItem = {
  readonly taxonId: string;
  readonly scientificName: string;
  readonly commonNames: SpeciesCommonNames;
  readonly group: SpeciesGroup;
  readonly tier: SensitivityTier;
  readonly coastal: boolean;
  readonly challengeEligible: boolean;
};

export type SpeciesCardSummary = {
  readonly bodyMd: string;
  readonly settings: Readonly<Record<string, unknown>>;
  readonly ethicsMd: string | null;
  readonly legalMd: string | null;
  readonly reviewedBy: string;
  readonly reviewedAt: string;
};

export type SpeciesDetail = {
  readonly taxonId: string;
  readonly scientificName: string;
  readonly commonNames: SpeciesCommonNames;
  readonly group: SpeciesGroup;
  readonly regionSlug: string;
  readonly tier: SensitivityTier;
  readonly coastal: boolean;
  readonly tidePref: string | null;
  readonly activityPattern: string | null;
  readonly challengeEligible: boolean;
  readonly card: SpeciesCardSummary | null;
};

export type SeasonalityResponse = {
  readonly taxonId: string;
  readonly regionSlug: string;
  readonly weeks: readonly number[];
};

export function isSensitivityTier(value: string): value is SensitivityTier {
  return (SENSITIVITY_TIERS as readonly string[]).includes(value);
}

export function isSpeciesBrowseGroup(value: string): value is SpeciesBrowseGroup {
  return (SPECIES_BROWSE_GROUPS as readonly string[]).includes(value);
}

/** Prefer Urdu common name when the UI language is `ur` and one exists. */
export function displayCommonName(names: SpeciesCommonNames, language: string): string {
  const base = language.split('-')[0] ?? language;
  if (base === 'ur' && names.ur !== undefined && names.ur.trim().length > 0) {
    return names.ur;
  }
  return names.en;
}

export function canRequestForecast(tier: SensitivityTier): boolean {
  return tier !== 'no_forecast';
}

/** Format ISO datetime for the field-card "Reviewed by" line (region-agnostic calendar date). */
export function formatReviewedAt(iso: string, language: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) {
    return iso;
  }
  return new Intl.DateTimeFormat(language === 'ur' ? 'ur-PK' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(parsed));
}

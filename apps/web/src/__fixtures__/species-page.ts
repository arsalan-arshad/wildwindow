import type { SeasonalityResponse, SpeciesDetail, SpeciesListItem } from '@wildwindow/shared/api';

import type { RegionSpeciesSnapshot } from '@/lib/species-catalog';

/** 52-week fixture with a mid-year peak (relative rates in [0, 1]). */
export const seasonalityFixture: SeasonalityResponse = {
  taxonId: '1',
  regionSlug: 'scotland',
  weeks: Array.from({ length: 52 }, (_, i) => {
    const mid = 25.5;
    const dist = Math.abs(i - mid) / mid;
    return Math.max(0, Math.min(1, 1 - dist * 0.85));
  }),
};

export const reviewedKingfisherDetail: SpeciesDetail = {
  taxonId: '1',
  scientificName: 'Alcedo atthis',
  commonNames: { en: 'Common kingfisher', ur: 'عام کنگ فشر' },
  group: 'bird',
  regionSlug: 'scotland',
  tier: 'open',
  coastal: false,
  tidePref: null,
  activityPattern: 'diurnal',
  challengeEligible: true,
  card: {
    bodyMd:
      '## Approach\n\nWait quietly on a low bank. Prefer **side light** over harsh midday sun.\n\n- Stay back from the perch\n- No playback',
    settings: {
      perched: { shutter: '1/1000', aperture: 'f/5.6', iso: 400, focusMode: 'AF-C' },
      flight: { shutter: '1/2000', aperture: 'f/5.6', iso: 800 },
    },
    ethicsMd: 'Do not approach nests. No baiting.',
    legalMd: 'In Scotland, disturbing Schedule 1 birds at the nest needs a NatureScot licence.',
    reviewedBy: 'Test Reviewer',
    reviewedAt: '2026-11-01T12:00:00.000Z',
  },
};

export const draftOnlyDetail: SpeciesDetail = {
  taxonId: '2',
  scientificName: 'Sciurus vulgaris',
  commonNames: { en: 'Red squirrel' },
  group: 'mammal',
  regionSlug: 'scotland',
  tier: 'open',
  coastal: false,
  tidePref: null,
  activityPattern: 'diurnal',
  challengeEligible: false,
  card: null,
};

export const reviewedOtterDetail: SpeciesDetail = {
  taxonId: '4',
  scientificName: 'Lutra lutra',
  commonNames: { en: 'Eurasian otter' },
  group: 'mammal',
  regionSlug: 'scotland',
  tier: 'protected',
  coastal: false,
  tidePref: null,
  activityPattern: 'crepuscular',
  challengeEligible: false,
  card: {
    bodyMd: 'Watch from a distance along quiet shorelines.',
    settings: { shutter: '1/500', iso: 800 },
    ethicsMd: 'Never follow an otter to a holt.',
    legalMd: null,
    reviewedBy: 'Conservation Lead',
    reviewedAt: '2026-10-15T09:00:00.000Z',
  },
};

const listKingfisher: SpeciesListItem = {
  taxonId: '1',
  scientificName: 'Alcedo atthis',
  commonNames: { en: 'Common kingfisher', ur: 'عام کنگ فشر' },
  group: 'bird',
  tier: 'open',
  coastal: false,
  challengeEligible: true,
};

const listSquirrel: SpeciesListItem = {
  taxonId: '2',
  scientificName: 'Sciurus vulgaris',
  commonNames: { en: 'Red squirrel' },
  group: 'mammal',
  tier: 'open',
  coastal: false,
  challengeEligible: false,
};

const listOtter: SpeciesListItem = {
  taxonId: '4',
  scientificName: 'Lutra lutra',
  commonNames: { en: 'Eurasian otter' },
  group: 'mammal',
  tier: 'protected',
  coastal: false,
  challengeEligible: false,
};

/** Scotland snapshot: two reviewed cards + one draft/null (should not generate a page). */
export const scotlandReviewedSnapshot: RegionSpeciesSnapshot = {
  region: 'scotland',
  species: [listKingfisher, listSquirrel, listOtter],
  detailsByTaxonId: {
    '1': reviewedKingfisherDetail,
    '2': draftOnlyDetail,
    '4': reviewedOtterDetail,
  },
};

export const sindhEmptySnapshot: RegionSpeciesSnapshot = {
  region: 'sindh',
  species: [],
  detailsByTaxonId: {},
};

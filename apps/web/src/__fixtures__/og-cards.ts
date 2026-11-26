import type {
  ChallengeEntryPublic,
  ChallengeResponse,
  ForecastOk,
  SpeciesDetail,
} from '@wildwindow/shared/api';

/** Device-snapped Glasgow res-7 — used only as the API query cell, never on the card. */
export const OG_FORECAST_CELL = '871909ac5ffffff';

export const ogForecastOk: ForecastOk = {
  status: 'ok',
  scoringVersion: '1.0',
  taxonId: '42',
  tier: 'open',
  timeZone: 'Europe/London',
  displayCell: '851909affffffff',
  areaLabel: 'Glasgow · Kelvin area',
  weekScore: 82,
  bestDay: '2026-11-20',
  confidence: 'high',
  range: null,
  days: [
    day('2026-11-16', 70, '07:00', '09:00'),
    day('2026-11-17', 74, '07:00', '09:00'),
    day('2026-11-18', 71, '07:30', '09:30'),
    day('2026-11-19', 78, '07:00', '09:00'),
    day('2026-11-20', 88, '06:30', '08:30'),
    day('2026-11-21', 80, '07:00', '09:00'),
    day('2026-11-22', 76, '07:30', '09:30'),
  ],
  explanations: ['Seasonality and light favour the morning block.'],
};

export const ogSpeciesDetail: SpeciesDetail = {
  taxonId: '42',
  scientificName: 'Alcedo atthis',
  commonNames: { en: 'Common kingfisher' },
  group: 'bird',
  regionSlug: 'scotland',
  tier: 'open',
  coastal: false,
  tidePref: null,
  activityPattern: 'diurnal',
  challengeEligible: true,
  card: null,
};

export const ogChallenge: ChallengeResponse = {
  slug: 'kingfisher-month-2026-11',
  title: 'Kingfisher Month',
  taxonId: '42',
  startsOn: '2026-11-01',
  endsOn: '2026-11-30',
  rulesMd: '## Rules\n\nSubmit one photo.',
  status: 'active',
  countryCounts: [
    { countryCode: 'GB', count: 1 },
    { countryCode: 'PK', count: 0 },
  ],
};

/** 1×1 PNG — no network needed for next/og img in tests. */
export const OG_TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export const ogChallengeEntry: ChallengeEntryPublic = {
  id: '101',
  countryCode: 'GB',
  regionLabel: 'Scotland',
  photoUrl: OG_TINY_PNG_DATA_URL,
  publishedAt: '2026-11-10T12:00:00.000Z',
};

function day(date: string, score: number, start: string, end: string): ForecastOk['days'][number] {
  return {
    date,
    score,
    bestBlock: { start, end },
    factors: {
      seasonality: 0.8,
      timeOfDay: 0.7,
      light: 0.75,
      weather: 0.6,
      tide: 'not_used',
    },
    light: { goldenAm: null, goldenPm: null },
  };
}

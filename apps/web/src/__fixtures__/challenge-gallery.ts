import type {
  ChallengeEntriesResponse,
  ChallengeEntryPublic,
  ChallengeResponse,
} from '@wildwindow/shared/api';

/** Kingfisher Month summary — country counts only (No-Pin). */
export const challengeFixture: ChallengeResponse = {
  slug: 'kingfisher-month-2026-11',
  title: 'Kingfisher Month',
  taxonId: '1',
  startsOn: '2026-11-01',
  endsOn: '2026-11-30',
  rulesMd:
    '## Rules\n\nSubmit one photo of the **common kingfisher** from your logbook.\n\n- Tick the ethics pledge\n- No baiting or playback',
  status: 'active',
  countryCounts: [
    { countryCode: 'GB', count: 2 },
    { countryCode: 'PK', count: 1 },
  ],
};

export const challengeEntriesPage1: ChallengeEntryPublic[] = [
  {
    id: 'entry-gb-1',
    countryCode: 'GB',
    regionLabel: 'Scotland',
    photoUrl: 'https://cdn.example.test/challenge/entry-gb-1.jpg',
    publishedAt: '2026-11-10T12:00:00.000Z',
  },
  {
    id: 'entry-pk-1',
    countryCode: 'PK',
    regionLabel: 'Sindh',
    photoUrl: 'https://cdn.example.test/challenge/entry-pk-1.jpg',
    publishedAt: '2026-11-11T09:30:00.000Z',
  },
];

export const challengeEntriesPage2: ChallengeEntryPublic[] = [
  {
    id: 'entry-gb-2',
    countryCode: 'GB',
    regionLabel: 'Scotland',
    photoUrl: 'https://cdn.example.test/challenge/entry-gb-2.jpg',
    publishedAt: '2026-11-12T15:00:00.000Z',
  },
];

export const challengeEntriesAllPage: ChallengeEntriesResponse = {
  entries: challengeEntriesPage1,
  nextCursor: 'cursor-page-2',
};

export const challengeEntriesAllPage2: ChallengeEntriesResponse = {
  entries: challengeEntriesPage2,
  nextCursor: null,
};

export const challengeEntriesGbOnly: ChallengeEntriesResponse = {
  entries: [challengeEntriesPage1[0]!, challengeEntriesPage2[0]!],
  nextCursor: null,
};

export const challengeEntriesPkOnly: ChallengeEntriesResponse = {
  entries: [challengeEntriesPage1[1]!],
  nextCursor: null,
};

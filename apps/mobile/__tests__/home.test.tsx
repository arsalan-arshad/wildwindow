import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { snapToCell } from '@wildwindow/geoprivacy';

import { HomeWatchlist } from '@/components/home/HomeWatchlist';
import { WatchlistSaveButton } from '@/components/home/WatchlistSaveButton';
import type { ChallengeSummary } from '@/lib/challenge';
import type { ForecastOk } from '@/lib/forecast';
import type { SpeciesDetail, SpeciesListItem } from '@/lib/species';
import { createMockAuthClient } from '@/testing/mock-auth-client';
import {
  createMockSpeciesApiClient,
  forecastFixtureKey,
  type MockWatchlistItem,
} from '../testing/mock-api-client';
import { renderWithProviders } from '../testing/test-utils';

const CELL_A = snapToCell(55.86, -4.25, 7);
const CELL_B = snapToCell(55.95, -3.18, 7);
const CELL_C = snapToCell(56.12, -3.95, 7);
const CELL_D = snapToCell(55.45, -4.65, 7);
const NOW = new Date('2026-11-20T10:00:00.000Z');
const START = '2026-11-20';

const KINGFISHER_ROW: SpeciesListItem = {
  taxonId: '2481',
  scientificName: 'Alcedo atthis',
  commonNames: { en: 'Common kingfisher', ur: 'کنگ فششر' },
  group: 'bird',
  tier: 'open',
  coastal: false,
  challengeEligible: true,
};

const OTTER_ROW: SpeciesListItem = {
  taxonId: '2435',
  scientificName: 'Lutra lutra',
  commonNames: { en: 'Eurasian otter' },
  group: 'mammal',
  tier: 'protected',
  coastal: true,
  challengeEligible: false,
};

const SEAL_ROW: SpeciesListItem = {
  taxonId: '2437',
  scientificName: 'Halichoerus grypus',
  commonNames: { en: 'Grey seal' },
  group: 'marine',
  tier: 'open',
  coastal: true,
  challengeEligible: false,
};

function detailFromRow(row: SpeciesListItem): SpeciesDetail {
  return {
    taxonId: row.taxonId,
    scientificName: row.scientificName,
    commonNames: row.commonNames,
    group: row.group,
    regionSlug: 'scotland',
    tier: row.tier,
    coastal: row.coastal,
    tidePref: null,
    activityPattern: 'diurnal',
    challengeEligible: row.challengeEligible,
    card: null,
  };
}

function okForecast(taxonId: string, cell: string, weekScore: number, bestDay: string): ForecastOk {
  return {
    status: 'ok',
    scoringVersion: '1.0',
    taxonId,
    tier: 'open',
    timeZone: 'Europe/London',
    displayCell: cell,
    areaLabel: 'Scotland · test area',
    weekScore,
    bestDay,
    confidence: 'medium',
    range: null,
    days: [
      {
        date: bestDay,
        score: weekScore,
        bestBlock: { start: '07:00', end: '09:00' },
        factors: {
          seasonality: 0.7,
          timeOfDay: 0.8,
          light: 0.7,
          weather: 0.9,
          tide: 'not_used',
        },
        light: { goldenAm: ['07:30', '08:40'], goldenPm: ['15:20', '16:30'] },
      },
    ],
    explanations: ['Test forecast'],
  };
}

const LIVE_CHALLENGE: ChallengeSummary = {
  slug: 'kingfisher-month-2026-11',
  title: 'Kingfisher Month',
  taxonId: '2481',
  startsOn: '2026-11-01',
  endsOn: '2026-11-30',
  rulesMd: 'One photo.',
  status: 'active',
  countryCounts: [{ countryCode: 'GB', count: 1 }],
};

function threeItems(): MockWatchlistItem[] {
  return [
    {
      id: 'wl-1',
      taxonId: '2481',
      cellR7: CELL_A,
      createdAt: '2026-11-10T12:00:00.000Z',
    },
    {
      id: 'wl-2',
      taxonId: '2435',
      cellR7: CELL_B,
      createdAt: '2026-11-11T12:00:00.000Z',
    },
    {
      id: 'wl-3',
      taxonId: '2437',
      cellR7: CELL_C,
      createdAt: '2026-11-12T12:00:00.000Z',
    },
  ];
}

function homeApi(watchlistItems: MockWatchlistItem[]) {
  const rows = [KINGFISHER_ROW, OTTER_ROW, SEAL_ROW];
  return createMockSpeciesApiClient(
    {
      list: rows,
      detailById: Object.fromEntries(rows.map((row) => [row.taxonId, detailFromRow(row)])),
      seasonalityById: {},
    },
    {},
    {
      byKey: {
        [forecastFixtureKey('2481', CELL_A, START)]: okForecast('2481', CELL_A, 72, '2026-11-21'),
        [forecastFixtureKey('2435', CELL_B, START)]: okForecast('2435', CELL_B, 61, '2026-11-22'),
        [forecastFixtureKey('2437', CELL_C, START)]: okForecast('2437', CELL_C, 55, '2026-11-20'),
        [forecastFixtureKey('2481', CELL_D, START)]: okForecast('2481', CELL_D, 40, '2026-11-23'),
      },
    },
    {},
    {
      current: LIVE_CHALLENGE,
      bySlug: { [LIVE_CHALLENGE.slug]: LIVE_CHALLENGE },
    },
    { items: watchlistItems, limit: 3 },
  );
}

const signedIn = () =>
  createMockAuthClient({
    initialUser: { uid: 'u1', email: 'p1@example.com', displayName: null },
  });

describe('Home watchlist (T6.8 S-03)', () => {
  it('asks for sign-in when signed out', async () => {
    const view = await renderWithProviders(<HomeWatchlist now={NOW} />, {
      authClient: createMockAuthClient({ initialUser: null }),
      apiClient: homeApi([]),
      initialPreferences: { region: 'scotland', onboardingComplete: true },
    });

    await waitFor(() => {
      expect(view.getByTestId('home-signed-out')).toBeTruthy();
    });
    expect(view.getByTestId('home-sign-in')).toBeTruthy();
  });

  it('lists saved pairs with this week’s score and best day', async () => {
    const onOpenPair = jest.fn();
    const view = await renderWithProviders(<HomeWatchlist now={NOW} onOpenPair={onOpenPair} />, {
      authClient: signedIn(),
      apiClient: homeApi(threeItems().slice(0, 1)),
      initialPreferences: { region: 'scotland', onboardingComplete: true },
    });

    await waitFor(() => {
      expect(view.getByTestId('home-watchlist-row-wl-1')).toBeTruthy();
    });

    await waitFor(() => {
      expect(view.getByTestId('home-watchlist-score-wl-1').props.children).toContain('72');
    });
    expect(view.getByTestId('home-watchlist-best-day-wl-1')).toBeTruthy();
    expect(view.getByTestId('home-watchlist-row-wl-1')).toHaveTextContent(/Common kingfisher/);

    fireEvent.press(view.getByTestId('home-watchlist-open-wl-1'));
    expect(onOpenPair).toHaveBeenCalledWith({ taxonId: '2481', cellR7: CELL_A });
  });

  it('shows the 3-item limit message and hides Add when full', async () => {
    const onAdd = jest.fn();
    const view = await renderWithProviders(<HomeWatchlist now={NOW} onAdd={onAdd} />, {
      authClient: signedIn(),
      apiClient: homeApi(threeItems()),
      initialPreferences: { region: 'scotland', onboardingComplete: true },
    });

    await waitFor(() => {
      expect(view.getByTestId('home-watchlist-limit')).toBeTruthy();
    });

    expect(view.getByText('Watchlist is full')).toBeTruthy();
    expect(
      view.getByText(
        'You can save up to 3 species and area pairs for free. Remove one to add another.',
      ),
    ).toBeTruthy();
    expect(view.getByTestId('home-watchlist-capacity').props.children).toEqual(
      expect.stringMatching(/3.*3/),
    );
    expect(view.queryByTestId('home-watchlist-add')).toBeNull();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('removes a pair and shows Add again under the limit', async () => {
    const api = homeApi(threeItems());
    const view = await renderWithProviders(<HomeWatchlist now={NOW} />, {
      authClient: signedIn(),
      apiClient: api,
      initialPreferences: { region: 'scotland', onboardingComplete: true },
    });

    await waitFor(() => {
      expect(view.getByTestId('home-watchlist-limit')).toBeTruthy();
    });

    fireEvent.press(view.getByTestId('home-watchlist-remove-wl-2'));

    await waitFor(() => {
      expect(view.queryByTestId('home-watchlist-row-wl-2')).toBeNull();
    });
    await waitFor(() => {
      expect(view.getByTestId('home-watchlist-add')).toBeTruthy();
    });
    expect(view.queryByTestId('home-watchlist-limit')).toBeNull();
  });

  it('shows the challenge banner', async () => {
    const onOpenChallenge = jest.fn();
    const view = await renderWithProviders(
      <HomeWatchlist now={NOW} onOpenChallenge={onOpenChallenge} />,
      {
        authClient: signedIn(),
        apiClient: homeApi([]),
        initialPreferences: { region: 'scotland', onboardingComplete: true },
      },
    );

    await waitFor(() => {
      expect(view.getByTestId('home-challenge-banner')).toBeTruthy();
    });
    expect(view.getByTestId('home-challenge-banner-title').props.children).toBe('Kingfisher Month');

    fireEvent.press(view.getByTestId('home-challenge-banner'));
    expect(onOpenChallenge).toHaveBeenCalledWith(LIVE_CHALLENGE.slug);
  });
});

describe('Watchlist save from forecast (T6.8)', () => {
  it('shows the limit message when saving a 4th pair', async () => {
    const view = await renderWithProviders(<WatchlistSaveButton taxonId="2481" cellR7={CELL_D} />, {
      authClient: signedIn(),
      apiClient: homeApi(threeItems()),
      initialPreferences: { region: 'scotland', onboardingComplete: true },
    });

    await waitFor(() => {
      expect(view.getByTestId('forecast-watchlist-save')).toBeTruthy();
    });

    fireEvent.press(view.getByTestId('forecast-watchlist-save'));

    await waitFor(() => {
      expect(view.getByTestId('forecast-watchlist-limit')).toBeTruthy();
    });
    expect(view.getByText('Watchlist is full')).toBeTruthy();
  });
});

import React from 'react';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import {
  persistQueryClientRestore,
  persistQueryClientSave,
} from '@tanstack/react-query-persist-client';
import { act, waitFor } from '@testing-library/react-native';
import { snapToCell } from '@wildwindow/geoprivacy';

import { ForecastDetailView } from '@/components/forecast/ForecastDetailView';
import type { ForecastOk, ForecastResponse, LightDay } from '@/lib/forecast';
import { formatLastUpdated, resetOnlineManagerForTests } from '@/lib/online';
import { createAppQueryClient, shouldPersistQuery } from '@/lib/query-client';
import {
  createMemoryQueryPersistStorage,
  createQueryPersister,
  QUERY_PERSIST_KEY,
} from '@/lib/query-persist';
import type { SpeciesDetail } from '@/lib/species';
import type { ApiClient } from '@wildwindow/shared/client';
import { createMockSpeciesApiClient, forecastFixtureKey } from '../testing/mock-api-client';
import { renderWithProviders } from '../testing/test-utils';

const CELL = snapToCell(55.86, -4.25, 7);
const NOW = new Date('2026-11-20T10:00:00.000Z');
const START = '2026-11-20';
const UPDATED_AT = Date.parse('2026-11-20T09:30:00.000Z');

const SPECIES: SpeciesDetail = {
  taxonId: '2481',
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

function day(date: string, score: number): ForecastOk['days'][number] {
  return {
    date,
    score,
    bestBlock: { start: '07:00', end: '09:00' },
    factors: {
      seasonality: 0.68,
      timeOfDay: 0.9,
      light: 0.75,
      weather: 0.94,
      tide: 'not_used',
    },
    light: {
      goldenAm: ['07:31', '08:40'],
      goldenPm: ['15:22', '16:31'],
    },
  };
}

const OK_FORECAST: ForecastOk = {
  status: 'ok',
  scoringVersion: '1.0',
  taxonId: '2481',
  tier: 'open',
  timeZone: 'Europe/London',
  displayCell: CELL,
  areaLabel: 'Glasgow · Kelvin area',
  weekScore: 69,
  bestDay: '2026-11-21',
  confidence: 'medium',
  range: null,
  days: [
    day('2026-11-20', 55),
    day('2026-11-21', 69),
    day('2026-11-22', 61),
    day('2026-11-23', 48),
    day('2026-11-24', 52),
    day('2026-11-25', 58),
    day('2026-11-26', 50),
  ],
  explanations: ['Common kingfisher is reported here often at this time of year'],
};

const FIXED_LIGHT: LightDay = {
  date: '2026-11-21',
  timeZone: 'Europe/London',
  civilDawn: '06:50',
  civilDusk: '17:10',
  goldenAm: ['07:31', '08:40'],
  goldenPm: ['15:22', '16:31'],
  blueAm: ['06:50', '07:31'],
  bluePm: ['16:31', '17:10'],
  candidateBlocks: [{ start: '07:00', end: '09:00' }],
};

function createOfflineQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        staleTime: Infinity,
      },
    },
  });
}

function failingForecastClient(): {
  readonly client: ApiClient;
  readonly getSpy: jest.Mock;
} {
  const client = createMockSpeciesApiClient(
    {
      list: [],
      detailById: { '2481': SPECIES },
      seasonalityById: {},
    },
    {},
    {
      byKey: {
        [forecastFixtureKey('2481', CELL, START)]: OK_FORECAST as ForecastResponse,
      },
    },
  );
  const getSpy = jest.fn(async () => {
    throw new Error('network offline');
  });
  return {
    client: {
      ...client,
      forecast: {
        ...client.forecast,
        get: getSpy,
      },
    } as ApiClient,
    getSpy,
  };
}

describe('T6.13 offline cache', () => {
  afterEach(async () => {
    await act(async () => {
      resetOnlineManagerForTests();
    });
  });

  it('shouldPersistQuery keeps only forecast and species successes', () => {
    const client = createAppQueryClient();
    client.setQueryData(['forecast', '2481', CELL, START], OK_FORECAST);
    client.setQueryData(['species', '2481', 'scotland'], SPECIES);
    client.setQueryData(['watchlist'], { items: [] });

    const forecast = client.getQueryCache().find({ queryKey: ['forecast', '2481', CELL, START] });
    const species = client.getQueryCache().find({ queryKey: ['species', '2481', 'scotland'] });
    const watchlist = client.getQueryCache().find({ queryKey: ['watchlist'] });

    expect(forecast).toBeDefined();
    expect(species).toBeDefined();
    expect(watchlist).toBeDefined();
    expect(shouldPersistQuery(forecast!)).toBe(true);
    expect(shouldPersistQuery(species!)).toBe(true);
    expect(shouldPersistQuery(watchlist!)).toBe(false);
    client.clear();
  });

  it('persists forecast and species queries to storage and restores them', async () => {
    const storage = createMemoryQueryPersistStorage();
    const persister = createQueryPersister(storage);
    const source = createAppQueryClient();
    source.setQueryData(['forecast', '2481', CELL, START], OK_FORECAST);
    source.setQueryData(['species', '2481', 'scotland'], SPECIES);
    source.setQueryData(['challenge', 'current'], { id: 'x' });

    await persistQueryClientSave({
      queryClient: source,
      persister,
      dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
    });

    const raw = await storage.getItem(QUERY_PERSIST_KEY);
    expect(raw).toEqual(expect.any(String));
    expect(raw).toContain('"forecast"');
    expect(raw).toContain('"species"');
    expect(raw).not.toContain('"challenge"');

    const restored = createAppQueryClient();
    await persistQueryClientRestore({
      queryClient: restored,
      persister,
      maxAge: 1000 * 60 * 60 * 24,
    });

    expect(restored.getQueryData(['forecast', '2481', CELL, START])).toEqual(OK_FORECAST);
    expect(restored.getQueryData(['species', '2481', 'scotland'])).toEqual(SPECIES);
    expect(restored.getQueryData(['challenge', 'current'])).toBeUndefined();
    source.clear();
    restored.clear();
  });

  it('shows the cached forecast and Last updated when the network is offline', async () => {
    onlineManager.setOnline(false);
    const queryClient = createOfflineQueryClient();
    queryClient.setQueryData(['forecast', '2481', CELL, START], OK_FORECAST, {
      updatedAt: UPDATED_AT,
    });
    queryClient.setQueryData(['species', '2481', 'scotland'], SPECIES, {
      updatedAt: UPDATED_AT,
    });

    const { client, getSpy } = failingForecastClient();

    const view = await renderWithProviders(
      <ForecastDetailView
        taxonId="2481"
        cell={CELL}
        region="scotland"
        now={NOW}
        lightForCell={() => FIXED_LIGHT}
      />,
      {
        apiClient: client,
        queryClient,
        initialPreferences: { region: 'scotland', onboardingComplete: true },
      },
    );

    await waitFor(() => {
      expect(view.getByTestId('forecast-ok')).toBeTruthy();
    });

    expect(view.getByTestId('forecast-week-score')).toHaveTextContent(/69/);
    expect(view.getByTestId('forecast-area-label')).toHaveTextContent('Glasgow · Kelvin area');

    const lastUpdated = view.getByTestId('last-updated');
    expect(lastUpdated).toBeTruthy();
    expect(lastUpdated).toHaveTextContent(`Last updated ${formatLastUpdated(UPDATED_AT, 'en')}`);
    expect(getSpy).not.toHaveBeenCalled();
    view.unmount();
    queryClient.clear();
  });

  it('hides Last updated while online even with cached data', async () => {
    onlineManager.setOnline(true);
    const queryClient = createOfflineQueryClient();
    queryClient.setQueryData(['forecast', '2481', CELL, START], OK_FORECAST, {
      updatedAt: UPDATED_AT,
    });
    queryClient.setQueryData(['species', '2481', 'scotland'], SPECIES, {
      updatedAt: UPDATED_AT,
    });

    const { client } = failingForecastClient();
    const view = await renderWithProviders(
      <ForecastDetailView
        taxonId="2481"
        cell={CELL}
        region="scotland"
        now={NOW}
        lightForCell={() => FIXED_LIGHT}
      />,
      {
        apiClient: client,
        queryClient,
        initialPreferences: { region: 'scotland', onboardingComplete: true },
      },
    );

    await waitFor(() => {
      expect(view.getByTestId('forecast-ok')).toBeTruthy();
    });
    expect(view.queryByTestId('last-updated')).toBeNull();
    view.unmount();
    queryClient.clear();
  });
});

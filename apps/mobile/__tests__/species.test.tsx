import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';

import { SpeciesBrowse } from '@/components/species/SpeciesBrowse';
import { SpeciesDetailView } from '@/components/species/SpeciesDetailView';
import type { SpeciesDetail, SpeciesListItem } from '@/lib/species';
import { createMockSpeciesApiClient, weeksFromPattern } from '../testing/mock-api-client';
import { renderWithProviders } from '../testing/test-utils';

const OPEN_ROW: SpeciesListItem = {
  taxonId: '2481',
  scientificName: 'Alcedo atthis',
  commonNames: { en: 'Common kingfisher', ur: 'کنگ فششر' },
  group: 'bird',
  tier: 'open',
  coastal: false,
  challengeEligible: true,
};

const NO_FORECAST_ROW: SpeciesListItem = {
  taxonId: '9001',
  scientificName: 'Tetrao urogallus',
  commonNames: { en: 'Western capercaillie' },
  group: 'bird',
  tier: 'no_forecast',
  coastal: false,
  challengeEligible: false,
};

const MAMMAL_ROW: SpeciesListItem = {
  taxonId: '5219',
  scientificName: 'Sciurus vulgaris',
  commonNames: { en: 'Red squirrel' },
  group: 'mammal',
  tier: 'open',
  coastal: false,
  challengeEligible: false,
};

const OPEN_DETAIL: SpeciesDetail = {
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
  card: {
    bodyMd: 'Start with 1/1000s.',
    settings: { shutter: '1/1000' },
    ethicsMd: 'No playback.',
    legalMd: null,
    reviewedBy: 'Alex Reviewer',
    reviewedAt: '2026-01-10T00:00:00.000Z',
  },
};

const NO_FORECAST_DETAIL: SpeciesDetail = {
  taxonId: '9001',
  scientificName: 'Tetrao urogallus',
  commonNames: { en: 'Western capercaillie' },
  group: 'bird',
  regionSlug: 'scotland',
  tier: 'no_forecast',
  coastal: false,
  tidePref: null,
  activityPattern: 'diurnal',
  challengeEligible: false,
  card: null,
};

function mockClient() {
  return createMockSpeciesApiClient({
    list: [OPEN_ROW, NO_FORECAST_ROW, MAMMAL_ROW],
    detailById: {
      '2481': OPEN_DETAIL,
      '9001': NO_FORECAST_DETAIL,
    },
    seasonalityById: {
      '2481': {
        taxonId: '2481',
        regionSlug: 'scotland',
        weeks: weeksFromPattern([0.1, 0.2, 0.8, 0.4]),
      },
      '9001': {
        taxonId: '9001',
        regionSlug: 'scotland',
        weeks: weeksFromPattern([0.05, 0.1, 0.15]),
      },
    },
  });
}

describe('Species browse (T6.3 S-04)', () => {
  it('lists species with tier badges and filters by group', async () => {
    const onSelect = jest.fn();
    const view = await renderWithProviders(<SpeciesBrowse onSelectSpecies={onSelect} />, {
      apiClient: mockClient(),
      initialPreferences: { region: 'scotland', onboardingComplete: true },
    });

    await waitFor(() => {
      expect(view.getByTestId('species-row-2481')).toBeTruthy();
    });
    expect(view.getByText('Common kingfisher')).toBeTruthy();
    expect(view.getAllByTestId('tier-badge-open').length).toBeGreaterThan(0);
    expect(view.getAllByTestId('tier-badge-no_forecast').length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.press(view.getByTestId('species-filter-mammal'));
    });

    await waitFor(() => {
      expect(view.queryByTestId('species-row-2481')).toBeNull();
      expect(view.getByTestId('species-row-5219')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(view.getByTestId('species-row-5219'));
    });
    expect(onSelect).toHaveBeenCalledWith('5219');
  });

  it('searches by common name via the API query', async () => {
    const view = await renderWithProviders(<SpeciesBrowse />, {
      apiClient: mockClient(),
      initialPreferences: { region: 'scotland', onboardingComplete: true },
    });

    await waitFor(() => {
      expect(view.getByTestId('species-row-2481')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.changeText(view.getByTestId('species-search'), 'capercaillie');
    });

    await waitFor(
      () => {
        expect(view.queryByTestId('species-row-2481')).toBeNull();
        expect(view.getByTestId('species-row-9001')).toBeTruthy();
      },
      { timeout: 2000 },
    );
  });
});

describe('Species detail (T6.3 S-05)', () => {
  it('shows seasonality labelled relative reporting rate and a forecast button', async () => {
    const onGetForecast = jest.fn();
    const view = await renderWithProviders(
      <SpeciesDetailView taxonId="2481" region="scotland" onGetForecast={onGetForecast} />,
      {
        apiClient: mockClient(),
        initialPreferences: { region: 'scotland', onboardingComplete: true },
      },
    );

    await waitFor(() => {
      expect(view.getByTestId('species-detail')).toBeTruthy();
    });
    expect(view.getByTestId('seasonality-label')).toHaveTextContent('Relative reporting rate');
    expect(view.getByTestId('species-card-reviewed')).toBeTruthy();

    const forecast = view.getByTestId('species-get-forecast');
    await act(async () => {
      fireEvent.press(forecast);
    });
    expect(onGetForecast).toHaveBeenCalledWith('2481');
  });

  it('for no_forecast shows the explanation and hides the forecast button', async () => {
    const view = await renderWithProviders(
      <SpeciesDetailView taxonId="9001" region="scotland" onGetForecast={jest.fn()} />,
      {
        apiClient: mockClient(),
        initialPreferences: { region: 'scotland', onboardingComplete: true },
      },
    );

    await waitFor(() => {
      expect(view.getByTestId('species-no-forecast-explanation')).toBeTruthy();
    });
    expect(view.getByText(/No forecast for this species/i)).toBeTruthy();
    expect(view.getByTestId('tier-badge-no_forecast')).toBeTruthy();
    expect(view.queryByTestId('species-get-forecast')).toBeNull();
    expect(view.getByTestId('seasonality-chart')).toBeTruthy();
  });
});

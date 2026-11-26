import React from 'react';
import { waitFor } from '@testing-library/react-native';

import ChallengeScreen from '../app/(tabs)/challenge';
import ExploreScreen from '../app/(tabs)/explore';
import HomeScreen from '../app/(tabs)/index';
import LogbookScreen from '../app/(tabs)/logbook';
import ProfileScreen from '../app/(tabs)/profile';
import { createMockSpeciesApiClient } from '../testing/mock-api-client';
import { renderWithProviders } from '../testing/test-utils';

const emptySpeciesClient = createMockSpeciesApiClient({
  list: [],
  detailById: {},
  seasonalityById: {},
});

describe('tab screens (T6.1 snapshots)', () => {
  it('matches Home snapshot', async () => {
    const tree = (await renderWithProviders(<HomeScreen />)).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('matches Explore snapshot', async () => {
    const view = await renderWithProviders(<ExploreScreen />, {
      apiClient: emptySpeciesClient,
      initialPreferences: { region: 'scotland', onboardingComplete: true },
    });
    await waitFor(() => {
      expect(view.getByTestId('species-browse-empty')).toBeTruthy();
    });
    expect(view.toJSON()).toMatchSnapshot();
  });

  it('matches Logbook snapshot', async () => {
    const tree = (await renderWithProviders(<LogbookScreen />)).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('matches Challenge snapshot', async () => {
    const tree = (await renderWithProviders(<ChallengeScreen />)).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('matches Profile snapshot', async () => {
    const tree = (await renderWithProviders(<ProfileScreen />)).toJSON();
    expect(tree).toMatchSnapshot();
  });
});

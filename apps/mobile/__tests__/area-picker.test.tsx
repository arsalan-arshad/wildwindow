import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { snapToCell } from '@wildwindow/geoprivacy';
import type { AreaResponse, PlaceSummary } from '@wildwindow/shared';

import { AreaPicker } from '@/components/area/AreaPicker';
import { AREA_PREF_KEYS, loadSelectedCellR7 } from '@/lib/area-selection';
import { createMemoryPreferenceStorage } from '@/lib/preferences';
import { createMockSpeciesApiClient } from '../testing/mock-api-client';
import { renderWithProviders } from '../testing/test-utils';

const GLASGOW_CELL = snapToCell(55.86, -4.25, 7);
const OUTSIDE_CELL = snapToCell(40.71, -74.0, 7);

const GLASGOW_PLACE: PlaceSummary = {
  id: 'place-glasgow',
  name: 'Glasgow',
  regionSlug: 'scotland',
  cellR7: GLASGOW_CELL,
};

const GLASGOW_AREA: AreaResponse = {
  cellR7: GLASGOW_CELL,
  label: 'Glasgow · Kelvin area',
  regionSlug: 'scotland',
  covered: true,
};

const OUTSIDE_AREA: AreaResponse = {
  cellR7: OUTSIDE_CELL,
  label: 'Not covered yet',
  regionSlug: null,
  covered: false,
};

function mockClient() {
  return createMockSpeciesApiClient(
    { list: [], detailById: {}, seasonalityById: {} },
    {
      places: [GLASGOW_PLACE],
      areasByCell: {
        [GLASGOW_CELL]: GLASGOW_AREA,
        [OUTSIDE_CELL]: OUTSIDE_AREA,
      },
    },
  );
}

describe('Area picker (T6.4 S-06)', () => {
  it('searches places and selects a cell without exposing coordinates', async () => {
    const storage = createMemoryPreferenceStorage();
    const onAreaChosen = jest.fn();
    const api = mockClient();
    const areasSpy = jest.spyOn(api.areas, 'get');

    const view = await renderWithProviders(
      <AreaPicker preferenceStorage={storage} onAreaChosen={onAreaChosen} />,
      {
        apiClient: api,
        preferenceStorage: storage,
        initialPreferences: { region: 'scotland', onboardingComplete: true },
      },
    );

    fireEvent.changeText(view.getByTestId('area-search'), 'Glas');

    await waitFor(() => {
      expect(view.getByTestId('place-row-place-glasgow')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(view.getByTestId('place-row-place-glasgow'));
    });

    await waitFor(() => {
      expect(view.getByTestId('area-label')).toBeTruthy();
    });

    expect(view.getByText('Glasgow · Kelvin area')).toBeTruthy();
    expect(view.getByTestId('area-covered')).toBeTruthy();
    expect(areasSpy).toHaveBeenCalledWith(GLASGOW_CELL);
    expect(onAreaChosen).toHaveBeenCalledWith({
      cellR7: GLASGOW_CELL,
      area: GLASGOW_AREA,
    });
    expect(await loadSelectedCellR7(storage)).toBe(GLASGOW_CELL);
    expect(await storage.getItem(AREA_PREF_KEYS.cellR7)).toBe(GLASGOW_CELL);
  });

  it('use my location snaps on device and only forwards the cell ID', async () => {
    const storage = createMemoryPreferenceStorage();
    const api = mockClient();
    const areasSpy = jest.spyOn(api.areas, 'get');
    const onAreaChosen = jest.fn();

    const view = await renderWithProviders(
      <AreaPicker
        preferenceStorage={storage}
        onAreaChosen={onAreaChosen}
        locationProvider={{
          requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
          getCurrentPositionAsync: async () => ({
            coords: { latitude: 55.86, longitude: -4.25 },
          }),
        }}
      />,
      {
        apiClient: api,
        preferenceStorage: storage,
        initialPreferences: { region: 'scotland', onboardingComplete: true },
      },
    );

    await act(async () => {
      fireEvent.press(view.getByTestId('area-use-my-location'));
    });

    await waitFor(() => {
      expect(onAreaChosen).toHaveBeenCalled();
      expect(view.getByText('Glasgow · Kelvin area')).toBeTruthy();
    });

    expect(areasSpy.mock.calls.every((call) => call[0] === GLASGOW_CELL)).toBe(true);
    for (const call of areasSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain('55.86');
      expect(JSON.stringify(call)).not.toContain('-4.25');
    }
    expect(await loadSelectedCellR7(storage)).toBe(GLASGOW_CELL);
  });

  it('shows not covered for cells outside beta regions', async () => {
    const storage = createMemoryPreferenceStorage();
    const api = mockClient();

    const view = await renderWithProviders(
      <AreaPicker
        preferenceStorage={storage}
        locationProvider={{
          requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
          getCurrentPositionAsync: async () => ({
            coords: { latitude: 40.71, longitude: -74.0 },
          }),
        }}
      />,
      {
        apiClient: api,
        preferenceStorage: storage,
        initialPreferences: { region: 'scotland', onboardingComplete: true },
      },
    );

    await act(async () => {
      fireEvent.press(view.getByTestId('area-use-my-location'));
    });

    await waitFor(() => {
      expect(view.getByTestId('area-not-covered')).toBeTruthy();
    });
    expect(view.queryByTestId('area-continue')).toBeNull();
  });
});

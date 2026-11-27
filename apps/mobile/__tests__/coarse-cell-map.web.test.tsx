/**
 * Imports the web platform stub directly so jest (ios preset) still covers it.
 * Ensures the web graph never needs react-native-maps.
 */
import React from 'react';

import { CoarseCellMap } from '@/components/area/CoarseCellMap.web';
import { renderWithProviders } from '../testing/test-utils';

describe('CoarseCellMap web stub', () => {
  it('renders empty placeholder without loading react-native-maps', async () => {
    const view = await renderWithProviders(<CoarseCellMap cellR7={null} />);

    expect(view.getByTestId('coarse-cell-map-empty')).toBeTruthy();
    expect(view.queryByTestId('coarse-cell-map-view')).toBeNull();
  });

  it('renders web-unavailable copy when a cell is selected', async () => {
    const view = await renderWithProviders(<CoarseCellMap cellR7="872830828ffffff" />);

    expect(view.getByTestId('coarse-cell-map-web')).toBeTruthy();
    expect(
      view.getByText('The coarse area map is available in the iOS and Android apps.'),
    ).toBeTruthy();
    expect(view.queryByTestId('coarse-cell-map-view')).toBeNull();
  });
});

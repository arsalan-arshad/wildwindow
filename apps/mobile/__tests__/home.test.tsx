import React from 'react';

import HomeScreen from '../app/(tabs)/index';
import { renderWithProviders } from '../testing/test-utils';

describe('HomeScreen', () => {
  it('renders the Home placeholder', async () => {
    const view = await renderWithProviders(<HomeScreen />);
    expect(view.getByText('Home')).toBeTruthy();
    expect(view.getByText('WildWindow placeholder')).toBeTruthy();
  });
});

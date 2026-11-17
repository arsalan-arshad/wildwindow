import React from 'react';
import { render } from '@testing-library/react-native';

import HomeScreen from '../app/(tabs)/index';

describe('HomeScreen', () => {
  it('renders the Home placeholder', async () => {
    const view = await render(<HomeScreen />);
    expect(view.getByText('Home')).toBeTruthy();
  });
});

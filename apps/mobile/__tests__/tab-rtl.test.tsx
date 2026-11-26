import React from 'react';

import HomeScreen from '../app/(tabs)/index';
import { getLayoutDirection, setAppLanguage } from '@/lib/i18n';
import { renderWithProviders } from '../testing/test-utils';

describe('tab layout direction (T6.1)', () => {
  it('Home uses rtl direction after switching to ur', async () => {
    await setAppLanguage('ur');
    expect(getLayoutDirection()).toBe('rtl');

    const view = await renderWithProviders(<HomeScreen />, { language: 'ur' });
    const root = view.getByTestId('tab-home');
    expect(JSON.stringify(root.props.style)).toContain('"direction":"rtl"');
    expect(view.getByText('ہوم')).toBeTruthy();
  });
});

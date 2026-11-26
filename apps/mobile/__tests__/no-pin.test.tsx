import React from 'react';

import { NoPinPromise } from '@/components/no-pin/NoPinPromise';
import { renderWithProviders } from '../testing/test-utils';

describe('No-Pin Promise screen (T6.2 S-09)', () => {
  it('shows the PRD §9.1 pledge and plain-words tier rows', async () => {
    const view = await renderWithProviders(<NoPinPromise />);

    expect(view.getByTestId('no-pin-pledge')).toBeTruthy();
    expect(view.getByText('WildWindow will never put a pin on a wild animal.')).toBeTruthy();
    expect(view.getByText(/never an exact spot/i)).toBeTruthy();

    expect(view.getByTestId('tier-row-open')).toBeTruthy();
    expect(view.getByTestId('tier-row-protected')).toBeTruthy();
    expect(view.getByTestId('tier-row-highly_protected')).toBeTruthy();
    expect(view.getByTestId('tier-row-no_forecast')).toBeTruthy();

    expect(view.getByText('Open')).toBeTruthy();
    expect(view.getByText('Protected')).toBeTruthy();
    expect(view.getByText('Highly protected')).toBeTruthy();
    expect(view.getByText('No forecast')).toBeTruthy();
    expect(view.getByText(/about 5 km²/i)).toBeTruthy();
    expect(view.getByText(/at least 30 days old/i)).toBeTruthy();
    expect(view.getByText(/at least a year old/i)).toBeTruthy();
    expect(view.getByText(/Never shown on a map/i)).toBeTruthy();
  });
});

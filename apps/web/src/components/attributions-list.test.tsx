import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { attributionsFixture } from '@/__fixtures__/attributions';

import { AttributionsList } from './attributions-list';

describe('AttributionsList (W-06)', () => {
  it('renders datasets and providers from a fixture', () => {
    render(<AttributionsList data={attributionsFixture} />);

    expect(screen.getByTestId('attributions-list')).toBeInTheDocument();
    expect(screen.getByText('Zebra observations')).toBeInTheDocument();
    expect(screen.getByText('Alpha checklist')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '10.15468/dl.t515aa' })).toHaveAttribute(
      'href',
      'https://doi.org/10.15468/dl.t515aa',
    );
    expect(screen.getByTestId('provider-weather-metno')).toHaveTextContent(/MET Norway/i);
    expect(screen.getByTestId('provider-geonames')).toHaveTextContent(/GeoNames/i);
    expect(screen.getByTestId('provider-suncalc')).toHaveTextContent(/suncalc/i);
  });

  it('shows an empty-state message when no datasets are loaded', () => {
    render(
      <AttributionsList
        data={{
          datasets: [],
          providers: attributionsFixture.providers,
        }}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(/no occurrence datasets/i);
    expect(screen.getByTestId('provider-tide-none')).toBeInTheDocument();
  });
});

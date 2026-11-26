import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NoPinPromise } from './no-pin-promise';

describe('NoPinPromise (W-02)', () => {
  it('shows the PRD §9.1 pledge and plain-words tier rows', () => {
    render(<NoPinPromise />);

    expect(screen.getByRole('heading', { level: 1, name: /no-pin promise/i })).toBeInTheDocument();
    expect(screen.getByTestId('no-pin-pledge')).toHaveTextContent(
      /never put a pin on a wild animal/i,
    );
    expect(screen.getByTestId('tier-row-open')).toHaveTextContent(/about 5 km²/i);
    expect(screen.getByTestId('tier-row-protected')).toHaveTextContent(/30 days/i);
    expect(screen.getByTestId('tier-row-highly_protected')).toHaveTextContent(/1,770 km²/i);
    expect(screen.getByTestId('tier-row-no_forecast')).toHaveTextContent(/Capercaillie/i);
    expect(screen.getByRole('link', { name: /@wildwindow\/geoprivacy/i })).toHaveAttribute(
      'href',
      expect.stringContaining('packages/geoprivacy'),
    );
  });
});

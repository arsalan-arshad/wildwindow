import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Landing } from './landing';

describe('Landing', () => {
  it('renders the brand and Sample forecast label', () => {
    const { container } = render(<Landing />);
    expect(
      screen.getByRole('heading', { level: 1, name: /without pinning it/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('WildWindow').length).toBeGreaterThan(0);
    expect(screen.getByText('Sample')).toBeInTheDocument();
    expect(screen.getByText(/not a live forecast/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Sample forecast')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(container.textContent).toMatch(/Window score/);
    // Honest index copy may mention “% chance” to reject it; never present a numeric % chance.
    expect(container.textContent).not.toMatch(/\d+%\s*chance/i);
  });

  it('links the waitlist CTA and No-Pin Promise', () => {
    render(<Landing />);
    const waitlistLinks = screen.getAllByRole('link', { name: /join the waitlist/i });
    expect(waitlistLinks[0]).toHaveAttribute('href', '/waitlist');
    expect(screen.getByRole('link', { name: /read the no-pin promise/i })).toHaveAttribute(
      'href',
      '/no-pin',
    );
  });
});

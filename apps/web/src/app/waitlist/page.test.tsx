import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/waitlist-form', () => ({
  WaitlistForm: () => <div data-testid="waitlist-form">Waitlist form</div>,
}));

import WaitlistPage from './page';

describe('WaitlistPage', () => {
  it('renders one HTML banner composition without pack-graphic underlay', () => {
    const { container } = render(<WaitlistPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: /join the wildwindow waitlist/i }),
    ).toBeInTheDocument();
    // Marketing waitlist-banner.png paints “Be the first…” — must not appear in DOM.
    expect(container.textContent).not.toMatch(/Be the first/i);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelector('img[src="/marketing/waitlist-banner.png"]')).toBeNull();
    expect(screen.getByTestId('waitlist-form')).toBeInTheDocument();
  });
});

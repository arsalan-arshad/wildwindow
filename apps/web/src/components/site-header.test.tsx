import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SiteHeader } from './site-header';

describe('SiteHeader', () => {
  it('shows the brand mark and WildWindow wordmark', () => {
    const { container } = render(<SiteHeader />);
    expect(screen.getByRole('link', { name: /wildwindow/i })).toHaveAttribute('href', '/');
    const mark = container.querySelector('img[src="/brand/mark.svg"]');
    expect(mark).not.toBeNull();
  });
});

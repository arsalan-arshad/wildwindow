import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  challengeEntriesAllPage,
  challengeEntriesAllPage2,
  challengeEntriesGbOnly,
  challengeEntriesPkOnly,
  challengeFixture,
} from '@/__fixtures__/challenge-gallery';
import type { ChallengeEntriesQuery, ChallengeEntriesResponse } from '@wildwindow/shared/api';

import { ChallengePageView } from './challenge-page';

function assertNoPinLeak(container: HTMLElement): void {
  expect(container.querySelector('[data-testid="species-map"]')).toBeNull();
  expect(container.querySelector('iframe')).toBeNull();
  expect(container.innerHTML).not.toMatch(/leaflet|mapbox|react-map|MapContainer|mapCells/i);
  expect(container.textContent).not.toMatch(/\bH3\b|cellR7|lat\/lng|latitude|longitude/i);
  expect(container.innerHTML).not.toMatch(
    /"lat"|"lng"|"latitude"|"longitude"|"coordinates"|cell_r7/i,
  );
}

describe('ChallengePageView (W-04 / T7.5)', () => {
  it('renders challenge header, country tabs, paginated gallery — country + region only', async () => {
    const user = userEvent.setup();
    const loadEntries = vi.fn(
      async (_slug: string, query: ChallengeEntriesQuery): Promise<ChallengeEntriesResponse> => {
        if (query.cursor === 'cursor-page-2') {
          return challengeEntriesAllPage2;
        }
        if (query.country === 'GB') {
          return challengeEntriesGbOnly;
        }
        if (query.country === 'PK') {
          return challengeEntriesPkOnly;
        }
        return challengeEntriesAllPage;
      },
    );

    const { container } = render(
      <ChallengePageView challenge={challengeFixture} loadEntries={loadEntries} />,
    );

    expect(screen.getByTestId('challenge-page')).toBeInTheDocument();
    expect(screen.getByTestId('challenge-page-title')).toHaveTextContent('Kingfisher Month');
    expect(screen.getByTestId('challenge-page-status')).toHaveTextContent('Live');
    expect(screen.getByTestId('challenge-page-total')).toHaveTextContent('3 entries');
    expect(screen.getByTestId('challenge-count-GB')).toHaveTextContent(/United Kingdom/);
    expect(screen.getByTestId('challenge-count-PK')).toHaveTextContent(/Pakistan/);
    expect(screen.getByTestId('challenge-rules')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('challenge-gallery-grid')).toBeInTheDocument();
    });

    expect(loadEntries).toHaveBeenCalledWith('kingfisher-month-2026-11', {});

    expect(screen.getByTestId('challenge-gallery-place-entry-gb-1')).toHaveTextContent(
      'Scotland, United Kingdom',
    );
    expect(screen.getByTestId('challenge-gallery-place-entry-pk-1')).toHaveTextContent(
      'Sindh, Pakistan',
    );

    // Pagination: load more appends page 2
    expect(screen.getByTestId('challenge-gallery-more')).toBeInTheDocument();
    await user.click(screen.getByTestId('challenge-gallery-more'));
    await waitFor(() => {
      expect(screen.getByTestId('challenge-gallery-item-entry-gb-2')).toBeInTheDocument();
    });
    expect(loadEntries).toHaveBeenCalledWith('kingfisher-month-2026-11', {
      cursor: 'cursor-page-2',
    });

    // Country tab filters to Pakistan only
    await user.click(screen.getByTestId('challenge-gallery-tab-PK'));
    await waitFor(() => {
      expect(loadEntries).toHaveBeenCalledWith('kingfisher-month-2026-11', { country: 'PK' });
    });
    await waitFor(() => {
      expect(screen.getByTestId('challenge-gallery-item-entry-pk-1')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('challenge-gallery-item-entry-gb-1')).not.toBeInTheDocument();

    const tabs = screen.getByTestId('challenge-gallery-tabs');
    expect(within(tabs).getByRole('tab', { selected: true })).toHaveAttribute(
      'data-testid',
      'challenge-gallery-tab-PK',
    );

    assertNoPinLeak(container);
  });

  it('shows an empty state when a country filter has no entries', async () => {
    const loadEntries = vi.fn(async (): Promise<ChallengeEntriesResponse> => ({
      entries: [],
      nextCursor: null,
    }));

    render(
      <ChallengePageView
        challenge={{
          ...challengeFixture,
          countryCounts: [{ countryCode: 'GB', count: 0 }],
        }}
        loadEntries={loadEntries}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('challenge-gallery-empty')).toBeInTheDocument();
    });
  });
});

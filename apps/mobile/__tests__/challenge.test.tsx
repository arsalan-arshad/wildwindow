import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';

import { ChallengeHome } from '@/components/challenge/ChallengeHome';
import { ChallengeSubmitForm } from '@/components/challenge/ChallengeSubmitForm';
import type { ChallengeSummary } from '@/lib/challenge';
import type { SpeciesDetail, SpeciesListItem } from '@/lib/species';
import { createMockAuthClient } from '@/testing/mock-auth-client';
import { createMockSpeciesApiClient } from '../testing/mock-api-client';
import { renderWithProviders } from '../testing/test-utils';

const KINGFISHER_ROW: SpeciesListItem = {
  taxonId: '2481',
  scientificName: 'Alcedo atthis',
  commonNames: { en: 'Common kingfisher', ur: 'کنگ فششر' },
  group: 'bird',
  tier: 'open',
  coastal: false,
  challengeEligible: true,
};

const KINGFISHER_DETAIL: SpeciesDetail = {
  taxonId: '2481',
  scientificName: 'Alcedo atthis',
  commonNames: { en: 'Common kingfisher' },
  group: 'bird',
  regionSlug: 'scotland',
  tier: 'open',
  coastal: false,
  tidePref: null,
  activityPattern: 'diurnal',
  challengeEligible: true,
  card: null,
};

const LIVE_CHALLENGE: ChallengeSummary = {
  slug: 'kingfisher-month-2026-11',
  title: 'Kingfisher Month',
  taxonId: '2481',
  startsOn: '2026-11-01',
  endsOn: '2026-11-30',
  rulesMd: '## Rules\n\nOne photo per person. Show only country and region.',
  status: 'active',
  countryCounts: [
    { countryCode: 'GB', count: 2 },
    { countryCode: 'PK', count: 1 },
  ],
};

const NOW = new Date('2026-11-15T12:00:00.000Z');

function speciesFixtures() {
  return {
    list: [KINGFISHER_ROW],
    detailById: { '2481': KINGFISHER_DETAIL },
    seasonalityById: {},
  };
}

describe('Challenge home (T6.10 S-13)', () => {
  it('shows title, dates, country counts, rules and a submit CTA', async () => {
    const onSubmit = jest.fn();
    const api = createMockSpeciesApiClient(
      speciesFixtures(),
      {},
      {},
      {},
      {
        current: LIVE_CHALLENGE,
        bySlug: { [LIVE_CHALLENGE.slug]: LIVE_CHALLENGE },
        entriesBySlug: {
          [LIVE_CHALLENGE.slug]: [
            {
              id: 'e1',
              countryCode: 'GB',
              regionLabel: 'Scotland',
              photoUrl: 'https://example.test/e1.jpg',
              publishedAt: '2026-11-10T00:00:00.000Z',
            },
          ],
        },
      },
    );

    const view = await renderWithProviders(<ChallengeHome onSubmit={onSubmit} now={NOW} />, {
      apiClient: api,
      initialPreferences: { region: 'scotland', onboardingComplete: true },
    });

    await waitFor(() => {
      expect(view.getByTestId('challenge-home-title')).toBeTruthy();
    });

    expect(view.getByText('Kingfisher Month')).toBeTruthy();
    // Species label resolves asynchronously from the species query (fallback is "Taxon <id>").
    await waitFor(() => {
      expect(view.getByTestId('challenge-home-species').props.children).toContain('kingfisher');
    });
    expect(view.getByTestId('challenge-count-GB')).toBeTruthy();
    expect(view.getByTestId('challenge-count-PK')).toBeTruthy();
    expect(view.getByTestId('challenge-home-rules')).toBeTruthy();
    expect(view.getByTestId('challenge-home-pledge')).toBeTruthy();

    await waitFor(() => {
      expect(view.getByTestId('challenge-gallery')).toBeTruthy();
    });

    fireEvent.press(view.getByTestId('challenge-home-submit'));
    expect(onSubmit).toHaveBeenCalledWith(LIVE_CHALLENGE.slug);
  });
});

describe('Challenge submit (T6.10 S-14)', () => {
  it('disables submit until the ethics pledge is ticked', async () => {
    const submit = jest.fn(async () => ({
      id: 'ce-9',
      status: 'pending' as const,
      publishAfter: '2026-11-22T12:00:00.000Z',
    }));
    const onSubmitted = jest.fn();

    const api = createMockSpeciesApiClient(
      speciesFixtures(),
      {},
      {},
      {},
      {
        current: LIVE_CHALLENGE,
        bySlug: { [LIVE_CHALLENGE.slug]: LIVE_CHALLENGE },
        logbookItems: [
          {
            id: 'lb-match',
            taxonId: '2481',
            takenAt: '2026-11-08T09:00:00.000Z',
            notes: 'Perched on a reed',
          },
        ],
        submit,
      },
    );

    const auth = createMockAuthClient({
      initialUser: { uid: 'u1', email: 'p1@example.com', displayName: null },
    });

    const view = await renderWithProviders(
      <ChallengeSubmitForm slug={LIVE_CHALLENGE.slug} now={NOW} onSubmitted={onSubmitted} />,
      {
        apiClient: api,
        authClient: auth,
        initialPreferences: { region: 'scotland', onboardingComplete: true },
      },
    );

    await waitFor(() => {
      expect(view.getByTestId('challenge-submit-entry-lb-match')).toBeTruthy();
    });

    const button = view.getByTestId('challenge-submit-button');
    expect(button.props.accessibilityState?.disabled).toBe(true);

    await act(async () => {
      fireEvent.press(view.getByTestId('challenge-submit-entry-lb-match'));
    });
    expect(button.props.accessibilityState?.disabled).toBe(true);

    await act(async () => {
      fireEvent.press(view.getByTestId('challenge-submit-pledge'));
    });

    await waitFor(() => {
      expect(view.getByTestId('challenge-submit-button').props.accessibilityState?.disabled).toBe(
        false,
      );
    });

    await act(async () => {
      fireEvent.press(view.getByTestId('challenge-submit-button'));
    });

    await waitFor(() => {
      expect(submit).toHaveBeenCalledTimes(1);
      expect(onSubmitted).toHaveBeenCalledWith('ce-9');
    });

    expect(submit).toHaveBeenCalledWith(
      LIVE_CHALLENGE.slug,
      expect.objectContaining({
        logbookEntryId: 'lb-match',
        pledgeAccepted: true,
        countryCode: 'GB',
        regionLabel: 'Scotland',
      }),
    );
  });

  it('does not let wrong-species logbook entries be picked', async () => {
    const api = createMockSpeciesApiClient(
      speciesFixtures(),
      {},
      {},
      {},
      {
        current: LIVE_CHALLENGE,
        bySlug: { [LIVE_CHALLENGE.slug]: LIVE_CHALLENGE },
        logbookItems: [
          {
            id: 'lb-match',
            taxonId: '2481',
            takenAt: '2026-11-08T09:00:00.000Z',
            notes: 'Kingfisher',
          },
          {
            id: 'lb-wrong',
            taxonId: '5219',
            takenAt: '2026-11-09T09:00:00.000Z',
            notes: 'Squirrel — wrong species',
          },
          {
            id: 'lb-null',
            taxonId: null,
            takenAt: '2026-11-10T09:00:00.000Z',
            notes: 'No taxon',
          },
        ],
      },
    );

    const auth = createMockAuthClient({
      initialUser: { uid: 'u2', email: 'p2@example.com', displayName: null },
    });

    const view = await renderWithProviders(
      <ChallengeSubmitForm slug={LIVE_CHALLENGE.slug} now={NOW} />,
      {
        apiClient: api,
        authClient: auth,
        initialPreferences: { region: 'sindh', onboardingComplete: true },
      },
    );

    await waitFor(() => {
      expect(view.queryByTestId('challenge-submit-signed-out')).toBeNull();
      expect(view.getByTestId('challenge-submit-entry-lb-match')).toBeTruthy();
    });

    // Wrong-species / unset-taxon rows are not rendered as pickable entries.
    expect(view.queryByTestId('challenge-submit-entry-lb-wrong')).toBeNull();
    expect(view.queryByTestId('challenge-submit-entry-lb-null')).toBeNull();
    expect(view.getByText(/2 other logbook entries/)).toBeTruthy();
    expect(view.getByText(/Sindh, PK/)).toBeTruthy();
  });
});

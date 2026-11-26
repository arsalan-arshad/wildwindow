import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';

import { FieldCardView } from '@/components/species/FieldCardView';
import { SpeciesDetailView } from '@/components/species/SpeciesDetailView';
import type { SpeciesDetail, SpeciesListItem } from '@/lib/species';
import { createMockSpeciesApiClient, weeksFromPattern } from '../testing/mock-api-client';
import { renderWithProviders } from '../testing/test-utils';

const OPEN_ROW: SpeciesListItem = {
  taxonId: '2481',
  scientificName: 'Alcedo atthis',
  commonNames: { en: 'Common kingfisher' },
  group: 'bird',
  tier: 'open',
  coastal: false,
  challengeEligible: true,
};

const REVIEWED_DETAIL: SpeciesDetail = {
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
  card: {
    bodyMd: '## Fieldcraft\n\nStart at **1/1000s** and stay low on the bank.',
    settings: {
      perched: { shutter: '1/1000', aperture: 'f/5.6', iso: 400, focusMode: 'AF-C' },
      flight: { shutter: '1/2000', driveMode: 'continuous' },
    },
    ethicsMd: '- No baiting\n- No playback for photos',
    legalMd: 'In Scotland, disturbing a Schedule 1 bird at the nest needs a NatureScot licence.',
    reviewedBy: 'Alex Reviewer',
    reviewedAt: '2026-01-10T00:00:00.000Z',
  },
};

const UNREVIEWED_DETAIL: SpeciesDetail = {
  ...REVIEWED_DETAIL,
  taxonId: '9002',
  scientificName: 'Lutra lutra',
  commonNames: { en: 'Eurasian otter' },
  card: null,
};

/** Defensive fixture: API should not return this, but the UI must still hide it. */
const DRAFT_LEAK_DETAIL: SpeciesDetail = {
  ...REVIEWED_DETAIL,
  taxonId: '9003',
  scientificName: 'Draftus only',
  commonNames: { en: 'Draft species' },
  card: {
    bodyMd: '## Draft body that must not render',
    settings: { shutter: '1/60' },
    ethicsMd: 'Hidden ethics',
    legalMd: 'Hidden legal',
    reviewedBy: '',
    reviewedAt: '2026-01-10T00:00:00.000Z',
  },
};

function mockClient() {
  return createMockSpeciesApiClient({
    list: [OPEN_ROW],
    detailById: {
      '2481': REVIEWED_DETAIL,
      '9002': UNREVIEWED_DETAIL,
      '9003': DRAFT_LEAK_DETAIL,
    },
    seasonalityById: {
      '2481': {
        taxonId: '2481',
        regionSlug: 'scotland',
        weeks: weeksFromPattern([0.2, 0.4, 0.6]),
      },
      '9002': {
        taxonId: '9002',
        regionSlug: 'scotland',
        weeks: weeksFromPattern([0.1]),
      },
      '9003': {
        taxonId: '9003',
        regionSlug: 'scotland',
        weeks: weeksFromPattern([0.1]),
      },
    },
  });
}

describe('Field card (T6.6 S-08)', () => {
  it('renders settings, Markdown sections and Reviewed by for a reviewed card', async () => {
    const view = await renderWithProviders(<FieldCardView taxonId="2481" region="scotland" />, {
      apiClient: mockClient(),
      initialPreferences: { region: 'scotland', onboardingComplete: true },
    });

    await waitFor(() => {
      expect(view.getByTestId('field-card')).toBeTruthy();
    });

    expect(view.getByTestId('field-card-reviewed')).toHaveTextContent(/Alex Reviewer/);
    expect(view.getByTestId('field-card-settings')).toBeTruthy();
    expect(view.getByTestId('setting-scene-perched')).toBeTruthy();
    expect(view.getByTestId('setting-row-perched-shutter')).toHaveTextContent(/1\/1000/);
    expect(view.getByTestId('field-card-fieldcraft')).toBeTruthy();
    expect(view.getByTestId('field-card-body-md')).toHaveTextContent(/1\/1000s/);
    expect(view.getByTestId('field-card-ethics')).toHaveTextContent(/No baiting/);
    expect(view.getByTestId('field-card-legal')).toHaveTextContent(/NatureScot/);
    expect(view.queryByTestId('field-card-unpublished')).toBeNull();
  });

  it('does not show card content when there is no reviewed card', async () => {
    const view = await renderWithProviders(<FieldCardView taxonId="9002" region="scotland" />, {
      apiClient: mockClient(),
      initialPreferences: { region: 'scotland', onboardingComplete: true },
    });

    await waitFor(() => {
      expect(view.getByTestId('field-card-missing')).toBeTruthy();
    });

    expect(view.getByTestId('field-card-unpublished')).toBeTruthy();
    expect(view.queryByTestId('field-card')).toBeNull();
    expect(view.queryByTestId('field-card-settings')).toBeNull();
    expect(view.queryByTestId('field-card-body-md')).toBeNull();
    expect(view.queryByTestId('field-card-ethics')).toBeNull();
    expect(view.queryByTestId('field-card-legal')).toBeNull();
    expect(view.queryByTestId('field-card-reviewed')).toBeNull();
  });

  it('hides a card payload that lacks review status', async () => {
    const view = await renderWithProviders(<FieldCardView taxonId="9003" region="scotland" />, {
      apiClient: mockClient(),
      initialPreferences: { region: 'scotland', onboardingComplete: true },
    });

    await waitFor(() => {
      expect(view.getByTestId('field-card-unpublished')).toBeTruthy();
    });

    expect(view.queryByText(/Draft body that must not render/i)).toBeNull();
    expect(view.queryByTestId('field-card-settings')).toBeNull();
    expect(view.queryByTestId('field-card-ethics')).toBeNull();
  });

  it('opens the field card from species detail only when reviewed', async () => {
    const onOpenFieldCard = jest.fn();
    const reviewed = await renderWithProviders(
      <SpeciesDetailView taxonId="2481" region="scotland" onOpenFieldCard={onOpenFieldCard} />,
      {
        apiClient: mockClient(),
        initialPreferences: { region: 'scotland', onboardingComplete: true },
      },
    );

    await waitFor(() => {
      expect(reviewed.getByTestId('species-open-field-card')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(reviewed.getByTestId('species-field-card-summary'));
    });
    expect(onOpenFieldCard).toHaveBeenCalledWith('2481');

    const missing = await renderWithProviders(
      <SpeciesDetailView taxonId="9002" region="scotland" onOpenFieldCard={onOpenFieldCard} />,
      {
        apiClient: mockClient(),
        initialPreferences: { region: 'scotland', onboardingComplete: true },
      },
    );

    await waitFor(() => {
      expect(missing.getByTestId('species-card-missing')).toBeTruthy();
    });
    expect(missing.queryByTestId('species-open-field-card')).toBeNull();
    expect(missing.queryByTestId('species-card-reviewed')).toBeNull();
  });
});

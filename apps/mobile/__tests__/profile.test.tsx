import React from 'react';
import { Linking } from 'react-native';
import { act, fireEvent, waitFor } from '@testing-library/react-native';

import { AttributionsList } from '@/components/profile/AttributionsList';
import { AttributionsView } from '@/components/profile/AttributionsView';
import ProfileScreen from '../app/(tabs)/profile';
import { attributionsFixture } from '../__fixtures__/attributions';
import { createMockSpeciesApiClient } from '../testing/mock-api-client';
import { createMockAuthClient } from '../testing/mock-auth-client';
import { renderWithProviders } from '../testing/test-utils';

describe('Profile settings (T6.12 S-16)', () => {
  it('shows region, units, language and privacy on Profile', async () => {
    const view = await renderWithProviders(<ProfileScreen />, {
      initialPreferences: { region: 'scotland', onboardingComplete: true },
    });

    await waitFor(() => {
      expect(view.getByTestId('tab-profile')).toBeTruthy();
    });
    expect(view.getByTestId('profile-region-scotland')).toBeTruthy();
    expect(view.getByTestId('profile-units-metric')).toBeTruthy();
    expect(view.getByTestId('profile-language-en')).toBeTruthy();
    expect(view.getByTestId('profile-privacy')).toBeTruthy();
    expect(view.getByTestId('profile-nopin-link')).toBeTruthy();
    expect(view.getByTestId('profile-attributions-link')).toBeTruthy();
    expect(view.getByTestId('profile-report-bug')).toBeTruthy();
  });

  it('changes home region locally when signed out', async () => {
    const view = await renderWithProviders(<ProfileScreen />, {
      initialPreferences: { region: 'scotland', onboardingComplete: true },
    });

    await waitFor(() => {
      expect(view.getByTestId('profile-region-sindh')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(view.getByTestId('profile-region-sindh'));
    });

    await waitFor(() => {
      expect(view.getByTestId('profile-region-sindh').props.accessibilityState?.selected).toBe(
        true,
      );
    });
  });

  it('changes units preference', async () => {
    const view = await renderWithProviders(<ProfileScreen />, {
      initialPreferences: { region: 'scotland', onboardingComplete: true, units: 'metric' },
    });

    await act(async () => {
      fireEvent.press(view.getByTestId('profile-units-imperial'));
    });

    await waitFor(() => {
      expect(view.getByTestId('profile-units-imperial').props.accessibilityState?.selected).toBe(
        true,
      );
    });
  });

  it('export calls POST /v1/me/export and opens the download URL', async () => {
    const exportFn = jest.fn(async () => ({
      status: 'ready' as const,
      downloadUrl: 'https://example.test/export.json',
    }));
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);

    const apiClient = createMockSpeciesApiClient(
      { list: [], detailById: {}, seasonalityById: {} },
      {},
      {},
      {},
      {},
      {},
      { export: exportFn },
    );
    const authClient = createMockAuthClient({
      initialUser: { uid: 'u1', email: 'ada@example.com', displayName: null },
    });

    const view = await renderWithProviders(<ProfileScreen />, {
      apiClient,
      authClient,
      initialPreferences: { region: 'scotland', onboardingComplete: true },
    });

    await waitFor(() => {
      expect(view.getByTestId('profile-export')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(view.getByTestId('profile-export'));
    });

    await waitFor(() => {
      expect(exportFn).toHaveBeenCalledTimes(1);
      expect(view.getByTestId('profile-export-message')).toBeTruthy();
    });
    expect(openURL).toHaveBeenCalledWith('https://example.test/export.json');

    openURL.mockRestore();
  });

  it('deletion calls DELETE /v1/me and signs out', async () => {
    const deleteFn = jest.fn(async () => ({ ok: true as const, purgeAfterDays: 30 as const }));
    const apiClient = createMockSpeciesApiClient(
      { list: [], detailById: {}, seasonalityById: {} },
      {},
      {},
      {},
      {},
      {},
      { delete: deleteFn },
    );
    const authClient = createMockAuthClient({
      initialUser: { uid: 'u1', email: 'ada@example.com', displayName: null },
    });

    const view = await renderWithProviders(<ProfileScreen />, {
      apiClient,
      authClient,
      initialPreferences: { region: 'scotland', onboardingComplete: true },
    });

    await waitFor(() => {
      expect(view.getByTestId('profile-delete')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(view.getByTestId('profile-delete'));
    });

    await waitFor(() => {
      expect(view.getByTestId('profile-delete-confirm')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(view.getByTestId('profile-delete-confirm-yes'));
    });

    await waitFor(() => {
      expect(deleteFn).toHaveBeenCalledTimes(1);
      expect(view.getByTestId('profile-sign-in')).toBeTruthy();
    });
  });

  it('PATCHes locale when language changes while signed in', async () => {
    const patchFn = jest.fn(async (body: { locale?: 'en' | 'ur' }) => ({
      id: '00000000-0000-4000-8000-000000000001',
      displayName: null,
      homeRegionSlug: 'scotland' as const,
      locale: body.locale ?? 'en',
      role: 'user' as const,
    }));
    const apiClient = createMockSpeciesApiClient(
      { list: [], detailById: {}, seasonalityById: {} },
      {},
      {},
      {},
      {},
      {},
      { patch: patchFn },
    );
    const authClient = createMockAuthClient({
      initialUser: { uid: 'u1', email: 'ada@example.com', displayName: null },
    });

    const view = await renderWithProviders(<ProfileScreen />, {
      apiClient,
      authClient,
      initialPreferences: { region: 'scotland', onboardingComplete: true, language: 'en' },
    });

    await act(async () => {
      fireEvent.press(view.getByTestId('profile-language-ur'));
    });

    await waitFor(() => {
      expect(patchFn).toHaveBeenCalledWith({ locale: 'ur' });
    });
  });
});

describe('Attributions (T6.12 S-17)', () => {
  it('renders datasets and providers from a fixture', async () => {
    const view = await renderWithProviders(<AttributionsList data={attributionsFixture} />);

    expect(view.getByTestId('attributions-list')).toBeTruthy();
    expect(view.getByText('Zebra observations')).toBeTruthy();
    expect(view.getByTestId('attributions-provider-weather-metno')).toBeTruthy();
    expect(view.getByText(/MET Norway/)).toBeTruthy();
  });

  it('loads attributions from the API client', async () => {
    const listFn = jest.fn(async () => attributionsFixture);
    const apiClient = createMockSpeciesApiClient(
      { list: [], detailById: {}, seasonalityById: {} },
      {},
      {},
      {},
      {},
      {},
      {},
      { list: listFn },
    );

    const view = await renderWithProviders(<AttributionsView />, { apiClient });

    await waitFor(() => {
      expect(view.getByTestId('attributions-list')).toBeTruthy();
    });
    expect(listFn).toHaveBeenCalledTimes(1);
    expect(view.getByText('Zebra observations')).toBeTruthy();
  });
});

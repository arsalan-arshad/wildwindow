import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';

import { ReportBugForm } from '@/components/bug-report/ReportBugForm';
import ProfileScreen from '../app/(tabs)/profile';
import { SignInForm } from '@/components/auth/SignInForm';
import { createMockSpeciesApiClient } from '../testing/mock-api-client';
import { createMockAuthClient } from '../testing/mock-auth-client';
import { renderWithProviders } from '../testing/test-utils';

describe('Report a bug (T9.11)', () => {
  it('shows Report a bug on Profile', async () => {
    const view = await renderWithProviders(<ProfileScreen />, {
      initialPreferences: { region: 'scotland', onboardingComplete: true },
    });

    await waitFor(() => {
      expect(view.getByTestId('profile-report-bug')).toBeTruthy();
    });
  });

  it('shows Report a bug on the sign-in form', async () => {
    const authClient = createMockAuthClient({ initialUser: null });
    const view = await renderWithProviders(<SignInForm />, { authClient });

    await waitFor(() => {
      expect(view.getByTestId('sign-in-report-bug')).toBeTruthy();
    });
  });

  it('posts to the API and opens the scrubbed fallback URL', async () => {
    const fallbackUrl =
      'https://github.com/arsalan-arshad/wildwindow/issues/new?template=bug_report.yml&steps=%5Bredacted%5D&expected=Forecast+loads&actual=%5Bredacted%5D&platform=iOS&version=1.0.0&device=iPhone&severity=P2';

    const create = jest.fn(async (body: unknown) => {
      const draft = body as {
        steps: string;
        expected: string;
        actual: string;
        platform: string;
        version: string;
        device: string;
      };
      expect(draft.steps.length).toBeGreaterThan(0);
      expect(draft.expected).toBe('Forecast loads');
      expect(draft.actual.length).toBeGreaterThan(0);
      expect(['iOS', 'Android', 'web', 'api']).toContain(draft.platform);
      return { status: 'fallback' as const, url: fallbackUrl };
    });

    const openURL = jest.fn(async () => undefined);

    const apiClient = createMockSpeciesApiClient(
      { list: [], detailById: {}, seasonalityById: {} },
      {},
      {},
      {},
      {},
      {},
      {},
      {},
      { create },
    );

    const view = await renderWithProviders(
      <ReportBugForm openURL={openURL} testID="report-bug-form" />,
      { apiClient },
    );

    await waitFor(() => {
      expect(view.getByTestId('report-bug-form')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.changeText(
        view.getByTestId('report-bug-steps'),
        'Opened Explore at 55.865, -4.257',
      );
      fireEvent.changeText(view.getByTestId('report-bug-expected'), 'Forecast loads');
      fireEvent.changeText(
        view.getByTestId('report-bug-actual'),
        'Crash; latitude: 55.1 on screen',
      );
    });

    await waitFor(() => {
      expect(view.getByTestId('report-bug-submit').props.accessibilityState?.disabled).toBe(false);
    });

    await act(async () => {
      fireEvent.press(view.getByTestId('report-bug-submit'));
    });

    await waitFor(() => {
      expect(create).toHaveBeenCalledTimes(1);
      expect(openURL).toHaveBeenCalledWith(fallbackUrl);
    });

    expect(fallbackUrl).toContain('template=bug_report.yml');
    expect(fallbackUrl).toContain('%5Bredacted%5D');
    expect(fallbackUrl).not.toMatch(/55\.865/);
    expect(fallbackUrl).not.toMatch(/latitude/);

    await waitFor(() => {
      expect(view.getByTestId('report-bug-success')).toBeTruthy();
    });
  });

  it('shows a success message when the API files the issue', async () => {
    const create = jest.fn(async () => ({ status: 'filed' as const, issueNumber: 88 }));
    const openURL = jest.fn(async () => undefined);

    const apiClient = createMockSpeciesApiClient(
      { list: [], detailById: {}, seasonalityById: {} },
      {},
      {},
      {},
      {},
      {},
      {},
      {},
      { create },
    );

    const view = await renderWithProviders(
      <ReportBugForm openURL={openURL} testID="report-bug-form" />,
      { apiClient },
    );

    await act(async () => {
      fireEvent.changeText(view.getByTestId('report-bug-steps'), '1. Open app');
      fireEvent.changeText(view.getByTestId('report-bug-expected'), 'Works');
      fireEvent.changeText(view.getByTestId('report-bug-actual'), 'Crashes');
    });

    await act(async () => {
      fireEvent.press(view.getByTestId('report-bug-submit'));
    });

    await waitFor(() => {
      expect(create).toHaveBeenCalledTimes(1);
      expect(openURL).not.toHaveBeenCalled();
      expect(view.getByTestId('report-bug-success').props.children).toContain('88');
    });
  });
});

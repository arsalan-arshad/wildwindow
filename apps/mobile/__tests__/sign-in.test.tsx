import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';

import { SignInForm } from '@/components/auth/SignInForm';
import ProfileScreen from '../app/(tabs)/profile';
import { createMockAuthClient } from '../testing/mock-auth-client';
import { renderWithProviders } from '../testing/test-utils';

async function fillAndSubmit(
  view: Awaited<ReturnType<typeof renderWithProviders>>,
  email: string,
  password: string,
): Promise<void> {
  await waitFor(() => {
    expect(view.getByTestId('sign-in-form')).toBeTruthy();
  });

  await act(async () => {
    fireEvent.changeText(view.getByTestId('sign-in-email'), email);
    fireEvent.changeText(view.getByTestId('sign-in-password'), password);
  });

  await waitFor(() => {
    expect(view.getByTestId('sign-in-submit').props.accessibilityState?.disabled).toBe(false);
  });

  await act(async () => {
    fireEvent.press(view.getByTestId('sign-in-submit'));
  });
}

describe('Sign in (T6.7 S-02)', () => {
  it('signs in with email and password via the form', async () => {
    const authClient = createMockAuthClient({ initialUser: null });
    const onSignedIn = jest.fn();

    const view = await renderWithProviders(<SignInForm onSignedIn={onSignedIn} />, {
      authClient,
    });

    await waitFor(() => {
      expect(view.getByTestId('sign-in-form')).toBeTruthy();
    });
    expect(view.getByTestId('sign-in-apple').props.accessibilityState?.disabled).toBe(true);
    expect(view.getByTestId('sign-in-google').props.accessibilityState?.disabled).toBe(true);

    await fillAndSubmit(view, 'photographer@example.com', 'secret12');

    await waitFor(() => {
      expect(onSignedIn).toHaveBeenCalledTimes(1);
    });
    await expect(authClient.getIdToken()).resolves.toBe('mock-id-token');
  });

  it('shows wrong-credentials on a bad email', async () => {
    const authClient = createMockAuthClient({ initialUser: null });
    const view = await renderWithProviders(<SignInForm />, { authClient });

    await fillAndSubmit(view, 'bad@example.com', 'secret12');

    await waitFor(() => {
      expect(view.getByTestId('sign-in-error')).toBeTruthy();
    });
    expect(view.getByText('Email or password is incorrect.')).toBeTruthy();
  });

  it('creates an account when toggled to create mode', async () => {
    const authClient = createMockAuthClient({ initialUser: null });
    const onSignedIn = jest.fn();
    const view = await renderWithProviders(<SignInForm onSignedIn={onSignedIn} />, {
      authClient,
    });

    await waitFor(() => {
      expect(view.getByTestId('sign-in-form')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(view.getByTestId('sign-in-toggle-mode'));
    });

    await fillAndSubmit(view, 'new@example.com', 'secret12');

    await waitFor(() => {
      expect(onSignedIn).toHaveBeenCalledTimes(1);
    });
  });

  it('shows the not-configured state when Firebase is missing', async () => {
    const authClient = createMockAuthClient({ configured: false });
    const view = await renderWithProviders(<SignInForm />, { authClient });

    await waitFor(() => {
      expect(view.getByTestId('sign-in-unconfigured')).toBeTruthy();
    });
    expect(view.getByText(/EXPO_PUBLIC_FIREBASE_CONFIG/)).toBeTruthy();
  });

  it('shows sign-out on Profile when signed in', async () => {
    const authClient = createMockAuthClient({
      initialUser: { uid: 'u1', email: 'ada@example.com', displayName: null },
    });
    const view = await renderWithProviders(<ProfileScreen />, { authClient });

    await waitFor(() => {
      expect(view.getByTestId('profile-signed-in')).toBeTruthy();
    });
    expect(view.getByTestId('profile-email').props.children).toBe('ada@example.com');

    await act(async () => {
      fireEvent.press(view.getByTestId('profile-sign-out'));
    });

    await waitFor(() => {
      expect(view.getByTestId('profile-sign-in')).toBeTruthy();
    });
  });
});

import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { useAuth } from '@/lib/auth/auth-context';
import { createMockAuthClient } from '../testing/mock-auth-client';
import { renderWithProviders } from '../testing/test-utils';

/**
 * Acceptance (T6.7): unit tests for the auth state store.
 */
function AuthProbe() {
  const { status, user, ready, configured, signInWithEmailPassword, signOut } = useAuth();

  return (
    <>
      <Text testID="auth-ready">{ready ? 'ready' : 'loading'}</Text>
      <Text testID="auth-configured">{configured ? 'yes' : 'no'}</Text>
      <Text testID="auth-status">{status}</Text>
      <Text testID="auth-email">{user?.email ?? 'none'}</Text>
      <Pressable
        testID="auth-sign-in"
        onPress={() => {
          void signInWithEmailPassword('photographer@example.com', 'secret12');
        }}
      >
        <Text>sign-in</Text>
      </Pressable>
      <Pressable
        testID="auth-sign-out"
        onPress={() => {
          void signOut();
        }}
      >
        <Text>sign-out</Text>
      </Pressable>
    </>
  );
}

describe('auth state store (T6.7)', () => {
  it('starts signed out when the mock has no user', async () => {
    const authClient = createMockAuthClient({ initialUser: null });
    const view = await renderWithProviders(<AuthProbe />, { authClient });

    await waitFor(() => {
      expect(view.getByTestId('auth-ready').props.children).toBe('ready');
      expect(view.getByTestId('auth-status').props.children).toBe('signed_out');
    });
    expect(view.getByTestId('auth-email').props.children).toBe('none');
    expect(view.getByTestId('auth-configured').props.children).toBe('yes');
  });

  it('reflects an already signed-in user', async () => {
    const authClient = createMockAuthClient({
      initialUser: { uid: 'u1', email: 'already@example.com', displayName: 'Ada' },
    });
    const view = await renderWithProviders(<AuthProbe />, { authClient });

    await waitFor(() => {
      expect(view.getByTestId('auth-status').props.children).toBe('signed_in');
      expect(view.getByTestId('auth-email').props.children).toBe('already@example.com');
    });
  });

  it('updates on sign-in and sign-out', async () => {
    const authClient = createMockAuthClient({ initialUser: null, idToken: 'tok-abc' });
    const view = await renderWithProviders(<AuthProbe />, { authClient });

    await waitFor(() => {
      expect(view.getByTestId('auth-status').props.children).toBe('signed_out');
    });

    await act(async () => {
      fireEvent.press(view.getByTestId('auth-sign-in'));
    });

    await waitFor(() => {
      expect(view.getByTestId('auth-status').props.children).toBe('signed_in');
      expect(view.getByTestId('auth-email').props.children).toBe('photographer@example.com');
    });
    await expect(authClient.getIdToken()).resolves.toBe('tok-abc');

    await act(async () => {
      fireEvent.press(view.getByTestId('auth-sign-out'));
    });

    await waitFor(() => {
      expect(view.getByTestId('auth-status').props.children).toBe('signed_out');
      expect(view.getByTestId('auth-email').props.children).toBe('none');
    });
    await expect(authClient.getIdToken()).resolves.toBeUndefined();
  });

  it('reports unavailable when Firebase is not configured', async () => {
    const authClient = createMockAuthClient({ configured: false });
    const view = await renderWithProviders(<AuthProbe />, { authClient });

    await waitFor(() => {
      expect(view.getByTestId('auth-status').props.children).toBe('unavailable');
      expect(view.getByTestId('auth-configured').props.children).toBe('no');
    });
  });
});

'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { createApiClient, type ApiClient } from '@wildwindow/shared/client';

import { getDefaultAuthClient, unavailableAuthClient } from '@/lib/auth/firebase-auth-client';
import type { AuthClient, AuthUser } from '@/lib/auth/types';
import { tryGetApiBaseUrl } from '@/lib/api';

export type AdminAccess = 'loading' | 'signed_out' | 'forbidden' | 'admin' | 'unavailable';

type AuthContextValue = {
  readonly authConfigured: boolean;
  readonly user: AuthUser | null;
  readonly authReady: boolean;
  readonly adminAccess: AdminAccess;
  readonly apiClient: ApiClient | null;
  readonly signInWithEmailPassword: (email: string, password: string) => Promise<void>;
  readonly signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export type AuthProviderProps = {
  readonly children: ReactNode;
  /** Injectable for tests. Defaults to Firebase (or unavailable stub). */
  readonly authClient?: AuthClient;
  /** Injectable API base URL for tests. */
  readonly apiBaseUrl?: string | null;
};

export function AuthProvider({ children, authClient, apiBaseUrl }: AuthProviderProps) {
  const client = useMemo(
    () => authClient ?? getDefaultAuthClient() ?? unavailableAuthClient(),
    [authClient],
  );

  const resolvedBaseUrl = useMemo(() => {
    if (apiBaseUrl !== undefined) {
      return apiBaseUrl;
    }
    return tryGetApiBaseUrl();
  }, [apiBaseUrl]);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [adminAccess, setAdminAccess] = useState<AdminAccess>('loading');

  const apiClient = useMemo(() => {
    if (resolvedBaseUrl === null) {
      return null;
    }
    return createApiClient({
      baseUrl: resolvedBaseUrl,
      getToken: () => client.getIdToken(),
    });
  }, [client, resolvedBaseUrl]);

  useEffect(() => {
    const unsubscribe = client.subscribe((next) => {
      setUser(next);
      setAuthReady(true);
    });
    return unsubscribe;
  }, [client]);

  useEffect(() => {
    if (!authReady) {
      setAdminAccess('loading');
      return;
    }

    if (!client.configured || resolvedBaseUrl === null || apiClient === null) {
      setAdminAccess('unavailable');
      return;
    }

    if (user === null) {
      setAdminAccess('signed_out');
      return;
    }

    let cancelled = false;
    setAdminAccess('loading');

    void (async () => {
      try {
        await apiClient.admin.session();
        if (!cancelled) {
          setAdminAccess('admin');
        }
      } catch {
        if (!cancelled) {
          setAdminAccess('forbidden');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, user, client.configured, resolvedBaseUrl, apiClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      authConfigured: client.configured,
      user,
      authReady,
      adminAccess,
      apiClient,
      async signInWithEmailPassword(email, password) {
        await client.signInWithEmailPassword(email, password);
      },
      async signOut() {
        await client.signOut();
      },
    }),
    [client, user, authReady, adminAccess, apiClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

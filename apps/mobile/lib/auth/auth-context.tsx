import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { getDefaultAuthClient, unavailableAuthClient } from '@/lib/auth/firebase-auth-client';
import {
  AuthClientError,
  type AuthClient,
  type AuthErrorCode,
  type AuthState,
  type AuthStatus,
  type AuthUser,
} from '@/lib/auth/types';

export type AuthContextValue = AuthState & {
  readonly configured: boolean;
  readonly ready: boolean;
  readonly getIdToken: () => Promise<string | undefined>;
  readonly signInWithEmailPassword: (email: string, password: string) => Promise<void>;
  readonly createAccountWithEmailPassword: (email: string, password: string) => Promise<void>;
  readonly signOut: () => Promise<void>;
  /** Apple / Google need an EAS development build (ARCHITECTURE §8). */
  readonly socialProvidersAvailable: false;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export type AuthProviderProps = {
  readonly children: ReactNode;
  /** Injected client for tests. */
  readonly client?: AuthClient;
};

function resolveClient(override: AuthClient | undefined): AuthClient {
  if (override !== undefined) {
    return override;
  }
  return getDefaultAuthClient() ?? unavailableAuthClient();
}

export function AuthProvider({ children, client: clientOverride }: AuthProviderProps) {
  const client = useMemo(() => resolveClient(clientOverride), [clientOverride]);
  const [status, setStatus] = useState<AuthStatus>(client.configured ? 'loading' : 'unavailable');
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!client.configured) {
      setStatus('unavailable');
      setUser(null);
      return;
    }

    setStatus('loading');
    const unsubscribe = client.subscribe((next) => {
      // Defer so the mount commit finishes before auth state lands (avoids
      // overlapping act() with form input updates in jest-expo).
      queueMicrotask(() => {
        if (cancelled) return;
        setUser(next);
        setStatus(next === null ? 'signed_out' : 'signed_in');
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [client]);

  const getIdToken = useCallback(async () => client.getIdToken(), [client]);

  const signInWithEmailPassword = useCallback(
    async (email: string, password: string) => {
      await client.signInWithEmailPassword(email, password);
    },
    [client],
  );

  const createAccountWithEmailPassword = useCallback(
    async (email: string, password: string) => {
      await client.createAccountWithEmailPassword(email, password);
    },
    [client],
  );

  const signOut = useCallback(async () => {
    await client.signOut();
  }, [client]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      configured: client.configured,
      ready: status !== 'loading',
      getIdToken,
      signInWithEmailPassword,
      createAccountWithEmailPassword,
      signOut,
      socialProvidersAvailable: false,
    }),
    [
      status,
      user,
      client.configured,
      getIdToken,
      signInWithEmailPassword,
      createAccountWithEmailPassword,
      signOut,
    ],
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

export function authErrorCode(error: unknown): AuthErrorCode {
  if (error instanceof AuthClientError) {
    return error.code;
  }
  return 'unknown';
}

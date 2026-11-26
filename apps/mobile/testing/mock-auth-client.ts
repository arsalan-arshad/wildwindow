import { AuthClientError, type AuthClient, type AuthUser } from '@/lib/auth/types';

export type MockAuthClientOptions = {
  readonly initialUser?: AuthUser | null;
  readonly configured?: boolean;
  /** Fixed id token returned by getIdToken when signed in. */
  readonly idToken?: string;
};

/**
 * In-memory AuthClient for jest-expo tests (no Firebase network).
 */
export function createMockAuthClient(options: MockAuthClientOptions = {}): AuthClient & {
  readonly __setUser: (user: AuthUser | null) => void;
  readonly __listeners: Set<(user: AuthUser | null) => void>;
} {
  const configured = options.configured ?? true;
  let current: AuthUser | null = options.initialUser ?? null;
  const listeners = new Set<(user: AuthUser | null) => void>();
  const idToken = options.idToken ?? 'mock-id-token';

  function emit() {
    for (const listener of listeners) {
      listener(current);
    }
  }

  return {
    configured,
    __listeners: listeners,
    __setUser(user) {
      current = user;
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      // Defer the initial emission so React can finish mounting (jest-expo).
      queueMicrotask(() => {
        if (listeners.has(listener)) {
          listener(current);
        }
      });
      return () => {
        listeners.delete(listener);
      };
    },
    async getIdToken() {
      if (!configured || current === null) {
        return undefined;
      }
      return idToken;
    },
    async signInWithEmailPassword(email, password) {
      if (!configured) {
        throw new AuthClientError('not_configured');
      }
      if (email.trim() === '' || password.length < 6) {
        throw new AuthClientError('wrong_credentials');
      }
      if (email.trim() === 'bad@example.com') {
        throw new AuthClientError('wrong_credentials');
      }
      current = { uid: 'mock-uid', email: email.trim(), displayName: null };
      emit();
      return current;
    },
    async createAccountWithEmailPassword(email, password) {
      if (!configured) {
        throw new AuthClientError('not_configured');
      }
      if (password.length < 6) {
        throw new AuthClientError('weak_password');
      }
      if (email.trim() === 'taken@example.com') {
        throw new AuthClientError('email_in_use');
      }
      current = { uid: 'mock-uid-new', email: email.trim(), displayName: null };
      emit();
      return current;
    },
    async signOut() {
      current = null;
      emit();
    },
  };
}

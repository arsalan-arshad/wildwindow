import type { AuthClient, AuthUser } from '@/lib/auth/types';

export function createMockAuthClient(options?: {
  readonly configured?: boolean;
  readonly initialUser?: AuthUser | null;
}): AuthClient {
  const configured = options?.configured ?? true;
  let current: AuthUser | null = options?.initialUser ?? null;
  const listeners = new Set<(user: AuthUser | null) => void>();

  return {
    configured,
    subscribe(listener) {
      listeners.add(listener);
      listener(current);
      return () => {
        listeners.delete(listener);
      };
    },
    async getIdToken() {
      return current === null ? undefined : 'mock-id-token';
    },
    async signInWithEmailPassword(email) {
      current = { uid: 'uid-1', email, displayName: null };
      for (const listener of listeners) {
        listener(current);
      }
      return current;
    },
    async signOut() {
      current = null;
      for (const listener of listeners) {
        listener(null);
      }
    },
  };
}

export const MOCK_ADMIN_USER: AuthUser = {
  uid: 'admin-uid',
  email: 'admin@example.com',
  displayName: 'Admin',
};

export const MOCK_USER: AuthUser = {
  uid: 'user-uid',
  email: 'user@example.com',
  displayName: null,
};

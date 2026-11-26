/**
 * Auth types for S-02 (T6.7). Firebase is identity-only; tokens go to Nest as Bearer.
 */

export type AuthUser = {
  readonly uid: string;
  readonly email: string | null;
  readonly displayName: string | null;
};

export type AuthStatus = 'loading' | 'signed_out' | 'signed_in' | 'unavailable';

/** Stable error codes shown in the UI (never raw Firebase messages with PII). */
export type AuthErrorCode =
  | 'not_configured'
  | 'invalid_email'
  | 'weak_password'
  | 'wrong_credentials'
  | 'email_in_use'
  | 'too_many_requests'
  | 'network'
  | 'provider_unavailable'
  | 'unknown';

export class AuthClientError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'AuthClientError';
    this.code = code;
  }
}

/**
 * Injectable auth surface so tests never touch the real Firebase SDK.
 * Production wraps Firebase JS Auth (email/password); Apple/Google need EAS.
 */
export type AuthClient = {
  readonly configured: boolean;
  subscribe: (listener: (user: AuthUser | null) => void) => () => void;
  getIdToken: () => Promise<string | undefined>;
  signInWithEmailPassword: (email: string, password: string) => Promise<AuthUser>;
  createAccountWithEmailPassword: (email: string, password: string) => Promise<AuthUser>;
  signOut: () => Promise<void>;
};

export type AuthState = {
  readonly status: AuthStatus;
  readonly user: AuthUser | null;
};

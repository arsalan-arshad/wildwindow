export type AuthUser = {
  readonly uid: string;
  readonly email: string | null;
  readonly displayName: string | null;
};

export type AuthErrorCode =
  | 'invalid_email'
  | 'weak_password'
  | 'wrong_credentials'
  | 'email_in_use'
  | 'too_many_requests'
  | 'network'
  | 'not_configured'
  | 'unknown';

export class AuthClientError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'AuthClientError';
    this.code = code;
  }
}

export type AuthClient = {
  readonly configured: boolean;
  subscribe: (listener: (user: AuthUser | null) => void) => () => void;
  getIdToken: () => Promise<string | undefined>;
  signInWithEmailPassword: (email: string, password: string) => Promise<AuthUser>;
  signOut: () => Promise<void>;
};

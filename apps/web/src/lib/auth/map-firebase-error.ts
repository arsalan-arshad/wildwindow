import { AuthClientError, type AuthErrorCode } from '@/lib/auth/types';

function readFirebaseCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  if (!('code' in error)) {
    return undefined;
  }
  const code = error.code;
  return typeof code === 'string' ? code : undefined;
}

/** Map Firebase Auth error codes to stable UI codes (no PII in messages). */
export function mapFirebaseAuthError(error: unknown): AuthClientError {
  if (error instanceof AuthClientError) {
    return error;
  }

  const firebaseCode = readFirebaseCode(error);
  let code: AuthErrorCode = 'unknown';

  switch (firebaseCode) {
    case 'auth/invalid-email':
    case 'auth/missing-email':
      code = 'invalid_email';
      break;
    case 'auth/weak-password':
      code = 'weak_password';
      break;
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      code = 'wrong_credentials';
      break;
    case 'auth/email-already-in-use':
      code = 'email_in_use';
      break;
    case 'auth/too-many-requests':
      code = 'too_many_requests';
      break;
    case 'auth/network-request-failed':
      code = 'network';
      break;
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      code = 'not_configured';
      break;
    default:
      code = 'unknown';
  }

  return new AuthClientError(code);
}

export function authErrorMessage(code: AuthErrorCode): string {
  switch (code) {
    case 'invalid_email':
      return 'Enter a valid email address.';
    case 'wrong_credentials':
      return 'Email or password is incorrect.';
    case 'too_many_requests':
      return 'Too many attempts. Try again later.';
    case 'network':
      return 'Network error. Check your connection.';
    case 'not_configured':
      return 'Firebase sign-in is not configured for this build.';
    case 'weak_password':
      return 'Password is too weak.';
    case 'email_in_use':
      return 'That email is already in use.';
    case 'unknown':
      return 'Sign-in failed. Try again.';
  }
}

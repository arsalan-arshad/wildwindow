import { mapFirebaseAuthError } from '@/lib/auth/map-firebase-error';
import { AuthClientError } from '@/lib/auth/types';

describe('mapFirebaseAuthError', () => {
  it('passes through AuthClientError', () => {
    const err = new AuthClientError('network');
    expect(mapFirebaseAuthError(err)).toBe(err);
  });

  it.each([
    ['auth/invalid-email', 'invalid_email'],
    ['auth/weak-password', 'weak_password'],
    ['auth/wrong-password', 'wrong_credentials'],
    ['auth/user-not-found', 'wrong_credentials'],
    ['auth/invalid-credential', 'wrong_credentials'],
    ['auth/email-already-in-use', 'email_in_use'],
    ['auth/too-many-requests', 'too_many_requests'],
    ['auth/network-request-failed', 'network'],
    ['auth/operation-not-allowed', 'not_configured'],
    ['auth/something-else', 'unknown'],
  ] as const)('maps %s → %s', (firebaseCode, expected) => {
    expect(mapFirebaseAuthError({ code: firebaseCode }).code).toBe(expected);
  });

  it('maps unknown shapes to unknown', () => {
    expect(mapFirebaseAuthError('boom').code).toBe('unknown');
    expect(mapFirebaseAuthError(null).code).toBe('unknown');
  });
});

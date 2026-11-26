/**
 * Decoded Firebase ID token claims we care about (T5.8).
 * Kept narrow so tests can mock without firebase-admin types.
 */
export type VerifiedIdToken = {
  readonly uid: string;
  readonly email?: string | undefined;
  readonly name?: string | undefined;
};

/** Injectable token verifier — real firebase-admin or a test mock. */
export interface FirebaseTokenVerifier {
  verifyIdToken(idToken: string): Promise<VerifiedIdToken>;
}

/** Nest DI token for {@link FirebaseTokenVerifier}. */
export const FIREBASE_TOKEN_VERIFIER = Symbol('WW_FIREBASE_TOKEN_VERIFIER');

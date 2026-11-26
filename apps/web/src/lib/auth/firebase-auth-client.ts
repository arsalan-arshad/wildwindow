import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type Auth,
  type User,
} from 'firebase/auth';

import { readFirebaseWebConfig } from '@/lib/auth/firebase-config';
import { mapFirebaseAuthError } from '@/lib/auth/map-firebase-error';
import { AuthClientError, type AuthClient, type AuthUser } from '@/lib/auth/types';

function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
  };
}

function getOrInitApp(): FirebaseApp | null {
  const config = readFirebaseWebConfig();
  if (config === null) {
    return null;
  }

  const existing = getApps()[0];
  if (existing !== undefined) {
    return existing;
  }

  return initializeApp({
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    appId: config.appId,
    ...(config.storageBucket !== undefined ? { storageBucket: config.storageBucket } : {}),
    ...(config.messagingSenderId !== undefined
      ? { messagingSenderId: config.messagingSenderId }
      : {}),
    ...(config.measurementId !== undefined ? { measurementId: config.measurementId } : {}),
  });
}

let cachedClient: AuthClient | null | undefined;

/**
 * Firebase JS Auth client (email/password) for the admin console.
 * Returns null when `NEXT_PUBLIC_FIREBASE_CONFIG` is missing or invalid.
 */
export function createFirebaseAuthClient(): AuthClient | null {
  const app = getOrInitApp();
  if (app === null) {
    return null;
  }

  const auth: Auth = getAuth(app);

  const client: AuthClient = {
    configured: true,

    subscribe(listener) {
      return onAuthStateChanged(auth, (user) => {
        listener(user === null ? null : toAuthUser(user));
      });
    },

    async getIdToken() {
      const user = auth.currentUser;
      if (user === null) {
        return undefined;
      }
      try {
        return await user.getIdToken();
      } catch (error: unknown) {
        throw mapFirebaseAuthError(error);
      }
    },

    async signInWithEmailPassword(email, password) {
      try {
        const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
        return toAuthUser(credential.user);
      } catch (error: unknown) {
        throw mapFirebaseAuthError(error);
      }
    },

    async signOut() {
      try {
        await firebaseSignOut(auth);
      } catch (error: unknown) {
        throw mapFirebaseAuthError(error);
      }
    },
  };

  return client;
}

/** Singleton for the app; tests inject their own via AuthProvider. */
export function getDefaultAuthClient(): AuthClient | null {
  if (cachedClient !== undefined) {
    return cachedClient;
  }
  cachedClient = createFirebaseAuthClient();
  return cachedClient;
}

/** Test helper to clear the singleton between suites. */
export function resetDefaultAuthClientForTests(): void {
  cachedClient = undefined;
}

export function unavailableAuthClient(): AuthClient {
  return {
    configured: false,
    subscribe(listener) {
      listener(null);
      return () => undefined;
    },
    async getIdToken() {
      return undefined;
    },
    async signInWithEmailPassword() {
      throw new AuthClientError('not_configured');
    },
    async signOut() {
      return;
    },
  };
}

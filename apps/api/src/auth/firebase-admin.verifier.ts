import { Inject, Injectable } from '@nestjs/common';
import { cert, getApps, initializeApp, type App, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

import { API_ENV, type ApiEnv } from '../config/api-env.js';
import { serviceUnavailable } from '../http/api-error.js';

import type { FirebaseTokenVerifier, VerifiedIdToken } from './token-verifier.js';

function isServiceAccount(
  value: Record<string, unknown>,
): value is ServiceAccount & Record<string, unknown> {
  return typeof value['project_id'] === 'string' || typeof value['client_email'] === 'string';
}

/**
 * firebase-admin backed verifier (ARCHITECTURE §8).
 * Lazy-inits the Admin SDK from env; throws SERVICE_UNAVAILABLE when unset.
 */
@Injectable()
export class FirebaseAdminTokenVerifier implements FirebaseTokenVerifier {
  private app: App | null = null;

  constructor(@Inject(API_ENV) private readonly env: ApiEnv) {}

  async verifyIdToken(idToken: string): Promise<VerifiedIdToken> {
    const auth = getAuth(this.ensureApp());
    const decoded = await auth.verifyIdToken(idToken);
    const email = typeof decoded.email === 'string' ? decoded.email : undefined;
    const name = typeof decoded.name === 'string' ? decoded.name : undefined;
    return {
      uid: decoded.uid,
      ...(email !== undefined ? { email } : {}),
      ...(name !== undefined ? { name } : {}),
    };
  }

  private ensureApp(): App {
    if (this.app !== null) {
      return this.app;
    }

    const existing = getApps()[0];
    if (existing !== undefined) {
      this.app = existing;
      return existing;
    }

    const projectId = this.env.FIREBASE_PROJECT_ID;
    const saJson = this.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (projectId === undefined || saJson === undefined) {
      throw serviceUnavailable(
        'Firebase Auth is not configured (set FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT_JSON)',
      );
    }

    let credentials: ServiceAccount;
    try {
      const parsed: unknown = JSON.parse(saJson);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('service account JSON must be an object');
      }
      const record = parsed as Record<string, unknown>;
      if (!isServiceAccount(record)) {
        throw new Error('service account JSON missing project_id / client_email');
      }
      credentials = record;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'invalid JSON';
      throw serviceUnavailable(`FIREBASE_SERVICE_ACCOUNT_JSON is invalid: ${message}`);
    }

    this.app = initializeApp({
      credential: cert(credentials),
      projectId,
    });
    return this.app;
  }
}

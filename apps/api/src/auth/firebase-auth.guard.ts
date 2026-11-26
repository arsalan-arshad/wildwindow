import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';

import { type RequestWithOptionalUser } from '../geoprivacy/owner-location.js';
import { unauthorizedError } from '../http/api-error.js';

import { extractBearerToken } from './bearer.js';
import { FIREBASE_TOKEN_VERIFIER, type FirebaseTokenVerifier } from './token-verifier.js';
import { UsersService } from './users.service.js';

function isHttpExceptionLike(err: unknown): err is { getStatus: () => number } {
  if (typeof err !== 'object' || err === null || !('getStatus' in err)) {
    return false;
  }
  return typeof err.getStatus === 'function';
}

/**
 * Verifies `Authorization: Bearer <idToken>`, upserts `app.users`, sets `req.user`.
 * ARCHITECTURE §8 / T5.8.
 */
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    @Inject(FIREBASE_TOKEN_VERIFIER) private readonly verifier: FirebaseTokenVerifier,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<
        RequestWithOptionalUser & { headers: Record<string, string | string[] | undefined> }
      >();
    const authorization = headerString(req.headers['authorization']);
    const token = extractBearerToken(authorization);
    if (token === undefined) {
      throw unauthorizedError();
    }

    let verified;
    try {
      verified = await this.verifier.verifyIdToken(token);
    } catch (err: unknown) {
      // Re-throw Nest/ApiHttpException (e.g. SERVICE_UNAVAILABLE from unconfigured admin).
      if (isHttpExceptionLike(err)) {
        throw err;
      }
      throw unauthorizedError('Invalid or expired token');
    }

    if (verified.uid.length === 0) {
      throw unauthorizedError('Invalid or expired token');
    }

    const user = await this.users.upsertFromToken(verified);
    req.user = user;
    return true;
  }
}

function headerString(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
}

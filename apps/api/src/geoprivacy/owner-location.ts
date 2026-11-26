import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for routes that may return owner-only exact location
 * (`allowOwnerLocation` in `assertPublicSafe`). T5.3 / ARCHITECTURE §5.3.
 */
export const OWNER_LOCATION_KEY = 'wildwindow:ownerLocation' as const;

/**
 * Opt a handler (or controller) out of the public forbidden-key check
 * when the authenticated owner is present on the request.
 *
 * Pair with an auth guard (T5.8 `FirebaseAuthGuard`) so only the owner
 * reaches the handler. Without `request.user`, the global interceptor
 * still rejects coordinate keys.
 */
export const OwnerLocation = (): MethodDecorator & ClassDecorator =>
  SetMetadata(OWNER_LOCATION_KEY, true);

/**
 * Authenticated user on the request (T5.8 FirebaseAuthGuard).
 * `id` is required for `@OwnerLocation()`; other fields are set by the auth guard.
 */
export type RequestUser = {
  readonly id: string;
  readonly firebaseUid?: string;
  readonly role?: 'user' | 'admin';
  readonly email?: string | null;
  readonly displayName?: string | null;
  readonly homeRegionId?: number | null;
  readonly locale?: string;
};

export type RequestWithOptionalUser = {
  user?: RequestUser | undefined;
};

/**
 * True when the request has an authenticated user with a non-empty id.
 * Used by `PublicGeoInterceptor` together with `@OwnerLocation()`.
 */
export function hasAuthenticatedOwner(req: RequestWithOptionalUser): boolean {
  const user = req.user;
  return typeof user?.id === 'string' && user.id.length > 0;
}

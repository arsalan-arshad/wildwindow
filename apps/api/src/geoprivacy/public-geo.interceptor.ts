import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { assertPublicSafe, GeoPrivacyViolation, TIER_POLICY } from '@wildwindow/geoprivacy';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Observable, map } from 'rxjs';

import { ApiHttpException } from '../http/api-error.js';

import {
  OWNER_LOCATION_KEY,
  hasAuthenticatedOwner,
  type RequestWithOptionalUser,
} from './owner-location.js';

/**
 * Global response guard (T5.3 / ARCHITECTURE §5.3): every JSON body must
 * pass `assertPublicSafe`. `@OwnerLocation()` + authenticated owner sets
 * `allowOwnerLocation` so logbook-style routes may return exact coords.
 *
 * Ceiling for H3 strings is the open-tier resolution (res-7): nothing public
 * may be finer. Per-endpoint tier checks remain elsewhere.
 */
@Injectable()
export class PublicGeoInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @InjectPinoLogger(PublicGeoInterceptor.name)
    private readonly logger: PinoLogger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ownerLocationAllowed = this.reflector.getAllAndOverride<boolean>(OWNER_LOCATION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const req = context.switchToHttp().getRequest<RequestWithOptionalUser>();
    const allowOwnerLocation = ownerLocationAllowed && hasAuthenticatedOwner(req);

    return next.handle().pipe(
      map((data: unknown) => {
        try {
          assertPublicSafe(data, {
            maxResolutionByTier: { open: TIER_POLICY.open.resolution },
            allowOwnerLocation,
          });
        } catch (err) {
          if (err instanceof GeoPrivacyViolation) {
            this.logger.error(
              { err: { name: err.name, message: err.message } },
              'GeoPrivacyViolation',
            );
            throw new ApiHttpException(HttpStatus.INTERNAL_SERVER_ERROR, {
              code: 'INTERNAL_ERROR',
              message: 'Internal server error',
            });
          }
          throw err;
        }
        return data;
      }),
    );
  }
}

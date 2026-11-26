import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { type RequestWithOptionalUser } from '../geoprivacy/owner-location.js';
import { forbiddenError, unauthorizedError } from '../http/api-error.js';

/**
 * Requires `req.user.role === 'admin'` from the database (not Firebase claims).
 * Pair with {@link FirebaseAuthGuard}. ARCHITECTURE §8 / T5.8.
 */
@Injectable()
export class AdminRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithOptionalUser>();
    const user = req.user;
    if (user === undefined) {
      throw unauthorizedError();
    }
    if (user.role !== 'admin') {
      throw forbiddenError('Admin role required');
    }
    return true;
  }
}

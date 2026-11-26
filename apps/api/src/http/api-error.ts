import { HttpException, HttpStatus } from '@nestjs/common';

export type ApiErrorBody = {
  readonly code: string;
  readonly message: string;
};

export class ApiHttpException extends HttpException {
  constructor(status: HttpStatus, body: ApiErrorBody) {
    super(body, status);
  }
}

export function validationError(message: string): ApiHttpException {
  return new ApiHttpException(HttpStatus.BAD_REQUEST, {
    code: 'VALIDATION_ERROR',
    message,
  });
}

export function notFoundError(message = 'Not found'): ApiHttpException {
  return new ApiHttpException(HttpStatus.NOT_FOUND, {
    code: 'NOT_FOUND',
    message,
  });
}

export function unauthorizedError(message = 'Unauthorized'): ApiHttpException {
  return new ApiHttpException(HttpStatus.UNAUTHORIZED, {
    code: 'UNAUTHORIZED',
    message,
  });
}

export function forbiddenError(message = 'Forbidden'): ApiHttpException {
  return new ApiHttpException(HttpStatus.FORBIDDEN, {
    code: 'FORBIDDEN',
    message,
  });
}

export function serviceUnavailable(message: string): ApiHttpException {
  return new ApiHttpException(HttpStatus.SERVICE_UNAVAILABLE, {
    code: 'SERVICE_UNAVAILABLE',
    message,
  });
}

/** Free watchlist capacity reached (ARCHITECTURE §7 / T5.9). */
export function watchlistLimitError(limit: number): ApiHttpException {
  return new ApiHttpException(HttpStatus.CONFLICT, {
    code: 'WATCHLIST_LIMIT',
    message: `Watchlist limit of ${String(limit)} reached`,
  });
}

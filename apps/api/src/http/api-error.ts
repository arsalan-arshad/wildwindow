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

export function unauthorizedError(message = 'Unauthorized'): ApiHttpException {
  return new ApiHttpException(HttpStatus.UNAUTHORIZED, {
    code: 'UNAUTHORIZED',
    message,
  });
}

export function serviceUnavailable(message: string): ApiHttpException {
  return new ApiHttpException(HttpStatus.SERVICE_UNAVAILABLE, {
    code: 'SERVICE_UNAVAILABLE',
    message,
  });
}

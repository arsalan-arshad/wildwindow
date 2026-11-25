import { Catch, type ExceptionFilter, type ArgumentsHost, HttpStatus } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';

import type { Response } from 'express';

@Catch(ThrottlerException)
export class ThrottlerExceptionFilter implements ExceptionFilter {
  catch(_exception: ThrottlerException, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    res.status(HttpStatus.TOO_MANY_REQUESTS).json({
      code: 'WAITLIST_RATE_LIMIT',
      message: 'Too many requests. Please try again later.',
    });
  }
}

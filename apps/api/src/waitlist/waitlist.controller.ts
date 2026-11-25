import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  WaitlistSignupRequestSchema,
  type WaitlistSignupOk,
  type WaitlistSignupRequest,
} from '@wildwindow/shared';

import { validationError } from '../http/api-error.js';

import { WaitlistService } from './waitlist.service.js';

@Controller('v1/waitlist')
@UseGuards(ThrottlerGuard)
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post()
  @HttpCode(200)
  /** Tighter than the global public limit — handful of signups per IP per hour. */
  @Throttle({ default: { limit: 10, ttl: 60 * 60 * 1000 } })
  async join(@Body() body: unknown): Promise<WaitlistSignupOk> {
    const parsed = WaitlistSignupRequestSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join('; ');
      throw validationError(message.length > 0 ? message : 'Invalid waitlist payload');
    }
    const payload: WaitlistSignupRequest = parsed.data;
    return this.waitlistService.join(payload);
  }
}

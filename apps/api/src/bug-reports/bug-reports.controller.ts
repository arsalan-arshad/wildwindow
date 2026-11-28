import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  BugReportRequestSchema,
  type BugReportRequest,
  type BugReportResponse,
} from '@wildwindow/shared';

import { validationError } from '../http/api-error.js';

import { BugReportsService } from './bug-reports.service.js';

@Controller('v1/bug-reports')
@UseGuards(ThrottlerGuard)
export class BugReportsController {
  constructor(private readonly bugReportsService: BugReportsService) {}

  @Post()
  @HttpCode(200)
  /** Tighter than the global public limit — a handful of reports per IP per hour. */
  @Throttle({ default: { limit: 10, ttl: 60 * 60 * 1000 } })
  async create(@Body() body: unknown): Promise<BugReportResponse> {
    const parsed = BugReportRequestSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join('; ');
      throw validationError(message.length > 0 ? message : 'Invalid bug report payload');
    }
    const payload: BugReportRequest = parsed.data;
    return this.bugReportsService.submit(payload);
  }
}

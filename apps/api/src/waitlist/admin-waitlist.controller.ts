import { Controller, Get, Headers, Res } from '@nestjs/common';

import { loadApiEnv } from '../config/api-env.js';
import { unauthorizedError } from '../http/api-error.js';

import { WaitlistService, waitlistRowsToCsv } from './waitlist.service.js';

import type { Response } from 'express';

function extractAdminToken(
  authorization: string | undefined,
  adminTokenHeader: string | undefined,
): string | undefined {
  if (adminTokenHeader !== undefined && adminTokenHeader.trim().length > 0) {
    return adminTokenHeader.trim();
  }
  if (authorization === undefined) {
    return undefined;
  }
  // Linear-time parse (avoid `/^Bearer\s+/i` ReDoS on long space runs).
  const trimmed = authorization.trim();
  if (trimmed.length < 7 || trimmed.slice(0, 6).toLowerCase() !== 'bearer') {
    return undefined;
  }
  const afterBearer = trimmed.slice(6);
  if (afterBearer.length === 0 || (afterBearer[0] !== ' ' && afterBearer[0] !== '\t')) {
    return undefined;
  }
  const token = afterBearer.trimStart();
  return token.length > 0 ? token : undefined;
}

@Controller('v1/admin/waitlist')
export class AdminWaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Get('export')
  async exportCsv(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-admin-token') adminTokenHeader: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const env = loadApiEnv();
    const expected = env.ADMIN_TOKEN;
    const provided = extractAdminToken(authorization, adminTokenHeader);

    if (expected === undefined || expected.length === 0) {
      throw unauthorizedError('Admin export is not configured');
    }
    if (provided === undefined || provided !== expected) {
      throw unauthorizedError();
    }

    const rows = await this.waitlistService.listForExport();
    const csv = waitlistRowsToCsv(rows);
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', 'attachment; filename="waitlist.csv"');
    res.status(200).send(csv);
  }
}

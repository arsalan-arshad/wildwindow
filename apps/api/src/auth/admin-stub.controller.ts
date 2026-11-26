import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { type RequestWithOptionalUser } from '../geoprivacy/owner-location.js';

import { AdminRoleGuard } from './admin-role.guard.js';
import { FirebaseAuthGuard } from './firebase-auth.guard.js';

const AdminSessionSchema = z.object({
  ok: z.literal(true),
  role: z.literal('admin'),
  userId: z.string().uuid(),
});

class AdminSessionDto extends createZodDto(AdminSessionSchema) {}

/**
 * Minimal Firebase-admin-role surface for T5.8 acceptance (403 for non-admins).
 * Full admin APIs land in T5.13; waitlist CSV still uses ADMIN_TOKEN.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('v1/admin')
@UseGuards(FirebaseAuthGuard, AdminRoleGuard)
export class AdminStubController {
  @Get('session')
  @ApiOperation({ summary: 'Confirm the caller has the database admin role' })
  @ApiOkResponse({ type: AdminSessionDto })
  session(@Req() req: RequestWithOptionalUser): z.infer<typeof AdminSessionSchema> {
    const user = req.user;
    if (user === undefined) {
      // Guard should have rejected; keep the return type honest.
      throw new Error('AdminStubController: missing req.user');
    }
    return { ok: true, role: 'admin', userId: user.id };
  }
}

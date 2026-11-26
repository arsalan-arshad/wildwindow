import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  MeDeleteOkSchema,
  MeExportOkSchema,
  MePatchRequestSchema,
  MeProfileSchema,
  type MeDeleteOk,
  type MeExportOk,
  type MePatchRequest,
  type MeProfile,
} from '@wildwindow/shared';
import { createZodDto } from 'nestjs-zod';

import { FirebaseAuthGuard } from '../auth/firebase-auth.guard.js';
import { UsersService } from '../auth/users.service.js';
import { type RequestWithOptionalUser } from '../geoprivacy/owner-location.js';
import { unauthorizedError, validationError } from '../http/api-error.js';

import { AccountService } from './account.service.js';

class MeProfileDto extends createZodDto(MeProfileSchema) {}
class MeDeleteOkDto extends createZodDto(MeDeleteOkSchema) {}
class MeExportOkDto extends createZodDto(MeExportOkSchema) {}

@ApiTags('me')
@ApiBearerAuth()
@Controller('v1/me')
@UseGuards(FirebaseAuthGuard)
export class MeController {
  constructor(
    private readonly users: UsersService,
    private readonly account: AccountService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Current user profile' })
  @ApiOkResponse({ type: MeProfileDto })
  async get(@Req() req: RequestWithOptionalUser): Promise<MeProfile> {
    const userId = requireUserId(req);
    return this.users.getProfile(userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Update profile settings' })
  @ApiOkResponse({ type: MeProfileDto })
  async patch(@Req() req: RequestWithOptionalUser, @Body() body: unknown): Promise<MeProfile> {
    const userId = requireUserId(req);
    const parsed = MePatchRequestSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join('; ');
      throw validationError(message.length > 0 ? message : 'Invalid profile patch');
    }
    const payload: MePatchRequest = parsed.data;
    return this.users.patchProfile(userId, payload);
  }

  @Delete()
  @ApiOperation({ summary: 'Soft-delete account (hard purge after 30 days)' })
  @ApiOkResponse({ type: MeDeleteOkDto })
  async remove(@Req() req: RequestWithOptionalUser): Promise<MeDeleteOk> {
    const userId = requireUserId(req);
    return this.account.softDelete(userId);
  }

  @Post('export')
  @HttpCode(200)
  @ApiOperation({ summary: 'Export account data as JSON with signed photo links' })
  @ApiOkResponse({ type: MeExportOkDto })
  async export(@Req() req: RequestWithOptionalUser): Promise<MeExportOk> {
    const userId = requireUserId(req);
    return this.account.exportData(userId);
  }
}

function requireUserId(req: RequestWithOptionalUser): string {
  const id = req.user?.id;
  if (typeof id !== 'string' || id.length === 0) {
    throw unauthorizedError();
  }
  return id;
}

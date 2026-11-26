import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  LogbookCreateRequestSchema,
  LogbookEntryOwnerSchema,
  LogbookListResponseSchema,
  LogbookPatchRequestSchema,
  type LogbookCreateRequest,
  type LogbookEntryOwner,
  type LogbookListResponse,
  type LogbookPatchRequest,
} from '@wildwindow/shared';
import { createZodDto } from 'nestjs-zod';

import { FirebaseAuthGuard } from '../auth/firebase-auth.guard.js';
import { OwnerLocation, type RequestWithOptionalUser } from '../geoprivacy/owner-location.js';
import { unauthorizedError, validationError } from '../http/api-error.js';

import { LogbookService } from './logbook.service.js';

class LogbookListResponseDto extends createZodDto(LogbookListResponseSchema) {}
class LogbookEntryOwnerDto extends createZodDto(LogbookEntryOwnerSchema) {}

@ApiTags('me')
@ApiBearerAuth()
@Controller('v1/me/logbook')
@UseGuards(FirebaseAuthGuard)
@OwnerLocation()
export class LogbookController {
  constructor(private readonly logbook: LogbookService) {}

  @Get()
  @ApiOperation({ summary: 'List the current user’s logbook entries' })
  @ApiOkResponse({ type: LogbookListResponseDto })
  async list(@Req() req: RequestWithOptionalUser): Promise<LogbookListResponse> {
    return this.logbook.list(requireUserId(req));
  }

  @Post()
  @ApiOperation({ summary: 'Create a logbook entry (owner-only exact location)' })
  @ApiCreatedResponse({ type: LogbookEntryOwnerDto })
  async create(
    @Req() req: RequestWithOptionalUser,
    @Body() body: unknown,
  ): Promise<LogbookEntryOwner> {
    const parsed = LogbookCreateRequestSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join('; ');
      throw validationError(message.length > 0 ? message : 'Invalid logbook payload');
    }
    const payload: LogbookCreateRequest = parsed.data;
    return this.logbook.create(requireUserId(req), payload);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one logbook entry including decrypted exact point' })
  @ApiOkResponse({ type: LogbookEntryOwnerDto })
  async get(
    @Req() req: RequestWithOptionalUser,
    @Param('id') id: string,
  ): Promise<LogbookEntryOwner> {
    return this.logbook.get(requireUserId(req), id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a logbook entry' })
  @ApiOkResponse({ type: LogbookEntryOwnerDto })
  async patch(
    @Req() req: RequestWithOptionalUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<LogbookEntryOwner> {
    const parsed = LogbookPatchRequestSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join('; ');
      throw validationError(message.length > 0 ? message : 'Invalid logbook patch');
    }
    const payload: LogbookPatchRequest = parsed.data;
    return this.logbook.patch(requireUserId(req), id, payload);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a logbook entry and its photos' })
  @ApiNoContentResponse()
  async remove(@Req() req: RequestWithOptionalUser, @Param('id') id: string): Promise<void> {
    await this.logbook.remove(requireUserId(req), id);
  }
}

function requireUserId(req: RequestWithOptionalUser): string {
  const id = req.user?.id;
  if (typeof id !== 'string' || id.length === 0) {
    throw unauthorizedError();
  }
  return id;
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
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
  WatchlistCreateRequestSchema,
  WatchlistItemSchema,
  WatchlistResponseSchema,
  type WatchlistCreateRequest,
  type WatchlistItem,
  type WatchlistResponse,
} from '@wildwindow/shared';
import { createZodDto } from 'nestjs-zod';

import { FirebaseAuthGuard } from '../auth/firebase-auth.guard.js';
import { type RequestWithOptionalUser } from '../geoprivacy/owner-location.js';
import { unauthorizedError, validationError } from '../http/api-error.js';

import { WatchlistService } from './watchlist.service.js';

class WatchlistResponseDto extends createZodDto(WatchlistResponseSchema) {}
class WatchlistItemDto extends createZodDto(WatchlistItemSchema) {}

@ApiTags('me')
@ApiBearerAuth()
@Controller('v1/me/watchlist')
@UseGuards(FirebaseAuthGuard)
export class WatchlistController {
  constructor(private readonly watchlist: WatchlistService) {}

  @Get()
  @ApiOperation({ summary: 'List the current user’s watchlist' })
  @ApiOkResponse({ type: WatchlistResponseDto })
  async list(@Req() req: RequestWithOptionalUser): Promise<WatchlistResponse> {
    return this.watchlist.list(requireUserId(req));
  }

  @Post()
  @ApiOperation({ summary: 'Add a species+area pair to the watchlist' })
  @ApiCreatedResponse({ type: WatchlistItemDto })
  async add(@Req() req: RequestWithOptionalUser, @Body() body: unknown): Promise<WatchlistItem> {
    const parsed = WatchlistCreateRequestSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join('; ');
      throw validationError(message.length > 0 ? message : 'Invalid watchlist payload');
    }
    const payload: WatchlistCreateRequest = parsed.data;
    return this.watchlist.add(requireUserId(req), payload);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a watchlist item' })
  @ApiNoContentResponse()
  async remove(@Req() req: RequestWithOptionalUser, @Param('id') id: string): Promise<void> {
    await this.watchlist.remove(requireUserId(req), id);
  }
}

function requireUserId(req: RequestWithOptionalUser): string {
  const id = req.user?.id;
  if (typeof id !== 'string' || id.length === 0) {
    throw unauthorizedError();
  }
  return id;
}

import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  ChallengeEntriesQuerySchema,
  ChallengeEntriesResponseSchema,
  ChallengeResponseSchema,
  ChallengeSubmitOkSchema,
  ChallengeSubmitRequestSchema,
  type ChallengeEntriesQuery,
  type ChallengeEntriesResponse,
  type ChallengeResponse,
  type ChallengeSubmitOk,
  type ChallengeSubmitRequest,
} from '@wildwindow/shared';
import { createZodDto } from 'nestjs-zod';

import { FirebaseAuthGuard } from '../auth/firebase-auth.guard.js';
import { type RequestWithOptionalUser } from '../geoprivacy/owner-location.js';
import { unauthorizedError, validationError } from '../http/api-error.js';

import { ChallengesService } from './challenges.service.js';

class ChallengeResponseDto extends createZodDto(ChallengeResponseSchema) {}
class ChallengeEntriesResponseDto extends createZodDto(ChallengeEntriesResponseSchema) {}
class ChallengeSubmitOkDto extends createZodDto(ChallengeSubmitOkSchema) {}

@ApiTags('challenges')
@Controller('v1/challenges')
export class ChallengesController {
  constructor(private readonly challenges: ChallengesService) {}

  @Get('current')
  @ApiOperation({ summary: 'Current live challenge with per-country public entry counts' })
  @ApiOkResponse({ type: ChallengeResponseDto })
  async current(): Promise<ChallengeResponse> {
    return this.challenges.current();
  }

  @Get(':slug/entries')
  @ApiOperation({
    summary: 'Approved challenge entries past the 7-day publish delay (country + region only)',
  })
  @ApiOkResponse({ type: ChallengeEntriesResponseDto })
  async entries(
    @Param('slug') slug: string,
    @Query() query: unknown,
  ): Promise<ChallengeEntriesResponse> {
    const parsed = ChallengeEntriesQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join('; ');
      throw validationError(message.length > 0 ? message : 'Invalid entries query');
    }
    const payload: ChallengeEntriesQuery = parsed.data;
    return this.challenges.listEntries(slug, payload);
  }

  @Post(':slug/entries')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a logbook photo to the challenge (ethics pledge required)' })
  @ApiCreatedResponse({ type: ChallengeSubmitOkDto })
  async submit(
    @Param('slug') slug: string,
    @Req() req: RequestWithOptionalUser,
    @Body() body: unknown,
  ): Promise<ChallengeSubmitOk> {
    const parsed = ChallengeSubmitRequestSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join('; ');
      throw validationError(message.length > 0 ? message : 'Invalid challenge entry payload');
    }
    const payload: ChallengeSubmitRequest = parsed.data;
    return this.challenges.submit(slug, requireUserId(req), payload);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Challenge details and public per-country entry counts' })
  @ApiOkResponse({ type: ChallengeResponseDto })
  async bySlug(@Param('slug') slug: string): Promise<ChallengeResponse> {
    return this.challenges.getBySlug(slug);
  }
}

function requireUserId(req: RequestWithOptionalUser): string {
  const id = req.user?.id;
  if (typeof id !== 'string' || id.length === 0) {
    throw unauthorizedError();
  }
  return id;
}

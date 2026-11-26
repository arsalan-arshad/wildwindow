import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AdminChallengeEntriesQuerySchema,
  AdminChallengeEntriesResponseSchema,
  AdminChallengeEntryPatchSchema,
  AdminChallengeEntrySchema,
  AdminIngestRunsResponseSchema,
  AdminSessionSchema,
  AdminSpeciesCardPatchSchema,
  AdminSpeciesQuerySchema,
  AdminSpeciesResponseSchema,
  AdminTaxonRegionPatchSchema,
  AdminTaxonRegionSchema,
  type AdminChallengeEntriesQuery,
  type AdminChallengeEntriesResponse,
  type AdminChallengeEntry,
  type AdminChallengeEntryPatch,
  type AdminIngestRunsResponse,
  type AdminSession,
  type AdminSpeciesCardPatch,
  type AdminSpeciesResponse,
  type AdminTaxonRegion,
  type AdminTaxonRegionPatch,
} from '@wildwindow/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { AdminRoleGuard } from '../auth/admin-role.guard.js';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard.js';
import { type RequestWithOptionalUser } from '../geoprivacy/owner-location.js';
import { unauthorizedError, validationError } from '../http/api-error.js';

import { AdminService } from './admin.service.js';

class AdminSessionDto extends createZodDto(AdminSessionSchema) {}
class AdminSpeciesResponseDto extends createZodDto(AdminSpeciesResponseSchema) {}
class AdminTaxonRegionDto extends createZodDto(AdminTaxonRegionSchema) {}
class AdminChallengeEntriesResponseDto extends createZodDto(AdminChallengeEntriesResponseSchema) {}
class AdminChallengeEntryDto extends createZodDto(AdminChallengeEntrySchema) {}
class AdminIngestRunsResponseDto extends createZodDto(AdminIngestRunsResponseSchema) {}

/**
 * Firebase-admin-role surface (ARCHITECTURE §7 / T5.13).
 * Waitlist CSV export remains on ADMIN_TOKEN (early beta).
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('v1/admin')
@UseGuards(FirebaseAuthGuard, AdminRoleGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('session')
  @ApiOperation({ summary: 'Confirm the caller has the database admin role' })
  @ApiOkResponse({ type: AdminSessionDto })
  session(@Req() req: RequestWithOptionalUser): AdminSession {
    const user = requireUser(req);
    return { ok: true, role: 'admin', userId: user.id };
  }

  @Get('species/:taxonId')
  @ApiOperation({ summary: 'Get species card for admin edit (any status)' })
  @ApiOkResponse({ type: AdminSpeciesResponseDto })
  async getSpecies(
    @Param('taxonId') taxonId: string,
    @Query() query: unknown,
  ): Promise<AdminSpeciesResponse> {
    const parsed = AdminSpeciesQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      throw validationError(formatZod(parsed.error));
    }
    return this.admin.getSpecies(taxonId, parsed.data.region);
  }

  @Patch('species/:taxonId')
  @ApiOperation({ summary: 'Create or update a species card (audit-logged)' })
  @ApiOkResponse({ type: AdminSpeciesResponseDto })
  async patchSpecies(
    @Param('taxonId') taxonId: string,
    @Req() req: RequestWithOptionalUser,
    @Body() body: unknown,
  ): Promise<AdminSpeciesResponse> {
    const parsed = AdminSpeciesCardPatchSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError(formatZod(parsed.error));
    }
    const user = requireUser(req);
    const payload: AdminSpeciesCardPatch = parsed.data;
    return this.admin.patchSpecies(taxonId, user.id, actorLabel(user), payload);
  }

  @Get('taxon-region/:taxonId/:region')
  @ApiOperation({ summary: 'Get taxon–region tier and lockouts' })
  @ApiOkResponse({ type: AdminTaxonRegionDto })
  async getTaxonRegion(
    @Param('taxonId') taxonId: string,
    @Param('region') region: string,
  ): Promise<AdminTaxonRegion> {
    return this.admin.getTaxonRegion(taxonId, region);
  }

  @Patch('taxon-region/:taxonId/:region')
  @ApiOperation({
    summary: 'Update sensitivity tier / lockouts (audit-logged, clears forecast cache)',
  })
  @ApiOkResponse({ type: AdminTaxonRegionDto })
  async patchTaxonRegion(
    @Param('taxonId') taxonId: string,
    @Param('region') region: string,
    @Req() req: RequestWithOptionalUser,
    @Body() body: unknown,
  ): Promise<AdminTaxonRegion> {
    const parsed = AdminTaxonRegionPatchSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError(formatZod(parsed.error));
    }
    const user = requireUser(req);
    const payload: AdminTaxonRegionPatch = parsed.data;
    return this.admin.patchTaxonRegion(taxonId, region, user.id, actorLabel(user), payload);
  }

  @Get('challenge-entries')
  @ApiOperation({ summary: 'List challenge entries for moderation' })
  @ApiOkResponse({ type: AdminChallengeEntriesResponseDto })
  async listChallengeEntries(@Query() query: unknown): Promise<AdminChallengeEntriesResponse> {
    const parsed = AdminChallengeEntriesQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      throw validationError(formatZod(parsed.error));
    }
    const payload: AdminChallengeEntriesQuery = parsed.data;
    return this.admin.listChallengeEntries(payload);
  }

  @Get('challenge-entries/:id')
  @ApiOperation({ summary: 'Get one challenge entry for moderation' })
  @ApiOkResponse({ type: AdminChallengeEntryDto })
  async getChallengeEntry(@Param('id') id: string): Promise<AdminChallengeEntry> {
    return this.admin.getChallengeEntry(id);
  }

  @Patch('challenge-entries/:id')
  @ApiOperation({ summary: 'Approve or reject a challenge entry (audit-logged)' })
  @ApiOkResponse({ type: AdminChallengeEntryDto })
  async patchChallengeEntry(
    @Param('id') id: string,
    @Req() req: RequestWithOptionalUser,
    @Body() body: unknown,
  ): Promise<AdminChallengeEntry> {
    const parsed = AdminChallengeEntryPatchSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError(formatZod(parsed.error));
    }
    const user = requireUser(req);
    const payload: AdminChallengeEntryPatch = parsed.data;
    return this.admin.patchChallengeEntry(id, user.id, payload);
  }

  @Get('ingest-runs')
  @ApiOperation({ summary: 'List GBIF / data ingestion runs' })
  @ApiOkResponse({ type: AdminIngestRunsResponseDto })
  async listIngestRuns(): Promise<AdminIngestRunsResponse> {
    return this.admin.listIngestRuns();
  }
}

type AdminRequestUser = NonNullable<RequestWithOptionalUser['user']>;

function requireUser(req: RequestWithOptionalUser): AdminRequestUser {
  const user = req.user;
  if (user === undefined) {
    throw unauthorizedError();
  }
  return user;
}

function actorLabel(user: AdminRequestUser): string {
  if (typeof user.displayName === 'string' && user.displayName.trim().length > 0) {
    return user.displayName.trim();
  }
  if (typeof user.email === 'string' && user.email.trim().length > 0) {
    return user.email.trim();
  }
  return user.id;
}

function formatZod(error: z.ZodError): string {
  const message = error.issues.map((issue) => issue.message).join('; ');
  return message.length > 0 ? message : 'Invalid request';
}

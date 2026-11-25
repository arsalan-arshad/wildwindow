import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  RegionSpeciesQuerySchema,
  RegionSpeciesResponseSchema,
  RegionsResponseSchema,
  type RegionSpeciesQuery,
  type RegionSpeciesResponse,
  type RegionsResponse,
} from '@wildwindow/shared';
import { createZodDto } from 'nestjs-zod';

import { validationError } from '../http/api-error.js';

import { CatalogueService } from './catalogue.service.js';

class RegionsResponseDto extends createZodDto(RegionsResponseSchema) {}
class RegionSpeciesResponseDto extends createZodDto(RegionSpeciesResponseSchema) {}

@ApiTags('regions')
@Controller('v1/regions')
export class RegionsController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get()
  @ApiOperation({ summary: 'List beta regions (no geometry)' })
  @ApiOkResponse({ type: RegionsResponseDto })
  async list(): Promise<RegionsResponse> {
    return this.catalogue.listRegions();
  }

  @Get(':slug/species')
  @ApiOperation({ summary: 'Species list for a region with optional search and group filter' })
  @ApiOkResponse({ type: RegionSpeciesResponseDto })
  async species(
    @Param('slug') slug: string,
    @Query() query: unknown,
  ): Promise<RegionSpeciesResponse> {
    const parsed = RegionSpeciesQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join('; ');
      throw validationError(message.length > 0 ? message : 'Invalid species query');
    }
    const payload: RegionSpeciesQuery = parsed.data;
    return this.catalogue.listRegionSpecies(slug, payload);
  }
}

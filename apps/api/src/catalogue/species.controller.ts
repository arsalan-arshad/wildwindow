import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  SeasonalityQuerySchema,
  SeasonalityResponseSchema,
  SpeciesDetailQuerySchema,
  SpeciesDetailSchema,
  type SeasonalityQuery,
  type SeasonalityResponse,
  type SpeciesDetail,
  type SpeciesDetailQuery,
} from '@wildwindow/shared';
import { createZodDto } from 'nestjs-zod';

import { validationError } from '../http/api-error.js';

import { CatalogueService } from './catalogue.service.js';

class SpeciesDetailDto extends createZodDto(SpeciesDetailSchema) {}
class SeasonalityResponseDto extends createZodDto(SeasonalityResponseSchema) {}

@ApiTags('species')
@Controller('v1/species')
export class SpeciesController {
  constructor(private readonly catalogue: CatalogueService) {}

  // Declare the longer path first so Nest does not treat "seasonality" as a taxonId.
  @Get(':taxonId/seasonality')
  @ApiOperation({ summary: '52-week relative reporting rate for a species×region' })
  @ApiOkResponse({ type: SeasonalityResponseDto })
  async seasonality(
    @Param('taxonId') taxonId: string,
    @Query() query: unknown,
  ): Promise<SeasonalityResponse> {
    const parsed = SeasonalityQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join('; ');
      throw validationError(message.length > 0 ? message : 'Invalid seasonality query');
    }
    const payload: SeasonalityQuery = parsed.data;
    return this.catalogue.getSeasonality(taxonId, payload.region);
  }

  @Get(':taxonId')
  @ApiOperation({ summary: 'Species detail with reviewed field card only' })
  @ApiOkResponse({ type: SpeciesDetailDto })
  async detail(@Param('taxonId') taxonId: string, @Query() query: unknown): Promise<SpeciesDetail> {
    const parsed = SpeciesDetailQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join('; ');
      throw validationError(message.length > 0 ? message : 'Invalid species detail query');
    }
    const payload: SpeciesDetailQuery = parsed.data;
    return this.catalogue.getSpeciesDetail(taxonId, payload.region);
  }
}

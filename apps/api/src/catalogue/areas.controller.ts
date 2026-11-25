import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AreaResponseSchema, type AreaResponse } from '@wildwindow/shared';
import { createZodDto } from 'nestjs-zod';

import { CatalogueService } from './catalogue.service.js';

class AreaResponseDto extends createZodDto(AreaResponseSchema) {}

@ApiTags('areas')
@Controller('v1/areas')
export class AreasController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get(':cellR7')
  @ApiOperation({ summary: 'Area label, region and coverage for an H3 res-7 cell' })
  @ApiOkResponse({ type: AreaResponseDto })
  async get(@Param('cellR7') cellR7: string): Promise<AreaResponse> {
    return this.catalogue.getArea(cellR7);
  }
}

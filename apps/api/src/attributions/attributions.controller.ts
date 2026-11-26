import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AttributionsResponseSchema, type AttributionsResponse } from '@wildwindow/shared';
import { createZodDto } from 'nestjs-zod';

import { AttributionsService } from './attributions.service.js';

class AttributionsResponseDto extends createZodDto(AttributionsResponseSchema) {}

@ApiTags('attributions')
@Controller('v1/attributions')
export class AttributionsController {
  constructor(private readonly attributions: AttributionsService) {}

  @Get()
  @ApiOperation({ summary: 'Dataset, DOI, weather and tide credits' })
  @ApiOkResponse({ type: AttributionsResponseDto })
  async list(): Promise<AttributionsResponse> {
    return this.attributions.list();
  }
}

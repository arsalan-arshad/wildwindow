import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  PlacesQuerySchema,
  PlacesResponseSchema,
  type PlacesQuery,
  type PlacesResponse,
} from '@wildwindow/shared';
import { createZodDto } from 'nestjs-zod';

import { validationError } from '../http/api-error.js';

import { CatalogueService } from './catalogue.service.js';

class PlacesResponseDto extends createZodDto(PlacesResponseSchema) {}

@ApiTags('places')
@Controller('v1/places')
export class PlacesController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get()
  @ApiOperation({ summary: 'Trigram place search within beta regions (cell only)' })
  @ApiOkResponse({ type: PlacesResponseDto })
  async search(@Query() query: unknown): Promise<PlacesResponse> {
    const parsed = PlacesQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join('; ');
      throw validationError(message.length > 0 ? message : 'Invalid places query');
    }
    const payload: PlacesQuery = parsed.data;
    return this.catalogue.searchPlaces(payload);
  }
}

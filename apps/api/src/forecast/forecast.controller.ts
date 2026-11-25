import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ForecastQuerySchema, type ForecastQuery, type ForecastResponse } from '@wildwindow/shared';

import { validationError } from '../http/api-error.js';

import { ForecastService } from './forecast.service.js';

@ApiTags('forecast')
@Controller('v1/forecast')
export class ForecastController {
  constructor(private readonly forecast: ForecastService) {}

  @Get()
  @ApiOperation({
    summary: '7-day Window score forecast for a species × area (ARCHITECTURE §5.5)',
  })
  async get(@Query() query: unknown): Promise<ForecastResponse> {
    const parsed = ForecastQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join('; ');
      throw validationError(message.length > 0 ? message : 'Invalid forecast query');
    }
    const payload: ForecastQuery = parsed.data;
    return this.forecast.getForecast(payload);
  }
}

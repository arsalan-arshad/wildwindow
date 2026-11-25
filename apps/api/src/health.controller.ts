import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthOkSchema, type HealthOk } from '@wildwindow/shared';
import { createZodDto } from 'nestjs-zod';

class HealthOkDto extends createZodDto(HealthOkSchema) {}

@ApiTags('health')
@Controller('v1/health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Liveness check' })
  @ApiOkResponse({ type: HealthOkDto })
  getHealth(): HealthOk {
    return { status: 'ok' };
  }
}

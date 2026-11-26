import { Module } from '@nestjs/common';

import { WeatherModule } from '../providers/weather/weather.module.js';

import { ForecastController } from './forecast.controller.js';
import { ForecastService } from './forecast.service.js';

@Module({
  imports: [WeatherModule],
  controllers: [ForecastController],
  providers: [ForecastService],
  exports: [ForecastService],
})
export class ForecastModule {}

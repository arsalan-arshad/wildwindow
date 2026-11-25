import { Module } from '@nestjs/common';

import { API_ENV, type ApiEnv } from '../../config/api-env.js';

import { createWeatherProvider, resolveWeatherProviderId } from './factory.js';
import { WeatherService } from './weather.service.js';
import { WEATHER_PROVIDER } from './weather.tokens.js';

@Module({
  providers: [
    {
      provide: WEATHER_PROVIDER,
      inject: [API_ENV],
      useFactory: (env: ApiEnv) => {
        const id = resolveWeatherProviderId(env.WEATHER_PROVIDER, env.NODE_ENV);
        return createWeatherProvider({
          id,
          nodeEnv: env.NODE_ENV,
          ...(env.WEATHER_USER_AGENT !== undefined ? { userAgent: env.WEATHER_USER_AGENT } : {}),
        });
      },
    },
    WeatherService,
  ],
  exports: [WeatherService, WEATHER_PROVIDER],
})
export class WeatherModule {}

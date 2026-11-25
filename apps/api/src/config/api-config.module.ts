import { Global, Module } from '@nestjs/common';

import { API_ENV, loadApiEnv, type ApiEnv } from './api-env.js';

@Global()
@Module({
  providers: [
    {
      provide: API_ENV,
      useFactory: (): ApiEnv => loadApiEnv(),
    },
  ],
  exports: [API_ENV],
})
export class ApiConfigModule {}

import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { raw } from 'express';

import { API_ENV, type ApiEnv } from '../config/api-env.js';
import { createStorageService, resolveStorageDriverId } from '../storage/factory.js';
import { STORAGE_SERVICE } from '../storage/storage.types.js';

import { UploadsController } from './uploads.controller.js';
import { UploadsService } from './uploads.service.js';

@Module({
  controllers: [UploadsController],
  providers: [
    {
      provide: STORAGE_SERVICE,
      inject: [API_ENV],
      useFactory: (env: ApiEnv) => {
        const driver = resolveStorageDriverId(env.STORAGE_DRIVER, env.NODE_ENV);
        return createStorageService({
          driver,
          nodeEnv: env.NODE_ENV,
          ...(env.API_PUBLIC_URL !== undefined ? { apiPublicUrl: env.API_PUBLIC_URL } : {}),
          ...(env.LOCAL_STORAGE_DIR !== undefined ? { localRootDir: env.LOCAL_STORAGE_DIR } : {}),
          ...(env.STORAGE_SIGNING_SECRET !== undefined
            ? { signingSecret: env.STORAGE_SIGNING_SECRET }
            : {}),
          ...(env.S3_BUCKET !== undefined ? { s3Bucket: env.S3_BUCKET } : {}),
          ...(env.S3_REGION !== undefined ? { s3Region: env.S3_REGION } : {}),
          ...(env.R2_BUCKET !== undefined ? { r2Bucket: env.R2_BUCKET } : {}),
          ...(env.R2_ENDPOINT !== undefined ? { r2Endpoint: env.R2_ENDPOINT } : {}),
          ...(env.R2_ACCOUNT_ID !== undefined ? { r2AccountId: env.R2_ACCOUNT_ID } : {}),
          ...(env.R2_ACCESS_KEY_ID !== undefined ? { r2AccessKeyId: env.R2_ACCESS_KEY_ID } : {}),
          ...(env.R2_SECRET_ACCESS_KEY !== undefined
            ? { r2SecretAccessKey: env.R2_SECRET_ACCESS_KEY }
            : {}),
          ...(env.R2_PUBLIC_URL !== undefined ? { r2PublicUrl: env.R2_PUBLIC_URL } : {}),
        });
      },
    },
    UploadsService,
  ],
  exports: [UploadsService, STORAGE_SERVICE],
})
export class UploadsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Presigned local PUT sends raw image bytes (not JSON).
    consumer
      .apply(raw({ type: '*/*', limit: '15mb' }))
      .forRoutes({ path: 'v1/uploads/put/:token', method: RequestMethod.PUT });
  }
}

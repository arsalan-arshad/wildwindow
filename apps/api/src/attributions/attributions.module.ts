import { Module } from '@nestjs/common';

import { AttributionsController } from './attributions.controller.js';
import { AttributionsService } from './attributions.service.js';

@Module({
  controllers: [AttributionsController],
  providers: [AttributionsService],
  exports: [AttributionsService],
})
export class AttributionsModule {}

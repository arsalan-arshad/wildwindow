import { Module } from '@nestjs/common';

import { UploadsModule } from '../uploads/uploads.module.js';

import { LogbookController } from './logbook.controller.js';
import { LogbookService } from './logbook.service.js';

@Module({
  imports: [UploadsModule],
  controllers: [LogbookController],
  providers: [LogbookService],
  exports: [LogbookService],
})
export class LogbookModule {}

import { Module } from '@nestjs/common';

import { BugReportsController } from './bug-reports.controller.js';
import { BugReportsService } from './bug-reports.service.js';

@Module({
  controllers: [BugReportsController],
  providers: [BugReportsService],
  exports: [BugReportsService],
})
export class BugReportsModule {}

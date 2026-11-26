import { Module } from '@nestjs/common';

import { UploadsModule } from '../uploads/uploads.module.js';

import { ChallengesController } from './challenges.controller.js';
import { ChallengesService } from './challenges.service.js';

@Module({
  imports: [UploadsModule],
  controllers: [ChallengesController],
  providers: [ChallengesService],
  exports: [ChallengesService],
})
export class ChallengesModule {}

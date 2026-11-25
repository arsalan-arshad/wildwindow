import { Module } from '@nestjs/common';

import { CatalogueService } from './catalogue.service.js';
import { RegionsController } from './regions.controller.js';
import { SpeciesController } from './species.controller.js';

@Module({
  controllers: [RegionsController, SpeciesController],
  providers: [CatalogueService],
  exports: [CatalogueService],
})
export class CatalogueModule {}

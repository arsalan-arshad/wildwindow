import { Module } from '@nestjs/common';

import { AreasController } from './areas.controller.js';
import { CatalogueService } from './catalogue.service.js';
import { PlacesController } from './places.controller.js';
import { RegionsController } from './regions.controller.js';
import { SpeciesController } from './species.controller.js';

@Module({
  controllers: [RegionsController, SpeciesController, PlacesController, AreasController],
  providers: [CatalogueService],
  exports: [CatalogueService],
})
export class CatalogueModule {}

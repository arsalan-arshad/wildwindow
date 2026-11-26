import { Inject, Injectable } from '@nestjs/common';
import { datasets, type Database } from '@wildwindow/db';
import { type AttributionDataset, type AttributionsResponse } from '@wildwindow/shared';
import { asc } from 'drizzle-orm';

import { API_ENV, type ApiEnv } from '../config/api-env.js';
import { DB } from '../db/db.module.js';
import { serviceUnavailable } from '../http/api-error.js';

import { doiFromCitation } from './doi.js';
import { buildAttributionProviders } from './providers.js';

@Injectable()
export class AttributionsService {
  constructor(
    @Inject(DB) private readonly db: Database | null,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  async list(): Promise<AttributionsResponse> {
    if (this.db === null) {
      throw serviceUnavailable('Attributions are temporarily unavailable');
    }

    const rows = await this.db
      .select({
        title: datasets.title,
        publisher: datasets.publisher,
        license: datasets.license,
        citation: datasets.citation,
      })
      .from(datasets)
      .orderBy(asc(datasets.title), asc(datasets.gbifDatasetKey));

    const datasetRows: AttributionDataset[] = rows.map((row) => ({
      title: row.title,
      publisher: row.publisher,
      license: row.license,
      citation: row.citation,
      doi: doiFromCitation(row.citation),
    }));

    return {
      datasets: datasetRows,
      providers: buildAttributionProviders({
        weatherProvider: this.env.WEATHER_PROVIDER,
        tideProvider: this.env.TIDE_PROVIDER,
        nodeEnv: this.env.NODE_ENV,
      }),
    };
  }
}

import { bigserial, date, index, integer, smallint, text, uniqueIndex } from 'drizzle-orm/pg-core';

import { ingestRuns } from './app.js';
import { geometryPoint4326 } from './geometry.js';
import { regions, taxa } from './ref.js';
import { rawSchema } from './schemas.js';

/** Precise occurrence points — worker-only (ARCHITECTURE §6.1 / §6.2). */
export const occurrences = rawSchema.table(
  'occurrences',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    source: text('source').notNull(),
    sourceRecordId: text('source_record_id').notNull(),
    taxonId: integer('taxon_id')
      .notNull()
      .references(() => taxa.id),
    regionId: integer('region_id')
      .notNull()
      .references(() => regions.id),
    geom: geometryPoint4326('geom').notNull(),
    uncertaintyM: integer('uncertainty_m'),
    eventDate: date('event_date').notNull(),
    year: integer('year').notNull(),
    week: smallint('week').notNull(),
    hour: smallint('hour'),
    license: text('license').notNull(),
    datasetKey: text('dataset_key').notNull(),
    observerHash: text('observer_hash').notNull(),
    ingestRunId: integer('ingest_run_id').references(() => ingestRuns.id),
  },
  (table) => [
    uniqueIndex('occurrences_source_record_uidx').on(table.source, table.sourceRecordId),
    index('occurrences_geom_gix').using('gist', table.geom),
    index('occurrences_taxon_region_week_idx').on(table.taxonId, table.regionId, table.week),
  ],
);

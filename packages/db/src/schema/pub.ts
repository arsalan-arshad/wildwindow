import {
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  primaryKey,
  smallint,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

import { regions, taxa } from './ref.js';
import { pubSchema } from './schemas.js';

/** Policy-applied cell×week aggregates safe to serve (ARCHITECTURE §6.2). */
export const taxonCellWeek = pubSchema.table(
  'taxon_cell_week',
  {
    taxonId: integer('taxon_id')
      .notNull()
      .references(() => taxa.id),
    regionId: integer('region_id')
      .notNull()
      .references(() => regions.id),
    res: smallint('res').notNull(),
    cell: text('cell').notNull(),
    week: smallint('week').notNull(),
    nRecords: integer('n_records').notNull(),
    nObservers: integer('n_observers').notNull(),
    yearsCovered: integer('years_covered').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.taxonId, table.res, table.cell, table.week] }),
    // Forecast history: taxon + region + week window + neighbourhood cells (T9.8).
    index('taxon_cell_week_taxon_region_week_cell_idx').on(
      table.taxonId,
      table.regionId,
      table.week,
      table.cell,
    ),
  ],
);

export const taxonRegionWeek = pubSchema.table(
  'taxon_region_week',
  {
    taxonId: integer('taxon_id')
      .notNull()
      .references(() => taxa.id),
    regionId: integer('region_id')
      .notNull()
      .references(() => regions.id),
    week: smallint('week').notNull(),
    nRecords: integer('n_records').notNull(),
    nEffort: integer('n_effort').notNull(),
  },
  (table) => [primaryKey({ columns: [table.taxonId, table.regionId, table.week] })],
);

export const effortCellWeek = pubSchema.table(
  'effort_cell_week',
  {
    effortGroup: text('effort_group').notNull(),
    regionId: integer('region_id')
      .notNull()
      .references(() => regions.id),
    res: smallint('res').notNull(),
    cell: text('cell').notNull(),
    week: smallint('week').notNull(),
    nRecords: integer('n_records').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.effortGroup, table.res, table.cell, table.week],
    }),
    // Forecast history effort sum: group + region + week window + cells (T9.8).
    index('effort_cell_week_group_region_week_cell_idx').on(
      table.effortGroup,
      table.regionId,
      table.week,
      table.cell,
    ),
  ],
);

export const taxonHourProfile = pubSchema.table(
  'taxon_hour_profile',
  {
    taxonId: integer('taxon_id')
      .notNull()
      .references(() => taxa.id),
    regionId: integer('region_id')
      .notNull()
      .references(() => regions.id),
    hour: smallint('hour').notNull(),
    nRecords: integer('n_records').notNull(),
  },
  (table) => [primaryKey({ columns: [table.taxonId, table.regionId, table.hour] })],
);

export const taxonScoreRef = pubSchema.table(
  'taxon_score_ref',
  {
    taxonId: integer('taxon_id')
      .notNull()
      .references(() => taxa.id),
    regionId: integer('region_id')
      .notNull()
      .references(() => regions.id),
    rrRef: doublePrecision('rr_ref').notNull(),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull(),
    scoringVersion: text('scoring_version').notNull(),
  },
  (table) => [primaryKey({ columns: [table.taxonId, table.regionId] })],
);

export const weatherCache = pubSchema.table(
  'weather_cache',
  {
    provider: text('provider').notNull(),
    cellR5: text('cell_r5').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  },
  (table) => [primaryKey({ columns: [table.provider, table.cellR5] })],
);

export const forecastCache = pubSchema.table(
  'forecast_cache',
  {
    taxonId: integer('taxon_id')
      .notNull()
      .references(() => taxa.id),
    displayCell: text('display_cell').notNull(),
    startDate: date('start_date').notNull(),
    scoringVersion: text('scoring_version').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.taxonId, table.displayCell, table.startDate, table.scoringVersion],
    }),
  ],
);

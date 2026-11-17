import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { geometryMultipolygon4326 } from './geometry.js';
import { refSchema } from './schemas.js';

/** Beta regions: Scotland and Sindh (ARCHITECTURE §6.2). */
export const regions = refSchema.table(
  'regions',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    countryCode: text('country_code').notNull(),
    timeZone: text('time_zone').notNull(),
    geom: geometryMultipolygon4326('geom').notNull(),
    minRes: integer('min_res').notNull().default(3),
  },
  (table) => [
    uniqueIndex('regions_slug_uidx').on(table.slug),
    index('regions_geom_gix').using('gist', table.geom),
  ],
);

/** Administrative / label polygons only — never for exact pins. */
export const zones = refSchema.table(
  'zones',
  {
    id: serial('id').primaryKey(),
    regionId: integer('region_id')
      .notNull()
      .references(() => regions.id),
    name: text('name').notNull(),
    kind: text('kind').notNull(),
    geom: geometryMultipolygon4326('geom').notNull(),
  },
  (table) => [index('zones_geom_gix').using('gist', table.geom)],
);

/** GeoNames places snapped to H3 res-7 cells. */
export const places = refSchema.table(
  'places',
  {
    id: serial('id').primaryKey(),
    regionId: integer('region_id')
      .notNull()
      .references(() => regions.id),
    name: text('name').notNull(),
    altNames: text('alt_names')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    kind: text('kind').notNull(),
    cellR7: text('cell_r7').notNull(),
    population: integer('population'),
  },
  (table) => [
    index('places_name_trgm_idx').using('gin', table.name.op('gin_trgm_ops')),
    index('places_cell_r7_idx').on(table.cellR7),
  ],
);

export const taxa = refSchema.table(
  'taxa',
  {
    id: serial('id').primaryKey(),
    gbifTaxonKey: integer('gbif_taxon_key').notNull(),
    scientificName: text('scientific_name').notNull(),
    commonNames: jsonb('common_names').$type<{ en?: string; ur?: string }>().notNull(),
    group: text('group').notNull(),
    effortGroup: text('effort_group').notNull(),
    coastal: boolean('coastal').notNull().default(false),
    tidePref: text('tide_pref'),
    activityPattern: text('activity_pattern'),
    challengeEligible: boolean('challenge_eligible').notNull().default(false),
  },
  (table) => [uniqueIndex('taxa_gbif_taxon_key_uidx').on(table.gbifTaxonKey)],
);

export const taxonRegion = refSchema.table(
  'taxon_region',
  {
    taxonId: integer('taxon_id')
      .notNull()
      .references(() => taxa.id),
    regionId: integer('region_id')
      .notNull()
      .references(() => regions.id),
    tier: text('tier').notNull(),
    lockoutMonths: integer('lockout_months')
      .array()
      .notNull()
      .default(sql`'{}'::int[]`),
    reviewer: text('reviewer'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.taxonId, table.regionId] })],
);

export const speciesCards = refSchema.table('species_cards', {
  id: serial('id').primaryKey(),
  taxonId: integer('taxon_id')
    .notNull()
    .references(() => taxa.id),
  regionId: integer('region_id')
    .notNull()
    .references(() => regions.id),
  bodyMd: text('body_md').notNull(),
  settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
  ethicsMd: text('ethics_md'),
  legalMd: text('legal_md'),
  status: text('status').notNull().default('draft'),
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
});

export const datasets = refSchema.table('datasets', {
  gbifDatasetKey: text('gbif_dataset_key').primaryKey(),
  title: text('title').notNull(),
  publisher: text('publisher').notNull(),
  license: text('license').notNull(),
  citation: text('citation').notNull(),
});

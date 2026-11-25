import { z } from 'zod';

import {
  ActivityPatternSchema,
  CommonNamesSchema,
  RegionIdSchema,
  SensitivityTierSchema,
  SpeciesGroupSchema,
  TaxonIdSchema,
  TidePrefSchema,
} from './common.js';

/** GET /v1/regions/:slug/species query */
export const RegionSpeciesQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  group: SpeciesGroupSchema.optional(),
});
export type RegionSpeciesQuery = z.infer<typeof RegionSpeciesQuerySchema>;

/** Species list row with tier badge (no coordinates). */
export const SpeciesListItemSchema = z.object({
  taxonId: TaxonIdSchema,
  scientificName: z.string().min(1),
  commonNames: CommonNamesSchema,
  group: SpeciesGroupSchema,
  tier: SensitivityTierSchema,
  coastal: z.boolean(),
  challengeEligible: z.boolean(),
});
export type SpeciesListItem = z.infer<typeof SpeciesListItemSchema>;

/** GET /v1/regions/:slug/species */
export const RegionSpeciesResponseSchema = z.object({
  regionSlug: RegionIdSchema,
  species: z.array(SpeciesListItemSchema),
});
export type RegionSpeciesResponse = z.infer<typeof RegionSpeciesResponseSchema>;

/** Reviewed field card payload (Markdown + settings; no coordinates). */
export const SpeciesCardSchema = z.object({
  bodyMd: z.string().min(1),
  settings: z.record(z.unknown()),
  ethicsMd: z.string().nullable(),
  legalMd: z.string().nullable(),
  reviewedBy: z.string().min(1),
  reviewedAt: z.string().datetime(),
});
export type SpeciesCard = z.infer<typeof SpeciesCardSchema>;

/** GET /v1/species/:taxonId query */
export const SpeciesDetailQuerySchema = z.object({
  region: RegionIdSchema,
});
export type SpeciesDetailQuery = z.infer<typeof SpeciesDetailQuerySchema>;

/** GET /v1/species/:taxonId — only reviewed cards (ARCHITECTURE §7). */
export const SpeciesDetailSchema = z.object({
  taxonId: TaxonIdSchema,
  scientificName: z.string().min(1),
  commonNames: CommonNamesSchema,
  group: SpeciesGroupSchema,
  regionSlug: RegionIdSchema,
  tier: SensitivityTierSchema,
  coastal: z.boolean(),
  tidePref: TidePrefSchema.nullable(),
  activityPattern: ActivityPatternSchema.nullable(),
  challengeEligible: z.boolean(),
  card: SpeciesCardSchema.nullable(),
});
export type SpeciesDetail = z.infer<typeof SpeciesDetailSchema>;

/** GET /v1/species/:taxonId/seasonality query */
export const SeasonalityQuerySchema = z.object({
  region: RegionIdSchema,
});
export type SeasonalityQuery = z.infer<typeof SeasonalityQuerySchema>;

/** 52 weekly relative reporting rates in [0, 1]. */
export const SeasonalityResponseSchema = z.object({
  taxonId: TaxonIdSchema,
  regionSlug: RegionIdSchema,
  weeks: z.array(z.number().min(0).max(1)).length(52),
});
export type SeasonalityResponse = z.infer<typeof SeasonalityResponseSchema>;

/** GET /v1/species/:taxonId/map query */
export const SpeciesMapQuerySchema = z.object({
  region: RegionIdSchema,
});
export type SpeciesMapQuery = z.infer<typeof SpeciesMapQuerySchema>;

/** Public map cell at the tier's resolution — level 1–5, never counts (ARCHITECTURE §7). */
export const SpeciesMapCellSchema = z.object({
  cell: z.string().min(1),
  level: z.number().int().min(1).max(5),
});
export type SpeciesMapCell = z.infer<typeof SpeciesMapCellSchema>;

/** GET /v1/species/:taxonId/map — `[]` when mapCells=false / highly_protected / no_forecast. */
export const SpeciesMapResponseSchema = z.object({
  taxonId: TaxonIdSchema,
  regionSlug: RegionIdSchema,
  cells: z.array(SpeciesMapCellSchema),
});
export type SpeciesMapResponse = z.infer<typeof SpeciesMapResponseSchema>;

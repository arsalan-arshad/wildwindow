import { z } from 'zod';

import { RegionIdSchema, SensitivityTierSchema, TaxonIdSchema } from './common.js';
import { SpeciesCardSchema } from './species.js';

/** GET / PATCH /v1/admin/species/:taxonId — card body for a region. */
export const AdminSpeciesCardPatchSchema = z.object({
  region: RegionIdSchema,
  bodyMd: z.string().min(1).optional(),
  settings: z.record(z.unknown()).optional(),
  ethicsMd: z.string().nullable().optional(),
  legalMd: z.string().nullable().optional(),
  status: z.enum(['draft', 'reviewed']).optional(),
});
export type AdminSpeciesCardPatch = z.infer<typeof AdminSpeciesCardPatchSchema>;

export const AdminSpeciesResponseSchema = z.object({
  taxonId: TaxonIdSchema,
  regionSlug: RegionIdSchema,
  card: SpeciesCardSchema.nullable(),
  cardStatus: z.enum(['draft', 'reviewed', 'missing']),
});
export type AdminSpeciesResponse = z.infer<typeof AdminSpeciesResponseSchema>;

/** GET / PATCH /v1/admin/taxon-region/:taxonId/:region */
export const AdminTaxonRegionPatchSchema = z.object({
  tier: SensitivityTierSchema.optional(),
  lockoutMonths: z.array(z.number().int().min(1).max(12)).optional(),
  reviewer: z.string().min(1).optional(),
});
export type AdminTaxonRegionPatch = z.infer<typeof AdminTaxonRegionPatchSchema>;

export const AdminTaxonRegionSchema = z.object({
  taxonId: TaxonIdSchema,
  regionSlug: RegionIdSchema,
  tier: SensitivityTierSchema,
  lockoutMonths: z.array(z.number().int().min(1).max(12)),
  reviewer: z.string().nullable(),
  reviewedAt: z.string().datetime().nullable(),
});
export type AdminTaxonRegion = z.infer<typeof AdminTaxonRegionSchema>;

export const ChallengeEntryModerationStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
]);
export type ChallengeEntryModerationStatus = z.infer<
  typeof ChallengeEntryModerationStatusSchema
>;

/** GET /v1/admin/challenge-entries */
export const AdminChallengeEntriesQuerySchema = z.object({
  status: ChallengeEntryModerationStatusSchema.optional(),
});
export type AdminChallengeEntriesQuery = z.infer<typeof AdminChallengeEntriesQuerySchema>;

export const AdminChallengeEntrySchema = z.object({
  id: z.string().min(1),
  challengeSlug: z.string().min(1),
  userId: z.string().uuid(),
  countryCode: z.string().length(2),
  regionLabel: z.string().min(1),
  photoKey: z.string().min(1),
  status: ChallengeEntryModerationStatusSchema,
  rejectReason: z.string().nullable(),
  publishAfter: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export type AdminChallengeEntry = z.infer<typeof AdminChallengeEntrySchema>;

export const AdminChallengeEntriesResponseSchema = z.object({
  entries: z.array(AdminChallengeEntrySchema),
});
export type AdminChallengeEntriesResponse = z.infer<typeof AdminChallengeEntriesResponseSchema>;

/** PATCH /v1/admin/challenge-entries/:id */
export const AdminChallengeEntryPatchSchema = z.object({
  status: ChallengeEntryModerationStatusSchema,
  rejectReason: z.string().max(1000).nullable().optional(),
});
export type AdminChallengeEntryPatch = z.infer<typeof AdminChallengeEntryPatchSchema>;

export const IngestRunStatusSchema = z.enum([
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
]);
export type IngestRunStatus = z.infer<typeof IngestRunStatusSchema>;

/** GET /v1/admin/ingest-runs */
export const AdminIngestRunSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  regionSlug: RegionIdSchema,
  kind: z.string().min(1),
  gbifDownloadKey: z.string().nullable(),
  doi: z.string().nullable(),
  status: IngestRunStatusSchema,
  total: z.number().int().nonnegative().nullable(),
  loaded: z.number().int().nonnegative().nullable(),
  rejectedLicence: z.number().int().nonnegative().nullable(),
  rejectedCoords: z.number().int().nonnegative().nullable(),
  rejectedOther: z.number().int().nonnegative().nullable(),
  startedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
});
export type AdminIngestRun = z.infer<typeof AdminIngestRunSchema>;

export const AdminIngestRunsResponseSchema = z.object({
  runs: z.array(AdminIngestRunSchema),
});
export type AdminIngestRunsResponse = z.infer<typeof AdminIngestRunsResponseSchema>;

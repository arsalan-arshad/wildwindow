import { z } from 'zod';

import { H3CellSchema, TaxonIdSchema } from './common.js';

/**
 * Owner-only exact location. Allowed only on `@OwnerLocation()` routes (T5.3 / T5.11).
 * Excluded from the public-schema forbidden-key guard.
 */
export const OwnerExactLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type OwnerExactLocation = z.infer<typeof OwnerExactLocationSchema>;

/** Shared logbook fields that are safe to echo without exact coordinates. */
const LogbookEntryBaseSchema = z.object({
  id: z.string().min(1),
  taxonId: TaxonIdSchema.nullable(),
  takenAt: z.string().datetime(),
  cellR7: H3CellSchema.nullable(),
  photoKey: z.string().min(1),
  thumbKey: z.string().min(1).nullable(),
  /** Camera settings stripped of GPS EXIF before upload. */
  exif: z.record(z.unknown()),
  notes: z.string().max(4000).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/** Public-safe logbook row (list/export without exact point). */
export const LogbookEntryPublicSchema = LogbookEntryBaseSchema;
export type LogbookEntryPublic = z.infer<typeof LogbookEntryPublicSchema>;

/** Owner GET/PATCH response — may include decrypted exact point. */
export const LogbookEntryOwnerSchema = LogbookEntryBaseSchema.extend({
  exactLocation: OwnerExactLocationSchema.nullable(),
});
export type LogbookEntryOwner = z.infer<typeof LogbookEntryOwnerSchema>;

/** GET /v1/me/logbook */
export const LogbookListResponseSchema = z.object({
  items: z.array(LogbookEntryPublicSchema),
});
export type LogbookListResponse = z.infer<typeof LogbookListResponseSchema>;

/** POST /v1/me/logbook — optional exact location is owner-only input. */
export const LogbookCreateRequestSchema = z.object({
  taxonId: TaxonIdSchema.nullable().optional(),
  takenAt: z.string().datetime(),
  cellR7: H3CellSchema.nullable().optional(),
  photoKey: z.string().min(1),
  thumbKey: z.string().min(1).optional(),
  exif: z.record(z.unknown()).optional(),
  notes: z.string().max(4000).optional(),
  exactLocation: OwnerExactLocationSchema.optional(),
});
export type LogbookCreateRequest = z.infer<typeof LogbookCreateRequestSchema>;

/** PATCH /v1/me/logbook/:id */
export const LogbookPatchRequestSchema = z
  .object({
    taxonId: TaxonIdSchema.nullable().optional(),
    notes: z.string().max(4000).nullable().optional(),
    cellR7: H3CellSchema.nullable().optional(),
    exactLocation: OwnerExactLocationSchema.nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field is required',
  });
export type LogbookPatchRequest = z.infer<typeof LogbookPatchRequestSchema>;

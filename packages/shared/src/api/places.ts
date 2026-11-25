import { z } from 'zod';

import { H3CellSchema, RegionIdSchema } from './common.js';

/** GET /v1/places query */
export const PlacesQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  region: RegionIdSchema.optional(),
});
export type PlacesQuery = z.infer<typeof PlacesQuerySchema>;

/** Place search hit — cell only, never lat/lng (ARCHITECTURE §7). */
export const PlaceSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  regionSlug: RegionIdSchema,
  cellR7: H3CellSchema,
});
export type PlaceSummary = z.infer<typeof PlaceSummarySchema>;

/** GET /v1/places */
export const PlacesResponseSchema = z.object({
  places: z.array(PlaceSummarySchema),
});
export type PlacesResponse = z.infer<typeof PlacesResponseSchema>;

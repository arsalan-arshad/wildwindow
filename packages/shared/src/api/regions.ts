import { z } from 'zod';

import { RegionIdSchema } from './common.js';

/** Public region summary — never includes geometry (ARCHITECTURE §7). */
export const RegionSummarySchema = z.object({
  slug: RegionIdSchema,
  name: z.string().min(1),
  countryCode: z.string().length(2),
  timeZone: z.string().min(1),
});
export type RegionSummary = z.infer<typeof RegionSummarySchema>;

/** GET /v1/regions */
export const RegionsResponseSchema = z.object({
  regions: z.array(RegionSummarySchema),
});
export type RegionsResponse = z.infer<typeof RegionsResponseSchema>;

import { z } from 'zod';

import { H3CellSchema, RegionIdSchema } from './common.js';

/** GET /v1/areas/:cellR7 — label, region, coverage (no coordinates). */
export const AreaResponseSchema = z.object({
  cellR7: H3CellSchema,
  label: z.string().min(1),
  regionSlug: RegionIdSchema.nullable(),
  covered: z.boolean(),
});
export type AreaResponse = z.infer<typeof AreaResponseSchema>;

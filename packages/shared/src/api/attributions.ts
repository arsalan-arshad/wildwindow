import { z } from 'zod';

/** Dataset credit row for GET /v1/attributions. */
export const AttributionDatasetSchema = z.object({
  title: z.string().min(1),
  publisher: z.string().min(1),
  license: z.string().min(1),
  citation: z.string().min(1),
  doi: z.string().min(1).nullable(),
});
export type AttributionDataset = z.infer<typeof AttributionDatasetSchema>;

/** Provider credit (weather, tide, places, …). */
export const AttributionProviderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  credit: z.string().min(1),
  url: z.string().url().optional(),
});
export type AttributionProvider = z.infer<typeof AttributionProviderSchema>;

/** GET /v1/attributions */
export const AttributionsResponseSchema = z.object({
  datasets: z.array(AttributionDatasetSchema),
  providers: z.array(AttributionProviderSchema),
});
export type AttributionsResponse = z.infer<typeof AttributionsResponseSchema>;

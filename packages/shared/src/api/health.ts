import { z } from 'zod';

/** GET /v1/health */
export const HealthOkSchema = z.object({
  status: z.literal('ok'),
});
export type HealthOk = z.infer<typeof HealthOkSchema>;

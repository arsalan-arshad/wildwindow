import { z } from 'zod';

import { ApiErrorBodySchema } from './common.js';

export { ApiErrorBodySchema };
export type { ApiErrorBody } from './common.js';

/** Region choices on the marketing waitlist form (not beta region IDs only). */
export const WaitlistRegionSlugSchema = z.enum(['scotland', 'sindh', 'both', 'other']);
export type WaitlistRegionSlug = z.infer<typeof WaitlistRegionSlugSchema>;

export const WaitlistRoleSchema = z.enum([
  'hobby_photographer',
  'new_to_wildlife',
  'creator_educator',
  'naturalist_conservation',
  'other',
]);
export type WaitlistRole = z.infer<typeof WaitlistRoleSchema>;

export const WaitlistPlatformSchema = z.enum(['ios', 'android', 'web', 'unsure']);
export type WaitlistPlatform = z.infer<typeof WaitlistPlatformSchema>;

export const WaitlistSourceSchema = z.enum(['landing', 'waitlist', 'landing-page']);
export type WaitlistSource = z.infer<typeof WaitlistSourceSchema>;

/**
 * Public waitlist signup body (POST /v1/waitlist).
 * Honeypot `company` must be empty or absent; filled → silent discard at the API.
 */
export const WaitlistSignupRequestSchema = z.object({
  email: z.string().trim().email().max(320),
  name: z.string().trim().max(120).optional(),
  regionSlug: WaitlistRegionSlugSchema.optional(),
  role: WaitlistRoleSchema.optional(),
  platform: WaitlistPlatformSchema.optional(),
  favouriteSpecies: z.string().trim().max(200).optional(),
  consent: z.literal(true),
  source: WaitlistSourceSchema.optional(),
  /** Honeypot — bots fill this; humans never see it. */
  company: z.string().max(200).optional(),
});
export type WaitlistSignupRequest = z.infer<typeof WaitlistSignupRequestSchema>;

export const WaitlistSignupOkSchema = z.object({
  ok: z.literal(true),
});
export type WaitlistSignupOk = z.infer<typeof WaitlistSignupOkSchema>;

export const WaitlistErrorCodeSchema = z.enum([
  'WAITLIST_DUPLICATE',
  'WAITLIST_RATE_LIMIT',
  'RATE_LIMIT',
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
]);
export type WaitlistErrorCode = z.infer<typeof WaitlistErrorCodeSchema>;

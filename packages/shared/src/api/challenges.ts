import { z } from 'zod';

import { CountryCodeSchema, IsoDateSchema, TaxonIdSchema } from './common.js';

export const ChallengeStatusSchema = z.enum(['draft', 'active', 'closed']);
export type ChallengeStatus = z.infer<typeof ChallengeStatusSchema>;

export const ChallengeCountryCountSchema = z.object({
  countryCode: CountryCodeSchema,
  count: z.number().int().nonnegative(),
});
export type ChallengeCountryCount = z.infer<typeof ChallengeCountryCountSchema>;

/** Challenge summary — no pins; counts per country only (ARCHITECTURE §7). */
export const ChallengeSummarySchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  taxonId: TaxonIdSchema,
  startsOn: IsoDateSchema,
  endsOn: IsoDateSchema,
  rulesMd: z.string().min(1),
  status: ChallengeStatusSchema,
  countryCounts: z.array(ChallengeCountryCountSchema),
});
export type ChallengeSummary = z.infer<typeof ChallengeSummarySchema>;

/** GET /v1/challenges/current · GET /v1/challenges/:slug */
export const ChallengeResponseSchema = ChallengeSummarySchema;
export type ChallengeResponse = z.infer<typeof ChallengeResponseSchema>;

/** Public gallery entry — country + region label only (No-Pin). */
export const ChallengeEntryPublicSchema = z.object({
  id: z.string().min(1),
  countryCode: CountryCodeSchema,
  regionLabel: z.string().min(1),
  photoUrl: z.string().url(),
  publishedAt: z.string().datetime(),
});
export type ChallengeEntryPublic = z.infer<typeof ChallengeEntryPublicSchema>;

/** GET /v1/challenges/:slug/entries query */
export const ChallengeEntriesQuerySchema = z.object({
  country: CountryCodeSchema.optional(),
  cursor: z.string().min(1).optional(),
});
export type ChallengeEntriesQuery = z.infer<typeof ChallengeEntriesQuerySchema>;

/** GET /v1/challenges/:slug/entries */
export const ChallengeEntriesResponseSchema = z.object({
  entries: z.array(ChallengeEntryPublicSchema),
  nextCursor: z.string().min(1).nullable(),
});
export type ChallengeEntriesResponse = z.infer<typeof ChallengeEntriesResponseSchema>;

/** POST /v1/challenges/:slug/entries */
export const ChallengeSubmitRequestSchema = z.object({
  logbookEntryId: z.string().min(1),
  pledgeAccepted: z.literal(true),
  countryCode: CountryCodeSchema,
  regionLabel: z.string().trim().min(1).max(200),
});
export type ChallengeSubmitRequest = z.infer<typeof ChallengeSubmitRequestSchema>;

export const ChallengeSubmitOkSchema = z.object({
  id: z.string().min(1),
  status: z.literal('pending'),
  publishAfter: z.string().datetime(),
});
export type ChallengeSubmitOk = z.infer<typeof ChallengeSubmitOkSchema>;

import { z } from 'zod';

import {
  H3CellSchema,
  LocaleSchema,
  RegionIdSchema,
  TaxonIdSchema,
  UserRoleSchema,
} from './common.js';

/** GET /v1/me — public profile fields (no coordinates). */
export const MeProfileSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().nullable(),
  homeRegionSlug: RegionIdSchema.nullable(),
  locale: LocaleSchema,
  role: UserRoleSchema,
});
export type MeProfile = z.infer<typeof MeProfileSchema>;

/** PATCH /v1/me body */
export const MePatchRequestSchema = z
  .object({
    displayName: z.string().trim().max(120).nullable().optional(),
    homeRegionSlug: RegionIdSchema.nullable().optional(),
    locale: LocaleSchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field is required',
  });
export type MePatchRequest = z.infer<typeof MePatchRequestSchema>;

/** DELETE /v1/me */
export const MeDeleteOkSchema = z.object({
  ok: z.literal(true),
  purgeAfterDays: z.literal(30),
});
export type MeDeleteOk = z.infer<typeof MeDeleteOkSchema>;

/** POST /v1/me/export */
export const MeExportOkSchema = z.object({
  status: z.enum(['queued', 'ready']),
  downloadUrl: z.string().url().nullable(),
});
export type MeExportOk = z.infer<typeof MeExportOkSchema>;

/** Watchlist entry — cell only, never lat/lng. */
export const WatchlistItemSchema = z.object({
  id: z.string().min(1),
  taxonId: TaxonIdSchema,
  cellR7: H3CellSchema,
  createdAt: z.string().datetime(),
});
export type WatchlistItem = z.infer<typeof WatchlistItemSchema>;

/** GET /v1/me/watchlist */
export const WatchlistResponseSchema = z.object({
  items: z.array(WatchlistItemSchema),
  limit: z.number().int().positive(),
});
export type WatchlistResponse = z.infer<typeof WatchlistResponseSchema>;

/** POST /v1/me/watchlist */
export const WatchlistCreateRequestSchema = z.object({
  taxonId: TaxonIdSchema,
  cellR7: H3CellSchema,
});
export type WatchlistCreateRequest = z.infer<typeof WatchlistCreateRequestSchema>;

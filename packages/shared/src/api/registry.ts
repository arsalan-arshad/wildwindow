import {
  AdminChallengeEntriesQuerySchema,
  AdminChallengeEntriesResponseSchema,
  AdminChallengeEntryPatchSchema,
  AdminChallengeEntrySchema,
  AdminIngestRunSchema,
  AdminIngestRunsResponseSchema,
  AdminSessionSchema,
  AdminSpeciesCardPatchSchema,
  AdminSpeciesCardSchema,
  AdminSpeciesQuerySchema,
  AdminSpeciesResponseSchema,
  AdminTaxonRegionPatchSchema,
  AdminTaxonRegionSchema,
} from './admin.js';
import { AreaResponseSchema } from './areas.js';
import { AttributionsResponseSchema } from './attributions.js';
import {
  ChallengeEntriesQuerySchema,
  ChallengeEntriesResponseSchema,
  ChallengeEntryPublicSchema,
  ChallengeResponseSchema,
  ChallengeSubmitOkSchema,
  ChallengeSubmitRequestSchema,
} from './challenges.js';
import { ApiErrorBodySchema } from './common.js';
import {
  ForecastLockoutSchema,
  ForecastNotCoveredSchema,
  ForecastOkSchema,
  ForecastQuerySchema,
  ForecastResponseSchema,
  ForecastUnavailableSchema,
} from './forecast.js';
import { HealthOkSchema } from './health.js';
import {
  LogbookCreateRequestSchema,
  LogbookEntryOwnerSchema,
  LogbookEntryPublicSchema,
  LogbookListResponseSchema,
  LogbookPatchRequestSchema,
  OwnerExactLocationSchema,
} from './logbook.js';
import {
  MeDeleteOkSchema,
  MeExportOkSchema,
  MePatchRequestSchema,
  MeProfileSchema,
  WatchlistCreateRequestSchema,
  WatchlistItemSchema,
  WatchlistResponseSchema,
} from './me.js';
import { PlaceSummarySchema, PlacesQuerySchema, PlacesResponseSchema } from './places.js';
import { RegionSummarySchema, RegionsResponseSchema } from './regions.js';
import {
  RegionSpeciesQuerySchema,
  RegionSpeciesResponseSchema,
  SeasonalityQuerySchema,
  SeasonalityResponseSchema,
  SpeciesDetailQuerySchema,
  SpeciesDetailSchema,
  SpeciesListItemSchema,
  SpeciesMapCellSchema,
  SpeciesMapQuerySchema,
  SpeciesMapResponseSchema,
} from './species.js';
import { PresignUploadRequestSchema, PresignUploadResponseSchema } from './uploads.js';
import { WaitlistSignupOkSchema, WaitlistSignupRequestSchema } from './waitlist.js';

import type { ZodTypeAny } from 'zod';

/**
 * Public request/response schemas for §7 endpoints.
 * Must never contain `FORBIDDEN_PUBLIC_KEYS` property names (T5.1).
 */
export const PUBLIC_API_SCHEMAS: readonly ZodTypeAny[] = [
  ApiErrorBodySchema,
  HealthOkSchema,
  RegionSummarySchema,
  RegionsResponseSchema,
  RegionSpeciesQuerySchema,
  SpeciesListItemSchema,
  RegionSpeciesResponseSchema,
  SpeciesDetailQuerySchema,
  SpeciesDetailSchema,
  SeasonalityQuerySchema,
  SeasonalityResponseSchema,
  SpeciesMapQuerySchema,
  SpeciesMapCellSchema,
  SpeciesMapResponseSchema,
  PlacesQuerySchema,
  PlaceSummarySchema,
  PlacesResponseSchema,
  AreaResponseSchema,
  ForecastQuerySchema,
  ForecastOkSchema,
  ForecastUnavailableSchema,
  ForecastLockoutSchema,
  ForecastNotCoveredSchema,
  ForecastResponseSchema,
  AttributionsResponseSchema,
  WaitlistSignupRequestSchema,
  WaitlistSignupOkSchema,
  MeProfileSchema,
  MePatchRequestSchema,
  MeDeleteOkSchema,
  MeExportOkSchema,
  WatchlistItemSchema,
  WatchlistResponseSchema,
  WatchlistCreateRequestSchema,
  PresignUploadRequestSchema,
  PresignUploadResponseSchema,
  LogbookEntryPublicSchema,
  LogbookListResponseSchema,
  ChallengeResponseSchema,
  ChallengeEntryPublicSchema,
  ChallengeEntriesQuerySchema,
  ChallengeEntriesResponseSchema,
  ChallengeSubmitRequestSchema,
  ChallengeSubmitOkSchema,
  AdminSessionSchema,
  AdminSpeciesQuerySchema,
  AdminSpeciesCardSchema,
  AdminSpeciesCardPatchSchema,
  AdminSpeciesResponseSchema,
  AdminTaxonRegionPatchSchema,
  AdminTaxonRegionSchema,
  AdminChallengeEntriesQuerySchema,
  AdminChallengeEntrySchema,
  AdminChallengeEntriesResponseSchema,
  AdminChallengeEntryPatchSchema,
  AdminIngestRunSchema,
  AdminIngestRunsResponseSchema,
];

/**
 * Owner-only schemas that may intentionally include exact coordinates
 * (`@OwnerLocation()` routes — T5.3 / T5.11). Excluded from the public-key guard.
 */
export const OWNER_API_SCHEMAS: readonly ZodTypeAny[] = [
  OwnerExactLocationSchema,
  LogbookEntryOwnerSchema,
  LogbookCreateRequestSchema,
  LogbookPatchRequestSchema,
];

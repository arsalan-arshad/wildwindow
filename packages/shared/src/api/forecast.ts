import { z } from 'zod';

import {
  ConfidenceSchema,
  ForecastStatusSchema,
  H3CellSchema,
  IsoDateSchema,
  LocalHmSchema,
  SensitivityTierSchema,
  TaxonIdSchema,
} from './common.js';

/** GET /v1/forecast query — cell is the device-snapped res-7 id (never lat/lng). */
export const ForecastQuerySchema = z.object({
  taxonId: TaxonIdSchema,
  cell: H3CellSchema,
  start: IsoDateSchema,
});
export type ForecastQuery = z.infer<typeof ForecastQuerySchema>;

export const TimeBlockSchema = z.object({
  start: LocalHmSchema,
  end: LocalHmSchema,
});
export type TimeBlock = z.infer<typeof TimeBlockSchema>;

export const DayFactorsSchema = z.object({
  seasonality: z.number().min(0).max(1),
  timeOfDay: z.number().min(0).max(1),
  light: z.number().min(0).max(1),
  weather: z.union([z.number().min(0).max(1), z.literal('no_forecast_yet')]),
  tide: z.union([z.number().min(0).max(1), z.literal('not_used')]),
});
export type DayFactors = z.infer<typeof DayFactorsSchema>;

export const DayLightWindowsSchema = z.object({
  goldenAm: z.tuple([LocalHmSchema, LocalHmSchema]).nullable(),
  goldenPm: z.tuple([LocalHmSchema, LocalHmSchema]).nullable(),
});
export type DayLightWindows = z.infer<typeof DayLightWindowsSchema>;

export const ForecastDaySchema = z.object({
  date: IsoDateSchema,
  score: z.number().int().min(0).max(100),
  bestBlock: TimeBlockSchema,
  factors: DayFactorsSchema,
  light: DayLightWindowsSchema,
});
export type ForecastDay = z.infer<typeof ForecastDaySchema>;

const ForecastBaseSchema = z.object({
  scoringVersion: z.literal('1.0'),
  taxonId: TaxonIdSchema,
  tier: SensitivityTierSchema,
  timeZone: z.string().min(1),
});

export const ForecastOkSchema = ForecastBaseSchema.extend({
  status: z.literal('ok'),
  displayCell: H3CellSchema,
  areaLabel: z.string().min(1),
  weekScore: z.number().int().min(0).max(100),
  bestDay: IsoDateSchema,
  confidence: ConfidenceSchema,
  range: z.tuple([z.number().int().min(0).max(100), z.number().int().min(0).max(100)]).nullable(),
  days: z.array(ForecastDaySchema).length(7),
  explanations: z.array(z.string().min(1)),
});
export type ForecastOk = z.infer<typeof ForecastOkSchema>;

export const ForecastUnavailableSchema = ForecastBaseSchema.extend({
  status: z.literal('unavailable'),
  displayCell: z.null(),
  areaLabel: z.string().nullable(),
  weekScore: z.null(),
  bestDay: z.null(),
  confidence: z.null(),
  range: z.null(),
  days: z.null(),
  explanations: z.array(z.string().min(1)),
});
export type ForecastUnavailable = z.infer<typeof ForecastUnavailableSchema>;

export const ForecastLockoutSchema = ForecastBaseSchema.extend({
  status: z.literal('lockout'),
  displayCell: H3CellSchema.nullable(),
  areaLabel: z.string().nullable(),
  weekScore: z.null(),
  bestDay: z.null(),
  confidence: z.null(),
  range: z.null(),
  days: z.null(),
  reason: z.string().min(1),
  explanations: z.array(z.string().min(1)),
});
export type ForecastLockout = z.infer<typeof ForecastLockoutSchema>;

export const ForecastNotCoveredSchema = ForecastBaseSchema.extend({
  status: z.literal('not_covered'),
  displayCell: z.null(),
  areaLabel: z.string().nullable(),
  weekScore: z.null(),
  bestDay: z.null(),
  confidence: z.null(),
  range: z.null(),
  days: z.null(),
  explanations: z.array(z.string().min(1)),
});
export type ForecastNotCovered = z.infer<typeof ForecastNotCoveredSchema>;

/** GET /v1/forecast response (ARCHITECTURE §7 example + status overrides). */
export const ForecastResponseSchema = z.discriminatedUnion('status', [
  ForecastOkSchema,
  ForecastUnavailableSchema,
  ForecastLockoutSchema,
  ForecastNotCoveredSchema,
]);
export type ForecastResponse = z.infer<typeof ForecastResponseSchema>;

// Re-export status enum for clients that import from forecast.
export { ForecastStatusSchema };
export type { ForecastStatus } from './common.js';

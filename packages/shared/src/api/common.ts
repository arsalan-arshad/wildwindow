import { z } from 'zod';

import {
  ActivityPatternSchema,
  RegionIdSchema,
  SensitivityTierSchema,
  SpeciesGroupSchema,
  TidePrefSchema,
} from '../data-schemas.js';

export {
  ActivityPatternSchema,
  RegionIdSchema,
  SensitivityTierSchema,
  SpeciesGroupSchema,
  TidePrefSchema,
};

/** Stable `{ code, message }` error body (ARCHITECTURE §7 / AGENTS). */
export const ApiErrorBodySchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;

/** ISO calendar date `YYYY-MM-DD`. */
export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export type IsoDate = z.infer<typeof IsoDateSchema>;

/** Local clock time `HH:MM` in the region's time zone. */
export const LocalHmSchema = z.string().regex(/^\d{2}:\d{2}$/);
export type LocalHm = z.infer<typeof LocalHmSchema>;

/** H3 cell id (hex string). Public responses never include finer cells than the tier allows. */
export const H3CellSchema = z.string().regex(/^[0-9a-f]+$/i).min(15);
export type H3Cell = z.infer<typeof H3CellSchema>;

/** Taxon wire id (stringified DB id or GBIF key — callers treat as opaque). */
export const TaxonIdSchema = z.string().min(1);
export type TaxonId = z.infer<typeof TaxonIdSchema>;

export const ConfidenceSchema = z.enum(['high', 'medium', 'low']);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const ForecastStatusSchema = z.enum(['ok', 'unavailable', 'lockout', 'not_covered']);
export type ForecastStatus = z.infer<typeof ForecastStatusSchema>;

export const UserRoleSchema = z.enum(['user', 'admin']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const LocaleSchema = z.enum(['en', 'ur']);
export type Locale = z.infer<typeof LocaleSchema>;

export const CountryCodeSchema = z.string().length(2);
export type CountryCode = z.infer<typeof CountryCodeSchema>;

export const CommonNamesSchema = z.object({
  en: z.string().min(1),
  ur: z.string().min(1).optional(),
});
export type CommonNames = z.infer<typeof CommonNamesSchema>;

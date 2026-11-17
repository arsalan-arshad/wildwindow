import { z } from 'zod';

/** Sensitivity tiers from PRD §9.2 / ARCHITECTURE §5.1. */
export const SensitivityTierSchema = z.enum([
  'open',
  'protected',
  'highly_protected',
  'no_forecast',
]);
export type SensitivityTier = z.infer<typeof SensitivityTierSchema>;

export const RegionIdSchema = z.enum(['scotland', 'sindh']);
export type RegionId = z.infer<typeof RegionIdSchema>;

export const BetaSpeciesEntrySchema = z.object({
  commonName: z.string().min(1),
  scientificName: z.string().min(1),
  region: RegionIdSchema,
  /** Filled by `pnpm data:resolve-taxa` in T2.7 — optional in Phase 0 stubs. */
  gbifTaxonKey: z.number().int().positive().optional(),
  resolvedAt: z.string().datetime().optional(),
});
export type BetaSpeciesEntry = z.infer<typeof BetaSpeciesEntrySchema>;

export const BetaSpeciesFileSchema = z.object({
  version: z.literal(1),
  species: z.array(BetaSpeciesEntrySchema).min(1),
});
export type BetaSpeciesFile = z.infer<typeof BetaSpeciesFileSchema>;

export const SensitiveSpeciesEntrySchema = z.object({
  scientificName: z.string().min(1),
  region: RegionIdSchema,
  tier: SensitivityTierSchema,
  /** Optional breeding lockout months 1–12 for protected / highly_protected. */
  lockoutMonths: z.array(z.number().int().min(1).max(12)).optional(),
  notes: z.string().optional(),
});
export type SensitiveSpeciesEntry = z.infer<typeof SensitiveSpeciesEntrySchema>;

export const SensitiveSpeciesFileSchema = z.object({
  version: z.literal(1),
  species: z.array(SensitiveSpeciesEntrySchema).min(1),
});
export type SensitiveSpeciesFile = z.infer<typeof SensitiveSpeciesFileSchema>;

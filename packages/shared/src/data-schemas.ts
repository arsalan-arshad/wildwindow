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

export const ActivityPatternSchema = z.enum(['diurnal', 'crepuscular', 'nocturnal', 'tidal']);
export type ActivityPattern = z.infer<typeof ActivityPatternSchema>;

export const TidePrefSchema = z.enum(['high', 'low', 'rising', 'falling', 'none']);
export type TidePref = z.infer<typeof TidePrefSchema>;

export const SpeciesGroupSchema = z.enum([
  'bird',
  'mammal',
  'marine',
  'reptile',
  'amphibian',
  'other',
]);
export type SpeciesGroup = z.infer<typeof SpeciesGroupSchema>;

/**
 * Beta species catalogue entry (ARCHITECTURE §3.3).
 * One row per taxon; `regions` lists beta coverage.
 */
export const BetaSpeciesEntrySchema = z.object({
  scientificName: z.string().min(1),
  commonNames: z.object({
    en: z.string().min(1),
    ur: z.string().min(1).optional(),
  }),
  group: SpeciesGroupSchema,
  /** Taxonomic class / effort proxy key (for example Aves, Mammalia). */
  effortGroup: z.string().min(1),
  regions: z.array(RegionIdSchema).min(1),
  coastal: z.boolean(),
  tidePref: TidePrefSchema.optional(),
  activityPattern: ActivityPatternSchema,
  challengeEligible: z.boolean(),
  /** Filled by `pnpm data:resolve-taxa` — required after resolution. */
  gbifTaxonKey: z.number().int().positive().optional(),
  resolvedAt: z.string().datetime().optional(),
  /** Present when match was not EXACT; listed for human review. */
  matchType: z.string().optional(),
  reviewNeeded: z.boolean().optional(),
});
export type BetaSpeciesEntry = z.infer<typeof BetaSpeciesEntrySchema>;

export const BetaSpeciesFileSchema = z
  .object({
    version: z.literal(1),
    species: z.array(BetaSpeciesEntrySchema).min(1),
  })
  .superRefine((file, ctx) => {
    const seen = new Set<string>();
    for (const [index, entry] of file.species.entries()) {
      const key = entry.scientificName.toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate scientificName: ${entry.scientificName}`,
          path: ['species', index, 'scientificName'],
        });
      }
      seen.add(key);
    }
  });
export type BetaSpeciesFile = z.infer<typeof BetaSpeciesFileSchema>;

export const SensitiveSpeciesEntrySchema = z.object({
  scientificName: z.string().min(1),
  region: RegionIdSchema,
  tier: SensitivityTierSchema,
  /** Optional breeding lockout months 1–12 for protected / highly_protected. */
  lockoutMonths: z.array(z.number().int().min(1).max(12)).optional(),
  notes: z.string().optional(),
  reviewer: z.string().optional(),
  reviewedAt: z.string().datetime().optional(),
});
export type SensitiveSpeciesEntry = z.infer<typeof SensitiveSpeciesEntrySchema>;

export const SensitiveSpeciesFileSchema = z.object({
  version: z.literal(1),
  species: z.array(SensitiveSpeciesEntrySchema).min(1),
});
export type SensitiveSpeciesFile = z.infer<typeof SensitiveSpeciesFileSchema>;

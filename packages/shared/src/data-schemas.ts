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

/**
 * YAML front-matter for `data/species-cards/<region>/<slug>.md` (ARCHITECTURE §3.3 / T8.1).
 * Region comes from the parent directory; markdown body becomes `body_md`.
 * `status` is derived: both `reviewedBy` and `reviewedAt` required for `reviewed`, else `draft`.
 */
export const SpeciesCardFrontMatterSchema = z.object({
  scientificName: z.string().min(1),
  settings: z.record(z.unknown()).default({}),
  ethicsMd: z.string().optional(),
  legalMd: z.string().optional(),
  reviewedBy: z.string().min(1).optional(),
  reviewedAt: z.string().datetime().optional(),
});
export type SpeciesCardFrontMatter = z.infer<typeof SpeciesCardFrontMatterSchema>;

export const SpeciesCardStatusSchema = z.enum(['draft', 'reviewed']);
export type SpeciesCardStatus = z.infer<typeof SpeciesCardStatusSchema>;

/** DB / ARCHITECTURE §6.2 challenge lifecycle (API maps `live` → `active`). */
export const ChallengeSeedStatusSchema = z.enum(['draft', 'live', 'closed']);
export type ChallengeSeedStatus = z.infer<typeof ChallengeSeedStatusSchema>;

/**
 * Seed file for a monthly challenge under `data/challenges/*.yaml` (T8.4).
 * `regions` documents the beta homes the challenge spans; the taxon must be
 * challenge-eligible there. Rules Markdown includes the ethics pledge text.
 */
export const ChallengeSeedSchema = z
  .object({
    version: z.literal(1),
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be kebab-case'),
    title: z.string().min(1),
    scientificName: z.string().min(1),
    regions: z.array(RegionIdSchema).min(1),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: ChallengeSeedStatusSchema,
    rulesMd: z.string().min(1),
  })
  .superRefine((file, ctx) => {
    if (file.endsOn < file.startsOn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endsOn must be on or after startsOn',
        path: ['endsOn'],
      });
    }
  });
export type ChallengeSeed = z.infer<typeof ChallengeSeedSchema>;

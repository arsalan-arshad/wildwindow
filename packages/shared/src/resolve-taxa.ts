import { readFile, writeFile } from 'node:fs/promises';

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { z } from 'zod';

import {
  BetaSpeciesFileSchema,
  type BetaSpeciesEntry,
  type BetaSpeciesFile,
} from './data-schemas.js';

const gbifMatchSchema = z.object({
  usageKey: z.number().int().positive().optional(),
  matchType: z.string().optional(),
  scientificName: z.string().optional(),
  canonicalName: z.string().optional(),
  status: z.string().optional(),
  confidence: z.number().optional(),
});

export type GbifMatchResult = z.infer<typeof gbifMatchSchema>;

export type MatchSpeciesFn = (scientificName: string) => Promise<GbifMatchResult>;

export type ResolveTaxaResult = {
  readonly file: BetaSpeciesFile;
  readonly exactCount: number;
  readonly reviewNeeded: readonly {
    scientificName: string;
    matchType: string;
    usageKey?: number;
  }[];
};

const GBIF_MATCH_URL = 'https://api.gbif.org/v1/species/match';

/** Live GBIF species match (ARCHITECTURE: never invent taxon keys). */
export async function matchSpeciesViaGbif(scientificName: string): Promise<GbifMatchResult> {
  const url = new URL(GBIF_MATCH_URL);
  url.searchParams.set('name', scientificName);
  url.searchParams.set('strict', 'true');
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GBIF match failed for ${scientificName}: HTTP ${String(response.status)}`);
  }
  const body: unknown = await response.json();
  return gbifMatchSchema.parse(body);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Resolve every beta species via GBIF match. EXACT → write gbifTaxonKey + resolvedAt.
 * Non-EXACT rows keep reviewNeeded=true and are listed for human review.
 */
export async function resolveBetaSpecies(
  file: BetaSpeciesFile,
  options: {
    matchSpecies?: MatchSpeciesFn;
    now?: Date;
    delayMs?: number;
  } = {},
): Promise<ResolveTaxaResult> {
  const matchSpecies = options.matchSpecies ?? matchSpeciesViaGbif;
  const now = options.now ?? new Date();
  const delayMs = options.delayMs ?? 110;
  const resolvedAt = now.toISOString();
  const reviewNeeded: {
    scientificName: string;
    matchType: string;
    usageKey?: number;
  }[] = [];

  const species: BetaSpeciesEntry[] = [];
  for (const [index, entry] of file.species.entries()) {
    if (index > 0 && delayMs > 0) {
      await sleep(delayMs);
    }
    const match = await matchSpecies(entry.scientificName);
    const matchType = match.matchType ?? 'NONE';
    if (matchType === 'EXACT' && match.usageKey !== undefined) {
      species.push({
        ...entry,
        gbifTaxonKey: match.usageKey,
        resolvedAt,
        matchType: 'EXACT',
        reviewNeeded: false,
      });
    } else {
      const reviewRow: {
        scientificName: string;
        matchType: string;
        usageKey?: number;
      } = {
        scientificName: entry.scientificName,
        matchType,
      };
      if (match.usageKey !== undefined) {
        reviewRow.usageKey = match.usageKey;
      }
      reviewNeeded.push(reviewRow);
      // Drop stale keys if re-resolving a fuzzy match.
      species.push({
        scientificName: entry.scientificName,
        commonNames: entry.commonNames,
        group: entry.group,
        effortGroup: entry.effortGroup,
        regions: entry.regions,
        coastal: entry.coastal,
        activityPattern: entry.activityPattern,
        challengeEligible: entry.challengeEligible,
        ...(entry.tidePref !== undefined ? { tidePref: entry.tidePref } : {}),
        matchType,
        reviewNeeded: true,
      });
    }
  }

  const exactCount = species.filter(
    (s) => s.matchType === 'EXACT' && s.gbifTaxonKey !== undefined,
  ).length;
  return {
    file: BetaSpeciesFileSchema.parse({ version: 1, species }),
    exactCount,
    reviewNeeded,
  };
}

export async function resolveTaxaFile(
  betaPath: string,
  options: {
    matchSpecies?: MatchSpeciesFn;
    now?: Date;
    delayMs?: number;
    write?: boolean;
  } = {},
): Promise<ResolveTaxaResult> {
  const raw: unknown = parseYaml(await readFile(betaPath, 'utf8'));
  const parsed = BetaSpeciesFileSchema.parse(raw);
  const result = await resolveBetaSpecies(parsed, options);
  if (options.write !== false) {
    await writeFile(betaPath, stringifyYaml(result.file, { lineWidth: 100 }), 'utf8');
  }
  return result;
}

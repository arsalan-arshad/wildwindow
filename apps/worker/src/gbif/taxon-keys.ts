import { readFile } from 'node:fs/promises';

import { BetaSpeciesFileSchema, type RegionId } from '@wildwindow/shared';
import { parse as parseYaml } from 'yaml';

import { taxonKeysForEffortGroup } from './effort-keys.js';

import type { IngestKind } from './predicate.js';

export type ResolveTaxonKeysInput = {
  readonly region: RegionId;
  readonly kind: IngestKind;
  readonly betaSpeciesPath: string;
};

/**
 * Resolve the TAXON_KEY list for a download request from beta-species.yaml.
 * - target: resolved gbifTaxonKey values for species covering the region
 * - effort: unique effort-group class keys for those species
 */
export async function resolveTaxonKeysForRequest(
  input: ResolveTaxonKeysInput,
): Promise<readonly number[]> {
  const raw: unknown = parseYaml(await readFile(input.betaSpeciesPath, 'utf8'));
  const file = BetaSpeciesFileSchema.parse(raw);
  const inRegion = file.species.filter((s) => s.regions.includes(input.region));

  if (input.kind === 'target') {
    const keys = inRegion
      .map((s) => s.gbifTaxonKey)
      .filter((k): k is number => typeof k === 'number' && Number.isInteger(k) && k > 0);
    if (keys.length === 0) {
      throw new Error(
        `No resolved gbifTaxonKey values for region ${input.region} in ${input.betaSpeciesPath}`,
      );
    }
    return [...new Set(keys)].sort((a, b) => a - b);
  }

  const groups = [...new Set(inRegion.map((s) => s.effortGroup))];
  if (groups.length === 0) {
    throw new Error(`No effort groups for region ${input.region} in ${input.betaSpeciesPath}`);
  }
  const keys = groups.flatMap((g) => [...taxonKeysForEffortGroup(g)]);
  return [...new Set(keys)].sort((a, b) => a - b);
}

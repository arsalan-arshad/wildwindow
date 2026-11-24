/**
 * Effort-group → GBIF taxon keys for sampling-effort downloads (§3.2).
 *
 * Looked up 2026-11-24 via GBIF species APIs (never invent keys from memory):
 * - Aves / Mammalia: GET /v1/species/match?name=…&rank=CLASS → EXACT
 * - Reptilia: retired as a class in CoL 2022; use successor classes
 *   Squamata (11592253), Testudines (11418114), Crocodylia (11493978)
 *   from GET /v1/species/match?name=…
 */

export const EFFORT_GROUP_TAXON_KEYS: Readonly<Record<string, readonly number[]>> = {
  Aves: [212],
  Mammalia: [359],
  Reptilia: [11_592_253, 11_418_114, 11_493_978],
};

export function taxonKeysForEffortGroup(effortGroup: string): readonly number[] {
  const keys = EFFORT_GROUP_TAXON_KEYS[effortGroup];
  if (keys === undefined) {
    throw new Error(
      `No GBIF taxon keys mapped for effort group "${effortGroup}". Add a looked-up mapping in effort-keys.ts.`,
    );
  }
  return keys;
}

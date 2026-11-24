import { describe, expect, it } from 'vitest';

import { BetaSpeciesFileSchema } from './data-schemas.js';
import { resolveBetaSpecies, type GbifMatchResult } from './resolve-taxa.js';

const fixture = BetaSpeciesFileSchema.parse({
  version: 1,
  species: [
    {
      scientificName: 'Alcedo atthis',
      commonNames: { en: 'Common kingfisher' },
      group: 'bird',
      effortGroup: 'Aves',
      regions: ['scotland', 'sindh'],
      coastal: false,
      activityPattern: 'diurnal',
      challengeEligible: true,
    },
    {
      scientificName: 'Fakeus inventus',
      commonNames: { en: 'Invented critter' },
      group: 'other',
      effortGroup: 'Animalia',
      regions: ['scotland'],
      coastal: false,
      activityPattern: 'diurnal',
      challengeEligible: false,
    },
  ],
});

describe('resolveBetaSpecies', () => {
  it('writes gbifTaxonKey only for EXACT matches and lists others for review', async () => {
    const matches: Record<string, GbifMatchResult> = {
      'Alcedo atthis': { usageKey: 2475443, matchType: 'EXACT', scientificName: 'Alcedo atthis' },
      'Fakeus inventus': { matchType: 'NONE' },
    };

    const result = await resolveBetaSpecies(fixture, {
      delayMs: 0,
      now: new Date('2026-11-17T12:00:00.000Z'),
      matchSpecies: (name) => {
        const match = matches[name];
        if (match === undefined) {
          return Promise.reject(new Error(`unexpected name ${name}`));
        }
        return Promise.resolve(match);
      },
    });

    expect(result.exactCount).toBe(1);
    expect(result.reviewNeeded).toEqual([{ scientificName: 'Fakeus inventus', matchType: 'NONE' }]);
    const kingfisher = result.file.species[0];
    expect(kingfisher?.gbifTaxonKey).toBe(2475443);
    expect(kingfisher?.resolvedAt).toBe('2026-11-17T12:00:00.000Z');
    expect(kingfisher?.matchType).toBe('EXACT');
    expect(result.file.species[1]?.reviewNeeded).toBe(true);
    expect(result.file.species[1]?.gbifTaxonKey).toBeUndefined();
  });
});

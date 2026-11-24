import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { resolveTaxonKeysForRequest } from './taxon-keys.js';

describe('resolveTaxonKeysForRequest', () => {
  let dir = '';

  afterEach(async () => {
    if (dir.length > 0) {
      await rm(dir, { recursive: true, force: true });
      dir = '';
    }
  });

  async function writeBeta(contents: string): Promise<string> {
    dir = await mkdtemp(path.join(tmpdir(), 'ww-taxa-'));
    const file = path.join(dir, 'beta.yaml');
    await writeFile(file, contents, 'utf8');
    return file;
  }

  it('returns sorted unique target keys for the region', async () => {
    const file = await writeBeta(`
version: 1
species:
  - scientificName: A
    commonNames: { en: A }
    group: bird
    effortGroup: Aves
    regions: [scotland, sindh]
    coastal: false
    activityPattern: diurnal
    challengeEligible: true
    gbifTaxonKey: 100
  - scientificName: B
    commonNames: { en: B }
    group: mammal
    effortGroup: Mammalia
    regions: [sindh]
    coastal: false
    activityPattern: nocturnal
    challengeEligible: false
    gbifTaxonKey: 50
`);
    await expect(
      resolveTaxonKeysForRequest({
        region: 'sindh',
        kind: 'target',
        betaSpeciesPath: file,
      }),
    ).resolves.toEqual([50, 100]);
  });

  it('maps effort groups to looked-up class keys', async () => {
    const file = await writeBeta(`
version: 1
species:
  - scientificName: A
    commonNames: { en: A }
    group: bird
    effortGroup: Aves
    regions: [scotland]
    coastal: false
    activityPattern: diurnal
    challengeEligible: true
    gbifTaxonKey: 100
  - scientificName: B
    commonNames: { en: B }
    group: reptile
    effortGroup: Reptilia
    regions: [scotland]
    coastal: false
    activityPattern: diurnal
    challengeEligible: false
    gbifTaxonKey: 200
`);
    const keys = await resolveTaxonKeysForRequest({
      region: 'scotland',
      kind: 'effort',
      betaSpeciesPath: file,
    });
    expect(keys).toEqual([212, 11_418_114, 11_493_978, 11_592_253]);
  });
});

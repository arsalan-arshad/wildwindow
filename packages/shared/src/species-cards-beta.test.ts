/**
 * T8.2: every beta taxon×region has a draft field card under data/species-cards/.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadSpeciesCardsFromDir } from './species-cards.js';
import { validateDataDir } from './validate-data.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const dataDir = path.join(repoRoot, 'data');
const cardsRoot = path.join(dataDir, 'species-cards');

function slugifyCommonName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

describe('T8.2 draft field cards (data/species-cards)', () => {
  it('loads a card for every beta species × region as draft with required scenes', async () => {
    const { betaSpecies } = validateDataDir(dataDir);
    const cards = await loadSpeciesCardsFromDir(cardsRoot);

    const byKey = new Map(
      cards.map((card) => [`${card.region}:${card.scientificName.toLowerCase()}`, card] as const),
    );

    const expectedKeys: string[] = [];
    for (const species of betaSpecies.species) {
      for (const region of species.regions) {
        expectedKeys.push(`${region}:${species.scientificName.toLowerCase()}`);
        const card = byKey.get(`${region}:${species.scientificName.toLowerCase()}`);
        expect(card, `missing card for ${species.scientificName} in ${region}`).toBeDefined();
        if (card === undefined) {
          continue;
        }
        expect(card.status).toBe('draft');
        expect(card.reviewedBy).toBeNull();
        expect(card.reviewedAt).toBeNull();
        expect(card.ethicsMd).toBeTruthy();
        expect(card.legalMd).toBeTruthy();
        expect(card.bodyMd).toMatch(/## Fieldcraft/i);
        expect(card.bodyMd).toMatch(/## Sources/i);
        expect(card.slug).toBe(slugifyCommonName(species.commonNames.en));

        const settings = card.settings as Record<string, unknown>;
        for (const scene of ['perched', 'flight', 'lowLight'] as const) {
          expect(settings[scene], `${card.slug} missing settings.${scene}`).toBeTypeOf('object');
          const block = settings[scene] as Record<string, unknown>;
          expect(block['shutter']).toBeTruthy();
          expect(block['aperture']).toBeTruthy();
          expect(block['iso']).toBeTruthy();
          expect(block['focusMode']).toBeTruthy();
          expect(block['driveMode']).toBeTruthy();
        }

        expect(card.ethicsMd ?? '').toMatch(/No baiting/i);
        expect(card.ethicsMd ?? '').toMatch(/playback/i);
        if (region === 'scotland') {
          expect(card.legalMd ?? '').toMatch(/NatureScot|Wildlife and Countryside/i);
        } else {
          expect(card.legalMd ?? '').toMatch(/Sindh|provincial|permit/i);
        }
      }
    }

    expect(cards.length).toBe(expectedKeys.length);
    expect(cards.every((card) => card.status === 'draft')).toBe(true);
  });

  it('lists only draft cards when none are reviewed (T8.2 list script contract)', async () => {
    const cards = await loadSpeciesCardsFromDir(cardsRoot);
    const drafts = cards.filter((card) => card.status === 'draft');
    expect(drafts.length).toBe(cards.length);
    expect(drafts.length).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from 'vitest';

import { scotlandReviewedSnapshot, sindhEmptySnapshot } from '@/__fixtures__/species-page';
import { collectReviewedSpeciesParams, resolveSpeciesSlug } from '@/lib/species-catalog';

describe('T7.3 reviewed species catalog', () => {
  it('generates a page path for every species with a reviewed card', () => {
    const params = collectReviewedSpeciesParams([scotlandReviewedSnapshot, sindhEmptySnapshot]);

    expect(params).toEqual([
      { region: 'scotland', species: 'common-kingfisher' },
      { region: 'scotland', species: 'eurasian-otter' },
    ]);
    // Draft / missing card must not produce a page.
    expect(params.some((p) => p.species.includes('squirrel'))).toBe(false);
  });

  it('resolves slugs back to reviewed details only', () => {
    const kingfisher = resolveSpeciesSlug(scotlandReviewedSnapshot, 'common-kingfisher');
    expect(kingfisher?.taxonId).toBe('1');
    expect(kingfisher?.detail.card?.reviewedBy).toBe('Test Reviewer');

    const missing = resolveSpeciesSlug(scotlandReviewedSnapshot, 'red-squirrel');
    expect(missing).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import { ogChallenge, ogChallengeEntry } from '@/__fixtures__/og-cards';
import { buildChallengeCardModel } from '@/lib/og/challenge-model';
import { textLooksLikeCellOrCoord } from '@/lib/og/public-safe';

describe('buildChallengeCardModel (T7.4)', () => {
  it('shows species and country+region place only (No-Pin)', () => {
    const model = buildChallengeCardModel({
      challenge: ogChallenge,
      entry: ogChallengeEntry,
      speciesName: 'Common kingfisher',
      siteHost: 'wildwindow.example.test',
    });

    expect(model.challengeTitle).toBe('Kingfisher Month');
    expect(model.speciesName).toBe('Common kingfisher');
    expect(model.placeLabel).toBe('Scotland, United Kingdom');
    expect(model.photoUrl).toBe(ogChallengeEntry.photoUrl);

    const copy = [model.challengeTitle, model.speciesName, model.placeLabel, model.siteHost].join(
      ' | ',
    );
    expect(textLooksLikeCellOrCoord(copy)).toBe(false);
    expect(copy).not.toMatch(/lat|lng|coordinate|H3|cell/i);
  });
});

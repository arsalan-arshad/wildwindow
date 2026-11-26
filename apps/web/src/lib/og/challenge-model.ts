import type { ChallengeEntryPublic, ChallengeResponse } from '@wildwindow/shared/api';

import { formatEntryPlace } from '@/lib/challenge';
import { assertCardCopyPublicSafe } from '@/lib/og/public-safe';

/** Public challenge share-card fields only (PRD US-14 / No-Pin). */
export type ChallengeCardModel = {
  readonly challengeTitle: string;
  readonly speciesName: string;
  readonly placeLabel: string;
  readonly photoUrl: string;
  readonly siteHost: string;
};

export function buildChallengeCardModel(input: {
  readonly challenge: ChallengeResponse;
  readonly entry: ChallengeEntryPublic;
  readonly speciesName: string;
  readonly siteHost: string;
}): ChallengeCardModel {
  const placeLabel = formatEntryPlace(input.entry.regionLabel, input.entry.countryCode);
  const model: ChallengeCardModel = {
    challengeTitle: input.challenge.title,
    speciesName: input.speciesName,
    placeLabel,
    photoUrl: input.entry.photoUrl,
    siteHost: input.siteHost,
  };

  assertCardCopyPublicSafe(
    [model.challengeTitle, model.speciesName, model.placeLabel, model.siteHost],
    'challenge card',
  );

  return model;
}

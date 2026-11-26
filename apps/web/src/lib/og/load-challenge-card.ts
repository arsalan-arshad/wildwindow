import type { ChallengeEntryPublic, ChallengeResponse } from '@wildwindow/shared/api';
import { RegionIdSchema } from '@wildwindow/shared/api';
import type { ApiClient } from '@wildwindow/shared/client';
import type { z } from 'zod';

import { buildChallengeCardModel, type ChallengeCardModel } from '@/lib/og/challenge-model';
import { siteHostFromUrl } from '@/lib/og/forecast-model';

type RegionId = z.infer<typeof RegionIdSchema>;

const REGION_FALLBACKS: readonly RegionId[] = RegionIdSchema.options;
/** Cap gallery walks so a missing id cannot spin forever. */
const MAX_ENTRY_PAGES = 25;

export async function loadChallengeCardModel(
  client: ApiClient,
  entryId: string,
  siteUrl: string,
  slugHint: string | null = null,
): Promise<ChallengeCardModel | null> {
  const challenge = await resolveChallenge(client, slugHint);
  if (challenge === null) {
    return null;
  }

  const entry = await findPublishedEntry(client, challenge.slug, entryId);
  if (entry === null) {
    return null;
  }

  const speciesName = await resolveChallengeSpeciesName(client, challenge);
  return buildChallengeCardModel({
    challenge,
    entry,
    speciesName,
    siteHost: siteHostFromUrl(siteUrl),
  });
}

async function resolveChallenge(
  client: ApiClient,
  slugHint: string | null,
): Promise<ChallengeResponse | null> {
  if (slugHint !== null && slugHint.length > 0) {
    try {
      return await client.challenges.get(slugHint);
    } catch {
      return null;
    }
  }
  try {
    return await client.challenges.current();
  } catch {
    return null;
  }
}

async function findPublishedEntry(
  client: ApiClient,
  slug: string,
  entryId: string,
): Promise<ChallengeEntryPublic | null> {
  let cursor: string | undefined;
  for (let page = 0; page < MAX_ENTRY_PAGES; page += 1) {
    const response = await client.challenges.entries(slug, cursor === undefined ? {} : { cursor });
    const hit = response.entries.find((row) => row.id === entryId);
    if (hit !== undefined) {
      return hit;
    }
    if (response.nextCursor === null) {
      return null;
    }
    cursor = response.nextCursor;
  }
  return null;
}

async function resolveChallengeSpeciesName(
  client: ApiClient,
  challenge: ChallengeResponse,
): Promise<string> {
  for (const region of REGION_FALLBACKS) {
    try {
      const detail = await client.species.get(challenge.taxonId, { region });
      return detail.commonNames.en;
    } catch {
      // try next
    }
  }
  for (const region of REGION_FALLBACKS) {
    try {
      const list = await client.regions.species(region);
      const hit = list.species.find((row) => row.taxonId === challenge.taxonId);
      if (hit !== undefined) {
        return hit.commonNames.en;
      }
    } catch {
      // continue
    }
  }
  // Challenge title is public and usually includes the species.
  return challenge.title;
}

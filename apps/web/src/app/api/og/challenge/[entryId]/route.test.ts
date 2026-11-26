/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ogChallenge, ogChallengeEntry, ogSpeciesDetail } from '@/__fixtures__/og-cards';
import { CHALLENGE_OG_SIZE, OG_CACHE_CONTROL } from '@/lib/og/constants';
import { isPng, readPngSize } from '@/lib/og/png';

const challengesCurrent = vi.fn();
const challengesGet = vi.fn();
const challengesEntries = vi.fn();
const speciesGet = vi.fn();

vi.mock('@/lib/api', () => ({
  tryGetServerApiClient: () => ({
    challenges: {
      current: challengesCurrent,
      get: challengesGet,
      entries: challengesEntries,
    },
    species: { get: speciesGet },
    regions: { species: vi.fn() },
  }),
  getSiteUrl: () => 'https://wildwindow.example.test',
}));

describe('GET /api/og/challenge/:entryId (T7.4)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns a 1080×1080 PNG for a published entry', async () => {
    challengesCurrent.mockResolvedValue(ogChallenge);
    challengesEntries.mockResolvedValue({ entries: [ogChallengeEntry], nextCursor: null });
    speciesGet.mockResolvedValue(ogSpeciesDetail);

    const { GET } = await import('./route');
    const request = new Request('https://web.test/api/og/challenge/101');
    const response = await GET(request, {
      params: Promise.resolve({ entryId: '101' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/image\/png/);
    expect(response.headers.get('cache-control')).toBe(OG_CACHE_CONTROL);

    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(isPng(bytes)).toBe(true);
    expect(readPngSize(bytes)).toEqual(CHALLENGE_OG_SIZE);
  });

  it('returns 404 when the entry is not in the published gallery', async () => {
    challengesCurrent.mockResolvedValue(ogChallenge);
    challengesEntries.mockResolvedValue({ entries: [], nextCursor: null });

    const { GET } = await import('./route');
    const response = await GET(new Request('https://web.test/api/og/challenge/missing'), {
      params: Promise.resolve({ entryId: 'missing' }),
    });
    expect(response.status).toBe(404);
  });
});

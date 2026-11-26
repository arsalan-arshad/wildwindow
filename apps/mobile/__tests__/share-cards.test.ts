import { snapToCell } from '@wildwindow/geoprivacy';

import {
  buildChallengeCardUrl,
  buildForecastCardUrl,
  buildShareCardUrl,
  cardUrlHasCoordinates,
  downloadAndShareCard,
} from '@/lib/share-cards';

const CELL = snapToCell(55.86, -4.25, 7);
const SITE = 'https://wildwindow.example.test';

describe('share card URLs (T6.11 / T10.2 QA)', () => {
  it('builds a forecast OG URL with taxonId, cell and start — no lat/lng', () => {
    const url = buildForecastCardUrl({ taxonId: '2481', cell: CELL, start: '2026-11-20' }, SITE);

    expect(url).toBe(
      `${SITE}/api/og/forecast?taxonId=2481&cell=${encodeURIComponent(CELL)}&start=2026-11-20`,
    );
    expect(cardUrlHasCoordinates(url)).toBe(false);
    expect(url).not.toMatch(/55\.86/);
    expect(url).not.toMatch(/-4\.25/);
    expect(url).not.toMatch(/lat=/i);
    expect(url).not.toMatch(/lng=/i);
    expect(url).not.toMatch(/longitude/i);
    expect(url).not.toMatch(/latitude/i);
  });

  it('builds a challenge OG URL with entryId (and optional slug) — no coordinates', () => {
    const url = buildChallengeCardUrl(
      { entryId: 'entry-42', slug: 'kingfisher-month-2026-11' },
      SITE,
    );

    expect(url).toBe(`${SITE}/api/og/challenge/entry-42?slug=kingfisher-month-2026-11`);
    expect(cardUrlHasCoordinates(url)).toBe(false);
  });

  it('Kingfisher Month go-live share URLs stay No-Pin (T10.2 QA)', () => {
    for (const entryId of ['101', '102', '103', '104', '105'] as const) {
      const url = buildChallengeCardUrl({ entryId, slug: 'kingfisher-month-2026-11' }, SITE);
      expect(url).toContain('/api/og/challenge/');
      expect(url).toContain('slug=kingfisher-month-2026-11');
      expect(cardUrlHasCoordinates(url)).toBe(false);
      expect(url).not.toMatch(/lat=/i);
      expect(url).not.toMatch(/lng=/i);
    }
  });

  it('detects coordinate-like fragments in a URL', () => {
    expect(
      cardUrlHasCoordinates('https://example.test/api/og/forecast?lat=55.865&lng=-4.257'),
    ).toBe(true);
    expect(cardUrlHasCoordinates(`${SITE}/api/og/challenge/abc`)).toBe(false);
  });

  it('rejects download when the card URL contains coordinates', async () => {
    await expect(
      downloadAndShareCard('https://example.test/card?lat=55.865&lng=-4.257'),
    ).rejects.toThrow(/coordinates/);
  });

  it('downloads the PNG and opens expo-sharing', async () => {
    const downloadAsync = jest.fn(async (_uri: string, fileUri: string) => ({
      uri: fileUri,
      status: 200,
      headers: {},
      mimeType: 'image/png',
    }));
    const shareAsync = jest.fn(async () => undefined);
    const isAvailableAsync = jest.fn(async () => true);

    const imageUrl = buildShareCardUrl(
      { kind: 'forecast', taxonId: '2481', cell: CELL, start: '2026-11-20' },
      SITE,
    );

    const result = await downloadAndShareCard(imageUrl, {
      downloadAsync,
      shareAsync,
      isAvailableAsync,
      cacheDirectory: '/cache/',
      now: () => 1_700_000_000_000,
    });

    expect(result).toBe('shared');
    expect(downloadAsync).toHaveBeenCalledWith(
      imageUrl,
      '/cache/wildwindow-share-1700000000000.png',
    );
    expect(shareAsync).toHaveBeenCalledWith('/cache/wildwindow-share-1700000000000.png', {
      mimeType: 'image/png',
      UTI: 'public.png',
      dialogTitle: 'WildWindow',
    });
  });
});

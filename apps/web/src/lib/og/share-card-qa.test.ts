/**
 * Share card QA for Kingfisher Month go-live (T10.2).
 * Dimensions, No-Pin copy, and Scotland / Sindh place lines — no network.
 *
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';

import {
  ogChallenge,
  ogChallengeEntry,
  ogForecastOk,
  OG_TINY_PNG_DATA_URL,
} from '@/__fixtures__/og-cards';
import { formatEntryPlace } from '@/lib/challenge';
import { buildChallengeCardModel } from '@/lib/og/challenge-model';
import { CHALLENGE_OG_SIZE, FORECAST_OG_SIZE, OG_CACHE_CONTROL } from '@/lib/og/constants';
import { renderChallengeCardImage } from '@/lib/og/challenge-image';
import { renderForecastCardImage } from '@/lib/og/forecast-image';
import { buildForecastCardModel } from '@/lib/og/forecast-model';
import { isPng, readPngSize } from '@/lib/og/png';
import { textLooksLikeCellOrCoord } from '@/lib/og/public-safe';

import type { ChallengeEntryPublic } from '@wildwindow/shared/api';

async function responseToBytes(response: Response): Promise<Uint8Array> {
  return new Uint8Array(await response.arrayBuffer());
}

const KINGFISHER_PLACES: readonly {
  readonly countryCode: string;
  readonly regionLabel: string;
  readonly expectPlace: string;
}[] = [
  { countryCode: 'GB', regionLabel: 'Scotland', expectPlace: 'Scotland, United Kingdom' },
  { countryCode: 'PK', regionLabel: 'Sindh', expectPlace: 'Sindh, Pakistan' },
];

describe('Share card QA — Kingfisher Month (T10.2)', () => {
  it('challenge dates on the fixture match the go-live seed window', () => {
    expect(ogChallenge.slug).toBe('kingfisher-month-2026-11');
    expect(ogChallenge.title).toBe('Kingfisher Month');
    expect(ogChallenge.startsOn).toBe('2026-11-01');
    expect(ogChallenge.endsOn).toBe('2026-11-30');
    expect(ogChallenge.status).toBe('active');
  });

  it('challenge cards are 1080×1080 PNGs for Scotland and Sindh place lines', async () => {
    for (const place of KINGFISHER_PLACES) {
      const entry: ChallengeEntryPublic = {
        ...ogChallengeEntry,
        id: `qa-${place.countryCode}`,
        countryCode: place.countryCode,
        regionLabel: place.regionLabel,
        photoUrl: OG_TINY_PNG_DATA_URL,
      };
      expect(formatEntryPlace(entry.regionLabel, entry.countryCode)).toBe(place.expectPlace);

      const model = buildChallengeCardModel({
        challenge: ogChallenge,
        entry,
        speciesName: 'Common kingfisher',
        siteHost: 'wildwindow.example.test',
      });
      expect(model.placeLabel).toBe(place.expectPlace);
      expect(textLooksLikeCellOrCoord(model.placeLabel)).toBe(false);
      expect(textLooksLikeCellOrCoord(model.speciesName)).toBe(false);
      expect(textLooksLikeCellOrCoord(model.challengeTitle)).toBe(false);

      const response = renderChallengeCardImage(model);
      expect(response.headers.get('cache-control')).toBe(OG_CACHE_CONTROL);
      const bytes = await responseToBytes(response);
      expect(isPng(bytes)).toBe(true);
      expect(readPngSize(bytes)).toEqual(CHALLENGE_OG_SIZE);
    }
  });

  it('forecast card stays 1080×1920 with area label only (no cell on the image model)', async () => {
    const model = buildForecastCardModel(
      ogForecastOk,
      { commonName: 'Common kingfisher', scientificName: 'Alcedo atthis' },
      'wildwindow.example.test',
    );
    expect(model.areaLabel).toBe(ogForecastOk.areaLabel);
    expect(textLooksLikeCellOrCoord(model.areaLabel)).toBe(false);
    expect(textLooksLikeCellOrCoord(model.commonName)).toBe(false);

    const response = renderForecastCardImage(model);
    const bytes = await responseToBytes(response);
    expect(isPng(bytes)).toBe(true);
    expect(readPngSize(bytes)).toEqual(FORECAST_OG_SIZE);
  });

  it('rejects challenge card copy that embeds coordinates (No-Pin)', () => {
    const toxic: ChallengeEntryPublic = {
      ...ogChallengeEntry,
      regionLabel: 'Scotland 55.865',
    };
    expect(() =>
      buildChallengeCardModel({
        challenge: ogChallenge,
        entry: toxic,
        speciesName: 'Common kingfisher',
        siteHost: 'wildwindow.example.test',
      }),
    ).toThrow(/coordinates|cells/i);
  });
});

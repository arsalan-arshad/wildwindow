/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';

import { ogChallenge, ogChallengeEntry, ogForecastOk } from '@/__fixtures__/og-cards';
import { buildChallengeCardModel } from '@/lib/og/challenge-model';
import { CHALLENGE_OG_SIZE, FORECAST_OG_SIZE, OG_CACHE_CONTROL } from '@/lib/og/constants';
import { renderChallengeCardImage } from '@/lib/og/challenge-image';
import { renderForecastCardImage } from '@/lib/og/forecast-image';
import { buildForecastCardModel } from '@/lib/og/forecast-model';
import { isPng, readPngSize } from '@/lib/og/png';

async function responseToBytes(response: Response): Promise<Uint8Array> {
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

describe('OG ImageResponse renderers (T7.4 / W-05)', () => {
  it('forecast card returns a 1080×1920 PNG with edge cache headers', async () => {
    const model = buildForecastCardModel(
      ogForecastOk,
      { commonName: 'Common kingfisher', scientificName: 'Alcedo atthis' },
      'wildwindow.example.test',
    );
    const response = renderForecastCardImage(model);
    expect(response.headers.get('content-type')).toMatch(/image\/png/);
    expect(response.headers.get('cache-control')).toBe(OG_CACHE_CONTROL);

    const bytes = await responseToBytes(response);
    expect(isPng(bytes)).toBe(true);
    expect(readPngSize(bytes)).toEqual(FORECAST_OG_SIZE);
  });

  it('challenge card returns a 1080×1080 PNG with edge cache headers', async () => {
    const model = buildChallengeCardModel({
      challenge: ogChallenge,
      entry: ogChallengeEntry,
      speciesName: 'Common kingfisher',
      siteHost: 'wildwindow.example.test',
    });
    const response = renderChallengeCardImage(model);
    expect(response.headers.get('content-type')).toMatch(/image\/png/);
    expect(response.headers.get('cache-control')).toBe(OG_CACHE_CONTROL);

    const bytes = await responseToBytes(response);
    expect(isPng(bytes)).toBe(true);
    expect(readPngSize(bytes)).toEqual(CHALLENGE_OG_SIZE);
  });
});

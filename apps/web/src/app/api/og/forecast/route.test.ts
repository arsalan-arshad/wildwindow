/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OG_FORECAST_CELL, ogForecastOk, ogSpeciesDetail } from '@/__fixtures__/og-cards';
import { FORECAST_OG_SIZE, OG_CACHE_CONTROL } from '@/lib/og/constants';
import { isPng, readPngSize } from '@/lib/og/png';

const forecastGet = vi.fn();
const speciesGet = vi.fn();
const areasGet = vi.fn();

vi.mock('@/lib/api', () => ({
  tryGetServerApiClient: () => ({
    forecast: { get: forecastGet },
    species: { get: speciesGet },
    areas: { get: areasGet },
    regions: { species: vi.fn() },
  }),
  getSiteUrl: () => 'https://wildwindow.example.test',
}));

describe('GET /api/og/forecast (T7.4)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns a 1080×1920 PNG; card uses areaLabel and Window score (never cell)', async () => {
    forecastGet.mockResolvedValue(ogForecastOk);
    areasGet.mockResolvedValue({
      cellR7: OG_FORECAST_CELL,
      label: 'Glasgow · Kelvin area',
      regionSlug: 'scotland',
      covered: true,
    });
    speciesGet.mockResolvedValue(ogSpeciesDetail);

    const { GET } = await import('./route');
    const request = new Request(
      `https://web.test/api/og/forecast?taxonId=42&cell=${OG_FORECAST_CELL}&start=2026-11-16`,
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/image\/png/);
    expect(response.headers.get('cache-control')).toBe(OG_CACHE_CONTROL);

    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(isPng(bytes)).toBe(true);
    expect(readPngSize(bytes)).toEqual(FORECAST_OG_SIZE);

    expect(forecastGet).toHaveBeenCalledWith({
      taxonId: '42',
      cell: OG_FORECAST_CELL,
      start: '2026-11-16',
    });
    // Query cell is for the API only — must never equal the public area label.
    expect(ogForecastOk.areaLabel).not.toContain(OG_FORECAST_CELL);
    expect(ogForecastOk.areaLabel).toBe('Glasgow · Kelvin area');
  });

  it('rejects missing query params', async () => {
    const { GET } = await import('./route');
    const response = await GET(new Request('https://web.test/api/og/forecast'));
    expect(response.status).toBe(400);
  });
});

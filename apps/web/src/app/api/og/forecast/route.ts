import { NextResponse } from 'next/server';

import { getSiteUrl, tryGetServerApiClient } from '@/lib/api';
import { renderForecastCardImage } from '@/lib/og/forecast-image';
import { loadForecastCardModel, parseForecastOgQuery } from '@/lib/og/load-forecast-card';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * W-05 / T7.4 — Story-format forecast share card (1080×1920).
 * Query: taxonId, cell (device-snapped res-7), start (YYYY-MM-DD).
 * PNG shows areaLabel + "Window score" only — never cell ids or coordinates.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const query = parseForecastOgQuery(url.searchParams);
  if (query === null) {
    return NextResponse.json(
      { code: 'INVALID_QUERY', message: 'taxonId, cell and start are required' },
      { status: 400 },
    );
  }

  const client = tryGetServerApiClient();
  if (client === null) {
    return NextResponse.json(
      { code: 'API_UNCONFIGURED', message: 'NEXT_PUBLIC_API_URL is not configured' },
      { status: 503 },
    );
  }

  try {
    const model = await loadForecastCardModel(client, query, getSiteUrl());
    if (model === null) {
      return NextResponse.json(
        { code: 'FORECAST_UNAVAILABLE', message: 'Forecast is not available to share' },
        { status: 404 },
      );
    }
    return renderForecastCardImage(model);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to render forecast card';
    return NextResponse.json({ code: 'OG_RENDER_FAILED', message }, { status: 502 });
  }
}

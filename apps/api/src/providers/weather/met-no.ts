import { z } from 'zod';

import { resolveProviderPrecipProb } from './precip.js';

import type { HourlyWeather, WeatherFetchResult, WeatherProvider } from './types.js';

const DEFAULT_BASE_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';

const MetNoTimeseriesSchema = z.object({
  time: z.string(),
  data: z.object({
    instant: z.object({
      details: z.object({
        wind_speed: z.number().optional(),
        cloud_area_fraction: z.number().optional(),
      }),
    }),
    next_1_hours: z
      .object({
        details: z
          .object({
            precipitation_amount: z.number().optional(),
            probability_of_precipitation: z.number().optional(),
          })
          .optional(),
      })
      .optional(),
  }),
});

const MetNoResponseSchema = z.object({
  properties: z.object({
    timeseries: z.array(MetNoTimeseriesSchema),
  }),
});

export type MetNoProviderOptions = {
  readonly userAgent: string;
  readonly baseUrl?: string;
  readonly fetch?: typeof fetch;
  readonly now?: () => Date;
};

/**
 * MET Norway Locationforecast 2.0 compact (ARCHITECTURE §3.4 / T4.7).
 * Requires an identifying `User-Agent` and honours the `Expires` response header.
 */
export class MetNoProvider implements WeatherProvider {
  readonly id = 'metno' as const;
  private readonly userAgent: string;
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly now: () => Date;

  constructor(options: MetNoProviderOptions) {
    const ua = options.userAgent.trim();
    if (ua.length === 0) {
      throw new Error('WEATHER_USER_AGENT is required for MetNoProvider');
    }
    this.userAgent = ua;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetcher = options.fetch ?? fetch;
    this.now = options.now ?? (() => new Date());
  }

  async hourly(
    lat: number,
    lng: number,
    fromUtc: Date,
    hours: number,
  ): Promise<WeatherFetchResult> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));

    const response = await this.fetcher(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'user-agent': this.userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`MET Norway weather request failed: HTTP ${String(response.status)}`);
    }

    const expiresAt = parseExpiresHeader(response.headers.get('expires'), this.now());
    const json: unknown = await response.json();
    const parsed = MetNoResponseSchema.parse(json);
    const fromMs = fromUtc.getTime();
    const untilMs = fromMs + hours * 60 * 60 * 1000;

    const out: HourlyWeather[] = [];
    for (const entry of parsed.properties.timeseries) {
      const at = Date.parse(entry.time);
      if (Number.isNaN(at) || at < fromMs || at >= untilMs) {
        continue;
      }
      const next = entry.data.next_1_hours?.details;
      const precipMm = next?.precipitation_amount ?? 0;
      const rawProb =
        next?.probability_of_precipitation !== undefined
          ? next.probability_of_precipitation / 100
          : null;
      const windMs = entry.data.instant.details.wind_speed ?? 0;
      const cloudPct = entry.data.instant.details.cloud_area_fraction ?? 0;
      out.push({
        timeUtc: new Date(at).toISOString(),
        precipProb: resolveProviderPrecipProb({ precipProb: rawProb, precipMm }),
        precipMm,
        windKph: windMs * 3.6,
        cloudPct,
      });
    }

    return { hours: out, expiresAt };
  }
}

export function parseExpiresHeader(raw: string | null, now: Date): Date | null {
  if (raw === null || raw.trim() === '') {
    return null;
  }
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) {
    return null;
  }
  const expires = new Date(parsed);
  // Ignore already-expired headers — fall back to default TTL at cache layer.
  if (expires.getTime() <= now.getTime()) {
    return null;
  }
  return expires;
}

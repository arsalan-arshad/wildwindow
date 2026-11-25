import { Logger } from '@nestjs/common';
import { z } from 'zod';

import { resolveProviderPrecipProb } from './precip.js';

import type { HourlyWeather, WeatherFetchResult, WeatherProvider } from './types.js';

const DEFAULT_BASE_URL = 'https://api.open-meteo.com/v1/forecast';

const OpenMeteoResponseSchema = z.object({
  hourly: z.object({
    time: z.array(z.string()),
    precipitation_probability: z.array(z.number().nullable()).optional(),
    precipitation: z.array(z.number().nullable()).optional(),
    wind_speed_10m: z.array(z.number().nullable()).optional(),
    cloud_cover: z.array(z.number().nullable()).optional(),
  }),
});

export type OpenMeteoProviderOptions = {
  readonly baseUrl?: string;
  readonly fetch?: typeof fetch;
  readonly nodeEnv?: string;
  readonly logger?: Pick<Logger, 'warn'>;
};

/**
 * Open-Meteo forecast API — **development / tests only** (ARCHITECTURE §3.4 / T4.7).
 * Logs a warning when constructed under `NODE_ENV=production`.
 */
export class OpenMeteoProvider implements WeatherProvider {
  readonly id = 'openmeteo' as const;
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;

  constructor(options: OpenMeteoProviderOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetcher = options.fetch ?? fetch;
    const nodeEnv = options.nodeEnv ?? process.env['NODE_ENV'] ?? 'development';
    if (nodeEnv === 'production') {
      const logger = options.logger ?? new Logger(OpenMeteoProvider.name);
      logger.warn(
        'OpenMeteoProvider is for development only (non-commercial free tier). Prefer MetNoProvider in production.',
      );
    }
  }

  async hourly(
    lat: number,
    lng: number,
    fromUtc: Date,
    hours: number,
  ): Promise<WeatherFetchResult> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lng));
    url.searchParams.set(
      'hourly',
      'precipitation_probability,precipitation,wind_speed_10m,cloud_cover',
    );
    url.searchParams.set('wind_speed_unit', 'kmh');
    url.searchParams.set('timezone', 'UTC');
    url.searchParams.set('forecast_hours', String(Math.max(hours, 1)));

    const response = await this.fetcher(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Open-Meteo weather request failed: HTTP ${String(response.status)}`);
    }

    const json: unknown = await response.json();
    const parsed = OpenMeteoResponseSchema.parse(json);
    const fromMs = fromUtc.getTime();
    const untilMs = fromMs + hours * 60 * 60 * 1000;

    const times = parsed.hourly.time;
    const probs = parsed.hourly.precipitation_probability;
    const precips = parsed.hourly.precipitation;
    const winds = parsed.hourly.wind_speed_10m;
    const clouds = parsed.hourly.cloud_cover;

    const out: HourlyWeather[] = [];
    for (let i = 0; i < times.length; i += 1) {
      const timeStr = times[i];
      if (timeStr === undefined) {
        continue;
      }
      // Open-Meteo times are local-UTC ISO without Z; force UTC parse.
      const at = Date.parse(timeStr.endsWith('Z') ? timeStr : `${timeStr}Z`);
      if (Number.isNaN(at) || at < fromMs || at >= untilMs) {
        continue;
      }
      const precipMm = precips?.[i] ?? 0;
      const rawProbPct = probs?.[i];
      const precipProb = resolveProviderPrecipProb({
        precipProb: rawProbPct === null || rawProbPct === undefined ? null : rawProbPct / 100,
        precipMm,
      });
      out.push({
        timeUtc: new Date(at).toISOString(),
        precipProb,
        precipMm,
        windKph: winds?.[i] ?? 0,
        cloudPct: clouds?.[i] ?? 0,
      });
    }

    // Open-Meteo free tier has no Expires header — cache layer uses the 1h default.
    return { hours: out, expiresAt: null };
  }
}

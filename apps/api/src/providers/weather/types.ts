import { z } from 'zod';

/** Provider ids including the in-process mock (ARCHITECTURE §3.4 + T4.7). */
export const WeatherProviderIdSchema = z.enum(['metno', 'openmeteo', 'mock']);
export type WeatherProviderId = z.infer<typeof WeatherProviderIdSchema>;

/** Hourly weather row for scoring / cache (ARCHITECTURE §3.4). */
export type HourlyWeather = {
  readonly timeUtc: string;
  /** 0..1 — derived from precipMm when the provider omits probability. */
  readonly precipProb: number;
  readonly precipMm: number;
  readonly windKph: number;
  readonly cloudPct: number;
};

export const HourlyWeatherSchema = z.object({
  timeUtc: z.string().datetime(),
  precipProb: z.number().min(0).max(1),
  precipMm: z.number().nonnegative(),
  windKph: z.number().nonnegative(),
  cloudPct: z.number().min(0).max(100),
});

export type WeatherFetchResult = {
  readonly hours: readonly HourlyWeather[];
  /** Absolute expiry from the provider `Expires` header, when present. */
  readonly expiresAt: Date | null;
};

/**
 * Network weather provider (ARCHITECTURE §3.4).
 * Callers must pass the **res-5 cell centre**, never a user pin.
 */
export interface WeatherProvider {
  readonly id: WeatherProviderId;
  hourly(lat: number, lng: number, fromUtc: Date, hours: number): Promise<WeatherFetchResult>;
}

/** Default cache TTL when the provider does not send `Expires` (§3.4). */
export const WEATHER_CACHE_DEFAULT_TTL_MS = 60 * 60 * 1000;

/** H3 resolution used for weather cache keys. */
export const WEATHER_CACHE_RES = 5;

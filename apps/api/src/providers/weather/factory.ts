import { MetNoProvider } from './met-no.js';
import { MockProvider } from './mock.js';
import { OpenMeteoProvider } from './open-meteo.js';
import { WeatherProviderIdSchema, type WeatherProvider, type WeatherProviderId } from './types.js';

export type CreateWeatherProviderOptions = {
  readonly id: WeatherProviderId;
  readonly userAgent?: string;
  readonly nodeEnv?: string;
  readonly metNoBaseUrl?: string;
  readonly openMeteoBaseUrl?: string;
  readonly fetch?: typeof fetch;
};

/**
 * Resolve `WEATHER_PROVIDER` with production default `metno` and
 * development/test default `openmeteo` (AGENTS.md / ARCHITECTURE §3.4).
 */
export function resolveWeatherProviderId(
  raw: string | undefined,
  nodeEnv: string,
): WeatherProviderId {
  const normalized = (raw ?? '').trim().toLowerCase();
  if (normalized === '') {
    return nodeEnv === 'production' ? 'metno' : 'openmeteo';
  }
  return WeatherProviderIdSchema.parse(normalized);
}

export function createWeatherProvider(options: CreateWeatherProviderOptions): WeatherProvider {
  switch (options.id) {
    case 'metno': {
      const userAgent = options.userAgent?.trim() ?? '';
      if (userAgent.length === 0) {
        throw new Error('WEATHER_USER_AGENT is required when WEATHER_PROVIDER=metno');
      }
      return new MetNoProvider({
        userAgent,
        ...(options.metNoBaseUrl !== undefined ? { baseUrl: options.metNoBaseUrl } : {}),
        ...(options.fetch !== undefined ? { fetch: options.fetch } : {}),
      });
    }
    case 'openmeteo':
      return new OpenMeteoProvider({
        ...(options.openMeteoBaseUrl !== undefined ? { baseUrl: options.openMeteoBaseUrl } : {}),
        ...(options.fetch !== undefined ? { fetch: options.fetch } : {}),
        ...(options.nodeEnv !== undefined ? { nodeEnv: options.nodeEnv } : {}),
      });
    case 'mock':
      return new MockProvider();
    default: {
      const _exhaustive: never = options.id;
      throw new Error(`Unsupported weather provider: ${String(_exhaustive)}`);
    }
  }
}

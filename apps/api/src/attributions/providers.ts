import { resolveWeatherProviderId } from '../providers/weather/factory.js';

import type { AttributionProvider } from '@wildwindow/shared';

export type AttributionProviderEnv = {
  readonly weatherProvider?: string | undefined;
  readonly tideProvider?: string | undefined;
  readonly nodeEnv: string;
};

const GEO_PROVIDERS: readonly AttributionProvider[] = [
  {
    id: 'geonames',
    name: 'GeoNames',
    credit: 'Place names © GeoNames (CC BY 4.0).',
    url: 'https://www.geonames.org/',
  },
  {
    id: 'natural-earth',
    name: 'Natural Earth',
    credit: 'Region boundary polygons from Natural Earth (public domain).',
    url: 'https://www.naturalearthdata.com/',
  },
  {
    id: 'suncalc',
    name: 'suncalc',
    credit: 'Sunrise, sunset and golden-hour times via the suncalc library (BSD-2-Clause).',
    url: 'https://github.com/mourner/suncalc',
  },
];

function weatherProviderCredit(
  weatherProvider: string | undefined,
  nodeEnv: string,
): AttributionProvider {
  const id = resolveWeatherProviderId(weatherProvider, nodeEnv);
  switch (id) {
    case 'metno':
      return {
        id: 'weather-metno',
        name: 'MET Norway',
        credit:
          'Weather forecasts from the Norwegian Meteorological Institute (api.met.no). Attribution required.',
        url: 'https://www.met.no/en',
      };
    case 'openmeteo':
      return {
        id: 'weather-openmeteo',
        name: 'Open-Meteo',
        credit:
          'Weather forecasts from Open-Meteo (development and non-commercial use unless a commercial plan is in place).',
        url: 'https://open-meteo.com/',
      };
    case 'mock':
      return {
        id: 'weather-mock',
        name: 'Mock weather',
        credit: 'Mock weather provider used for offline tests only.',
      };
    default: {
      const _exhaustive: never = id;
      throw new Error(`Unsupported weather provider: ${String(_exhaustive)}`);
    }
  }
}

function tideProviderCredit(tideProvider: string | undefined): AttributionProvider {
  const normalized = (tideProvider ?? 'none').trim().toLowerCase() || 'none';
  if (normalized === 'none') {
    return {
      id: 'tide-none',
      name: 'Tides',
      credit:
        'Tide data is not used in the MVP (NoTideProvider). Coastal tide credits will appear when a licensed provider is enabled.',
    };
  }
  return {
    id: `tide-${normalized}`,
    name: 'Tides',
    credit: `Tide data via provider "${normalized}".`,
  };
}

/**
 * Static + env-selected provider credits for GET /v1/attributions (T5.15 / ARCHITECTURE §3.1).
 * Pure: no I/O.
 */
export function buildAttributionProviders(env: AttributionProviderEnv): AttributionProvider[] {
  return [
    weatherProviderCredit(env.weatherProvider, env.nodeEnv),
    tideProviderCredit(env.tideProvider),
    ...GEO_PROVIDERS,
  ];
}

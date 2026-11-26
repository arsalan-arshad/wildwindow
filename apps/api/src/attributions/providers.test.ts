import { describe, expect, it } from 'vitest';

import { buildAttributionProviders } from './providers.js';

describe('buildAttributionProviders', () => {
  it('credits MET Norway in production by default', () => {
    const providers = buildAttributionProviders({ nodeEnv: 'production' });
    expect(providers.map((p) => p.id)).toEqual([
      'weather-metno',
      'tide-none',
      'geonames',
      'natural-earth',
      'suncalc',
    ]);
    expect(providers[0]?.url).toContain('met.no');
  });

  it('credits Open-Meteo outside production by default', () => {
    const providers = buildAttributionProviders({ nodeEnv: 'test' });
    expect(providers[0]?.id).toBe('weather-openmeteo');
  });

  it('honours an explicit weather provider id', () => {
    const providers = buildAttributionProviders({
      weatherProvider: 'mock',
      tideProvider: 'none',
      nodeEnv: 'production',
    });
    expect(providers[0]?.id).toBe('weather-mock');
    expect(providers[1]?.id).toBe('tide-none');
    expect(providers[1]?.credit).toMatch(/not used/i);
  });

  it('includes GeoNames, Natural Earth and suncalc credits', () => {
    const providers = buildAttributionProviders({ nodeEnv: 'development' });
    const byId = Object.fromEntries(providers.map((p) => [p.id, p]));
    expect(byId['geonames']?.credit).toMatch(/GeoNames/);
    expect(byId['natural-earth']?.credit).toMatch(/Natural Earth/);
    expect(byId['suncalc']?.credit).toMatch(/suncalc/);
  });
});

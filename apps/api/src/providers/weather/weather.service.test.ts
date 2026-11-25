import { cellToLatLng, latLngToCell } from 'h3-js';
import { describe, expect, it, vi } from 'vitest';

import { weatherCellCentre } from './cell-centre.js';
import { resolveWeatherProviderId } from './factory.js';
import { MockProvider } from './mock.js';
import { WeatherService } from './weather.service.js';

describe('weatherCellCentre / WeatherService (T4.7)', () => {
  it('calls the provider with the res-5 cell centre, not the input point', async () => {
    // A point inside a res-7 cell that is not the res-5 parent centre.
    const inputLat = 55.861_234;
    const inputLng = -4.251_987;
    const cellR7 = latLngToCell(inputLat, inputLng, 7);
    const { cellR5, lat: centreLat, lng: centreLng } = weatherCellCentre(cellR7);
    const [checkLat, checkLng] = cellToLatLng(cellR5);

    expect(centreLat).toBeCloseTo(checkLat, 8);
    expect(centreLng).toBeCloseTo(checkLng, 8);
    // Input pin must differ from the centre we will call with.
    expect(Math.abs(inputLat - centreLat) + Math.abs(inputLng - centreLng)).toBeGreaterThan(1e-5);

    const onHourly = vi.fn();
    const provider = new MockProvider({
      onHourly,
      hours: [
        {
          timeUtc: '2026-11-25T12:00:00.000Z',
          precipProb: 0.1,
          precipMm: 0,
          windKph: 10,
          cloudPct: 20,
        },
      ],
    });

    const service = new WeatherService(provider, null);
    await service.hourlyForCell(cellR7, new Date('2026-11-25T12:00:00Z'), 1);

    expect(onHourly).toHaveBeenCalledOnce();
    const [calledLat, calledLng] = onHourly.mock.calls[0] as [number, number, Date, number];
    expect(calledLat).toBeCloseTo(centreLat, 8);
    expect(calledLng).toBeCloseTo(centreLng, 8);
    expect(calledLat).not.toBeCloseTo(inputLat, 5);
    expect(calledLng).not.toBeCloseTo(inputLng, 5);
  });
});

describe('resolveWeatherProviderId', () => {
  it('defaults to metno in production and openmeteo otherwise', () => {
    expect(resolveWeatherProviderId(undefined, 'production')).toBe('metno');
    expect(resolveWeatherProviderId('', 'development')).toBe('openmeteo');
    expect(resolveWeatherProviderId('mock', 'production')).toBe('mock');
  });
});

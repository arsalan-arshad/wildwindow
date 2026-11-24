import { describe, expect, it } from 'vitest';

import {
  isKeptGeonameFeature,
  parseGeonameLine,
  placeKindFor,
  readGeonameDump,
} from './geonames.js';
import { placesFixturePath } from './seed-places.js';

const glasgowLine =
  '2648579\tGlasgow\tGlasgow\tGLA,Glaschu\t55.86515\t-4.25763\tP\tPPLA2\tGB\t\tSCT\tV2\t\t\t626410\t\t40\tEurope/London\t2023-02-25';

const airportLine =
  '2657865\tGlasgow\tGlasgow\tAbbotsinch,Glasgow\t55.87173\t-4.43364\tS\tAIRP\tGB\t\tSCT\tW2\t\t\t0\t\t2\tEurope/London\t2017-10-03';

const parkLine =
  '2651472\tDawsholm Park\tDawsholm Park\tDawsholm Park\t55.9\t-4.31667\tL\tPRK\tGB\t\tSCT\t\t\t\t0\t\t40\tEurope/London\t2012-01-17';

describe('geonames parse (T2.8)', () => {
  it('keeps populated places and parks only', () => {
    expect(isKeptGeonameFeature('P', 'PPLA2')).toBe(true);
    expect(isKeptGeonameFeature('L', 'PRK')).toBe(true);
    expect(isKeptGeonameFeature('S', 'AIRP')).toBe(false);
    expect(isKeptGeonameFeature('L', 'PRT')).toBe(false);
    expect(placeKindFor('L', 'PRK')).toBe('park');
    expect(placeKindFor('P', 'PPLA')).toBe('populated');
  });

  it('parses a GeoNames dump line into a candidate', () => {
    const row = parseGeonameLine(glasgowLine);
    expect(row).not.toBeNull();
    expect(row?.name).toBe('Glasgow');
    expect(row?.lat).toBeCloseTo(55.86515, 5);
    expect(row?.lng).toBeCloseTo(-4.25763, 5);
    expect(row?.kind).toBe('populated');
    expect(row?.population).toBe(626410);
    expect(row?.altNames).toContain('Glaschu');
  });

  it('drops non-kept feature classes', () => {
    expect(parseGeonameLine(airportLine)).toBeNull();
  });

  it('parks become kind=park', () => {
    const row = parseGeonameLine(parkLine);
    expect(row?.kind).toBe('park');
    expect(row?.population).toBe(0);
  });

  it('reads the committed fixture without network', async () => {
    const rows = await readGeonameDump(placesFixturePath());
    const names = new Set(rows.map((r) => r.name));
    expect(names.has('Glasgow')).toBe(true);
    expect(names.has('Karachi')).toBe(true);
    expect(names.has('Dawsholm Park')).toBe(true);
    // Airport line is not in fixture; London/Lahore are kept as candidates
    // until polygon filter in seedPlaces drops them.
    expect(names.has('London')).toBe(true);
    expect(names.has('Lahore')).toBe(true);
  });
});

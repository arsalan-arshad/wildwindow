import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

import { z } from 'zod';

/** GeoNames dump row we keep for `ref.places` (ARCHITECTURE §3.1 / T2.8). */
export type GeonameCandidate = {
  readonly geonameId: number;
  readonly name: string;
  readonly altNames: readonly string[];
  readonly lat: number;
  readonly lng: number;
  readonly featureClass: string;
  readonly featureCode: string;
  readonly countryCode: string;
  readonly population: number;
  readonly kind: 'populated' | 'park';
};

const latSchema = z.number().gte(-90).lte(90);
const lngSchema = z.number().gte(-180).lte(180);

const MAX_ALT_NAMES = 20;

/**
 * Populated places (class P) and parks (L.PRK) only — T2.8.
 * Other feature classes (airports, ports, admin areas) are dropped.
 */
export function isKeptGeonameFeature(featureClass: string, featureCode: string): boolean {
  if (featureClass === 'P') {
    return true;
  }
  return featureClass === 'L' && featureCode === 'PRK';
}

export function placeKindFor(featureClass: string, featureCode: string): 'populated' | 'park' {
  if (featureClass === 'L' && featureCode === 'PRK') {
    return 'park';
  }
  return 'populated';
}

function parseAltNames(raw: string): string[] {
  if (raw.length === 0) {
    return [];
  }
  const names: string[] = [];
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (trimmed.length === 0) {
      continue;
    }
    names.push(trimmed);
    if (names.length >= MAX_ALT_NAMES) {
      break;
    }
  }
  return names;
}

/**
 * Parse one GeoNames dump TSV line. Returns null when the row is malformed
 * or not a kept feature class.
 */
export function parseGeonameLine(line: string): GeonameCandidate | null {
  if (line.length === 0 || line.startsWith('#')) {
    return null;
  }
  const cols = line.split('\t');
  // GeoNames dump has 19 columns; require the fields we use.
  if (cols.length < 15) {
    return null;
  }
  const geonameIdRaw = cols[0];
  const name = cols[1];
  const altRaw = cols[3];
  const latRaw = cols[4];
  const lngRaw = cols[5];
  const featureClass = cols[6];
  const featureCode = cols[7];
  const countryCode = cols[8];
  const populationRaw = cols[14];
  if (
    geonameIdRaw === undefined ||
    name === undefined ||
    name.length === 0 ||
    altRaw === undefined ||
    latRaw === undefined ||
    lngRaw === undefined ||
    featureClass === undefined ||
    featureCode === undefined ||
    countryCode === undefined ||
    populationRaw === undefined
  ) {
    return null;
  }
  if (!isKeptGeonameFeature(featureClass, featureCode)) {
    return null;
  }
  const geonameId = Number.parseInt(geonameIdRaw, 10);
  const lat = Number.parseFloat(latRaw);
  const lng = Number.parseFloat(lngRaw);
  const population = Number.parseInt(populationRaw, 10);
  if (!Number.isFinite(geonameId) || geonameId <= 0) {
    return null;
  }
  if (!latSchema.safeParse(lat).success || !lngSchema.safeParse(lng).success) {
    return null;
  }
  return {
    geonameId,
    name,
    altNames: parseAltNames(altRaw),
    lat,
    lng,
    featureClass,
    featureCode,
    countryCode,
    population: Number.isFinite(population) && population > 0 ? population : 0,
    kind: placeKindFor(featureClass, featureCode),
  };
}

/** Stream-parse a GeoNames country dump (`.txt`). */
export async function readGeonameDump(filePath: string): Promise<GeonameCandidate[]> {
  const out: GeonameCandidate[] = [];
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    const row = parseGeonameLine(line);
    if (row !== null) {
      out.push(row);
    }
  }
  return out;
}

import { cellToBoundary, cellToLatLng, getResolution, isValidCell } from 'h3-js';

import { createPool } from './client.js';
import { REGION_SEEDS } from './seed.js';

/** Matches decimal-degree style numbers that must never appear in public labels. */
const COORD_LIKE = /[-+]?\d{1,3}\.\d+/;

export type AreaLabelParts = {
  readonly resolution: number;
  readonly zoneName: string | null;
  readonly placeName: string | null;
};

/**
 * Build a human area label from zone + place parts (ARCHITECTURE examples).
 * res 7 → "Glasgow · Kelvin area"; coarser → "Highland area".
 */
export function formatAreaLabel(parts: AreaLabelParts): string | null {
  const zone = cleanLabelPart(parts.zoneName);
  const place = cleanLabelPart(parts.placeName);
  if (zone === null && place === null) {
    return null;
  }

  const zoneShort = zone === null ? null : shortZoneName(zone);

  let label: string;
  if (parts.resolution >= 7) {
    if (place !== null && zoneShort !== null && !namesOverlap(place, zoneShort)) {
      label = `${place} · ${zoneShort} area`;
    } else if (place !== null) {
      label = `${place} area`;
    } else if (zoneShort !== null) {
      label = `${zoneShort} area`;
    } else {
      return null;
    }
  } else {
    // res 5 / 4 / coarser: prefer zone (e.g. "Highland area", "Lower Clyde area").
    const head = zoneShort ?? place;
    if (head === null) {
      return null;
    }
    label = `${head} area`;
  }

  assertLabelSafe(label);
  return label;
}

function shortZoneName(zone: string): string {
  // Avoid `\s+` regexes (CodeQL polynomial-ReDoS); names are short admin labels.
  let name = zone.trim();
  if (name.toLowerCase().startsWith('city of ')) {
    name = name.slice('city of '.length).trim();
  }
  if (name.toLowerCase().endsWith(' city')) {
    name = name.slice(0, -' city'.length).trim();
  }
  return name;
}

function namesOverlap(a: string, b: string): boolean {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  return left === right || left.includes(right) || right.includes(left);
}

function cleanLabelPart(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (COORD_LIKE.test(trimmed)) {
    throw new Error(`area label part looks like coordinates: ${trimmed}`);
  }
  return trimmed;
}

function assertLabelSafe(label: string): void {
  if (COORD_LIKE.test(label)) {
    throw new Error(`area label must not contain coordinate-like numbers: ${label}`);
  }
  // H3 indexes are hex; reject accidental cell leakage.
  if (/\b[0-9a-f]{15}\b/i.test(label)) {
    throw new Error(`area label must not contain an H3 cell index: ${label}`);
  }
}

function assertValidCell(cell: string): number {
  if (typeof cell !== 'string' || cell.length === 0 || !isValidCell(cell)) {
    throw new Error(`invalid H3 cell: ${cell}`);
  }
  return getResolution(cell);
}

/** Closed WKT polygon ring from an H3 cell boundary (lon lat order). */
export function cellToWktPolygon(cell: string): string {
  assertValidCell(cell);
  // Default boundary order is [lat, lng].
  const boundary = cellToBoundary(cell);
  if (boundary.length < 3) {
    throw new Error(`H3 cell boundary too small: ${cell}`);
  }
  const ring = boundary.map((vertex) => {
    const lat = vertex[0];
    const lng = vertex[1];
    return `${String(lng)} ${String(lat)}`;
  });
  const first = ring[0];
  if (first === undefined) {
    throw new Error(`H3 cell boundary empty: ${cell}`);
  }
  // Close the ring if needed.
  if (ring[ring.length - 1] !== first) {
    ring.push(first);
  }
  return `POLYGON((${ring.join(', ')}))`;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

export type AreaLabelLookup = {
  readonly label: string;
  readonly resolution: number;
  readonly zoneName: string | null;
  readonly placeName: string | null;
  readonly regionSlug: string | null;
};

/**
 * Resolve a public area label for an H3 cell: largest-overlap zone + nearest
 * populated place (T2.9 / ARCHITECTURE §6.2).
 */
export async function areaLabelFor(
  connectionString: string,
  cell: string,
): Promise<AreaLabelLookup | null> {
  const resolution = assertValidCell(cell);
  const wkt = cellToWktPolygon(cell);
  const [cellLat, cellLng] = cellToLatLng(cell);

  const pool = createPool(connectionString);
  try {
    const betaSlugs = REGION_SEEDS.map((r) => r.slug);
    const zoneResult = await pool.query<{
      name: string;
      slug: string;
      overlap: number;
    }>(
      `
      SELECT z.name, r.slug,
             ST_Area(ST_Intersection(z.geom, ST_GeomFromText($1, 4326))::geography) AS overlap
      FROM ref.zones z
      JOIN ref.regions r ON r.id = z.region_id
      WHERE r.slug = ANY($2::text[])
        AND ST_Intersects(z.geom, ST_GeomFromText($1, 4326))
      ORDER BY overlap DESC
      LIMIT 1
      `,
      [wkt, betaSlugs],
    );
    const zone = zoneResult.rows[0];

    // Prefer places in the same beta region when we know it; else all beta places.
    const placesResult = await pool.query<{
      name: string;
      cell_r7: string;
      population: number | null;
      slug: string;
    }>(
      `
      SELECT p.name, p.cell_r7, p.population, r.slug
      FROM ref.places p
      JOIN ref.regions r ON r.id = p.region_id
      WHERE p.kind = 'populated'
        AND r.slug = ANY($1::text[])
        AND ($2::text IS NULL OR r.slug = $2)
      `,
      [betaSlugs, zone?.slug ?? null],
    );

    let bestPlace: { name: string; slug: string } | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const row of placesResult.rows) {
      if (!isValidCell(row.cell_r7)) {
        continue;
      }
      const [plat, plng] = cellToLatLng(row.cell_r7);
      const distance = haversineKm(cellLat, cellLng, plat, plng);
      // Prefer closer places; break ties toward higher population.
      const popPenalty = 1 / (1 + (row.population ?? 0));
      const score = distance + popPenalty * 0.001;
      if (score < bestScore) {
        bestScore = score;
        bestPlace = { name: row.name, slug: row.slug };
      }
    }

    const zoneName = zone?.name ?? null;
    const placeName = bestPlace?.name ?? null;
    const label = formatAreaLabel({ resolution, zoneName, placeName });
    if (label === null) {
      return null;
    }
    return {
      label,
      resolution,
      zoneName,
      placeName,
      regionSlug: zone?.slug ?? bestPlace?.slug ?? null,
    };
  } finally {
    await pool.end();
  }
}

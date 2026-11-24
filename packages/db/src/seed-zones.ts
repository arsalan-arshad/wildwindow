import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import { createPool } from './client.js';
import { REGION_SEEDS, boundariesFolder } from './seed.js';

const here = dirname(fileURLToPath(import.meta.url));

const featureSchema = z.object({
  type: z.literal('Feature'),
  properties: z.object({
    name: z.string().min(1),
    kind: z.enum(['council_area', 'district']),
    region: z.enum(['scotland', 'sindh']),
  }),
  geometry: z.object({
    type: z.enum(['Polygon', 'MultiPolygon']),
    coordinates: z.array(z.unknown()),
  }),
});

const featureCollectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(featureSchema).min(1),
});

export type SeedZonesResult = {
  readonly zoneCount: number;
  readonly byRegion: Readonly<Record<string, number>>;
};

/** Committed label-only zone polygons under `data/boundaries/zones/`. */
export function zonesFolder(boundariesDir: string = boundariesFolder()): string {
  return resolve(boundariesDir, 'zones');
}

async function loadZoneCollection(filePath: string) {
  const raw: unknown = JSON.parse(await readFile(filePath, 'utf8'));
  return featureCollectionSchema.parse(raw);
}

/**
 * Replace `ref.zones` for beta regions from committed GeoJSON (T2.9).
 * Label use only — never for exact wildlife pins.
 */
export async function seedZones(
  connectionString: string,
  folder: string = zonesFolder(),
): Promise<SeedZonesResult> {
  const pool = createPool(connectionString);
  try {
    const regionResult = await pool.query<{ id: number; slug: string }>(
      `SELECT id, slug FROM ref.regions WHERE slug = ANY($1::text[])`,
      [REGION_SEEDS.map((r) => r.slug)],
    );
    const regionIds = new Map(regionResult.rows.map((r) => [r.slug, r.id]));
    for (const seed of REGION_SEEDS) {
      if (!regionIds.has(seed.slug)) {
        throw new Error(`seedZones: region ${seed.slug} missing — run seedRegions first`);
      }
    }

    await pool.query(`DELETE FROM ref.zones WHERE region_id = ANY($1::int[])`, [
      [...regionIds.values()],
    ]);

    const byRegion: Record<string, number> = { scotland: 0, sindh: 0 };
    let zoneCount = 0;

    for (const seed of REGION_SEEDS) {
      const regionId = regionIds.get(seed.slug);
      if (regionId === undefined) {
        throw new Error(`seedZones: missing region id for ${seed.slug}`);
      }
      const collection = await loadZoneCollection(resolve(folder, `${seed.slug}.geojson`));
      for (const feature of collection.features) {
        if (feature.properties.region !== seed.slug) {
          throw new Error(
            `seedZones: feature ${feature.properties.name} region mismatch in ${seed.slug}.geojson`,
          );
        }
        const geometryJson = JSON.stringify(feature.geometry);
        await pool.query(
          `
          INSERT INTO ref.zones (region_id, name, kind, geom)
          VALUES (
            $1, $2, $3,
            ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($4), 4326))
          )
          `,
          [regionId, feature.properties.name, feature.properties.kind, geometryJson],
        );
        zoneCount += 1;
        byRegion[seed.slug] = (byRegion[seed.slug] ?? 0) + 1;
      }
    }

    return { zoneCount, byRegion };
  } finally {
    await pool.end();
  }
}

/** Path helper for tests that load fixtures relative to package root. */
export function defaultZonesFolder(): string {
  return zonesFolder(resolve(here, '..', '..', '..', 'data', 'boundaries'));
}

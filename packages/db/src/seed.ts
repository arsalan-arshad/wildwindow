import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadEnv } from '@wildwindow/shared';
import { z } from 'zod';

import { createPool } from './client.js';

const seedEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
});

const geoJsonFeatureSchema = z.object({
  type: z.literal('Feature'),
  geometry: z.object({
    type: z.enum(['Polygon', 'MultiPolygon']),
    coordinates: z.array(z.unknown()),
  }),
  properties: z.record(z.unknown()).optional(),
});

const here = dirname(fileURLToPath(import.meta.url));

/** Repo `data/boundaries/` — GeoJSON committed for T2.6 (Natural Earth). */
export function boundariesFolder(): string {
  // packages/db/src → repo root data/boundaries (also works from dist/)
  return resolve(here, '..', '..', '..', 'data', 'boundaries');
}

export type RegionSeed = {
  readonly slug: 'scotland' | 'sindh';
  readonly name: string;
  readonly countryCode: string;
  readonly timeZone: string;
  readonly minRes: number;
  readonly fileName: string;
};

/** Beta regions (ARCHITECTURE §6.2). */
export const REGION_SEEDS: readonly RegionSeed[] = [
  {
    slug: 'scotland',
    name: 'Scotland',
    countryCode: 'GB',
    timeZone: 'Europe/London',
    minRes: 3,
    fileName: 'scotland.geojson',
  },
  {
    slug: 'sindh',
    name: 'Sindh',
    countryCode: 'PK',
    timeZone: 'Asia/Karachi',
    minRes: 3,
    fileName: 'sindh.geojson',
  },
] as const;

export type SeedRegionsResult = {
  readonly regions: readonly { slug: string; id: number; name: string; timeZone: string }[];
};

async function loadRegionGeometryJson(folder: string, fileName: string): Promise<string> {
  const raw = await readFile(resolve(folder, fileName), 'utf8');
  const parsed: unknown = JSON.parse(raw);
  const feature = geoJsonFeatureSchema.parse(parsed);
  return JSON.stringify(feature.geometry);
}

/**
 * Upsert Scotland and Sindh into `ref.regions` from committed GeoJSON.
 * Safe to re-run (ON CONFLICT slug).
 */
export async function seedRegions(
  connectionString: string,
  folder: string = boundariesFolder(),
): Promise<SeedRegionsResult> {
  const pool = createPool(connectionString);
  try {
    const seeded: { slug: string; id: number; name: string; timeZone: string }[] = [];

    for (const region of REGION_SEEDS) {
      const geometryJson = await loadRegionGeometryJson(folder, region.fileName);
      const result = await pool.query<{
        id: number;
        slug: string;
        name: string;
        time_zone: string;
      }>(
        `
        INSERT INTO ref.regions (slug, name, country_code, time_zone, geom, min_res)
        VALUES (
          $1,
          $2,
          $3,
          $4,
          ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($5), 4326)),
          $6
        )
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          country_code = EXCLUDED.country_code,
          time_zone = EXCLUDED.time_zone,
          geom = EXCLUDED.geom,
          min_res = EXCLUDED.min_res
        RETURNING id, slug, name, time_zone
        `,
        [
          region.slug,
          region.name,
          region.countryCode,
          region.timeZone,
          geometryJson,
          region.minRes,
        ],
      );
      const row = result.rows[0];
      if (row === undefined) {
        throw new Error(`seedRegions: no row returned for ${region.slug}`);
      }
      seeded.push({
        slug: row.slug,
        id: row.id,
        name: row.name,
        timeZone: row.time_zone,
      });
    }

    return { regions: seeded };
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const env = loadEnv(seedEnvSchema);
  const result = await seedRegions(env.DATABASE_URL);
  // eslint-disable-next-line no-console -- CLI progress for pnpm db:seed
  console.log(
    `Seeded ${String(result.regions.length)} regions: ${result.regions
      .map((r) => `${r.slug} (${r.timeZone})`)
      .join(', ')}`,
  );
}

const isMain =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console -- CLI error path
    console.error(`db:seed failed: ${message}`);
    process.exitCode = 1;
  });
}

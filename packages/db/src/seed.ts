import { readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadEnv,
  validateDataDir,
  type BetaSpeciesEntry,
  type RegionId,
  type SensitivityTier,
} from '@wildwindow/shared';
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
  return resolve(here, '..', '..', '..', 'data', 'boundaries');
}

/** Repo `data/` — beta-species + sensitive-species YAML. */
export function dataFolder(): string {
  return resolve(here, '..', '..', '..', 'data');
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

export type SeedTaxaResult = {
  readonly taxaCount: number;
  readonly taxonRegionCount: number;
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
          $1, $2, $3, $4,
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

function requireGbifKey(entry: BetaSpeciesEntry): number {
  if (entry.gbifTaxonKey === undefined) {
    throw new Error(
      `seedTaxa: ${entry.scientificName} is missing gbifTaxonKey — run pnpm data:resolve-taxa`,
    );
  }
  if (entry.matchType !== undefined && entry.matchType !== 'EXACT') {
    throw new Error(
      `seedTaxa: ${entry.scientificName} matchType=${entry.matchType} (needs human review)`,
    );
  }
  return entry.gbifTaxonKey;
}

function tierFor(
  scientificName: string,
  region: RegionId,
  sensitive: Map<string, { tier: SensitivityTier; lockoutMonths: number[] }>,
): { tier: SensitivityTier; lockoutMonths: number[] } {
  const hit = sensitive.get(`${scientificName.toLowerCase()}::${region}`);
  if (hit !== undefined) {
    return hit;
  }
  // ARCHITECTURE §3.3 default: when missing, use protected (safer) rather than open.
  return { tier: 'protected', lockoutMonths: [] };
}

/**
 * Upsert `ref.taxa` and `ref.taxon_region` from data YAML (T2.7).
 * Requires resolved EXACT gbifTaxonKey on every beta species.
 */
export async function seedTaxa(
  connectionString: string,
  folder: string = dataFolder(),
): Promise<SeedTaxaResult> {
  const { betaSpecies, sensitiveSpecies } = validateDataDir(folder);
  const sensitive = new Map<string, { tier: SensitivityTier; lockoutMonths: number[] }>();
  for (const row of sensitiveSpecies.species) {
    sensitive.set(`${row.scientificName.toLowerCase()}::${row.region}`, {
      tier: row.tier,
      lockoutMonths: row.lockoutMonths ?? [],
    });
  }

  const pool = createPool(connectionString);
  try {
    const regionIds = new Map<string, number>();
    const regionResult = await pool.query<{ id: number; slug: string }>(
      `SELECT id, slug FROM ref.regions WHERE slug = ANY($1::text[])`,
      [REGION_SEEDS.map((r) => r.slug)],
    );
    for (const row of regionResult.rows) {
      regionIds.set(row.slug, row.id);
    }
    for (const seed of REGION_SEEDS) {
      if (!regionIds.has(seed.slug)) {
        throw new Error(`seedTaxa: region ${seed.slug} missing — run seedRegions first`);
      }
    }

    let taxaCount = 0;
    let taxonRegionCount = 0;

    for (const entry of betaSpecies.species) {
      const gbifKey = requireGbifKey(entry);
      const taxonResult = await pool.query<{ id: number }>(
        `
        INSERT INTO ref.taxa (
          gbif_taxon_key, scientific_name, common_names, "group", effort_group,
          coastal, tide_pref, activity_pattern, challenge_eligible
        )
        VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (gbif_taxon_key) DO UPDATE SET
          scientific_name = EXCLUDED.scientific_name,
          common_names = EXCLUDED.common_names,
          "group" = EXCLUDED."group",
          effort_group = EXCLUDED.effort_group,
          coastal = EXCLUDED.coastal,
          tide_pref = EXCLUDED.tide_pref,
          activity_pattern = EXCLUDED.activity_pattern,
          challenge_eligible = EXCLUDED.challenge_eligible
        RETURNING id
        `,
        [
          gbifKey,
          entry.scientificName,
          JSON.stringify(entry.commonNames),
          entry.group,
          entry.effortGroup,
          entry.coastal,
          entry.tidePref ?? null,
          entry.activityPattern,
          entry.challengeEligible,
        ],
      );
      const taxon = taxonResult.rows[0];
      if (taxon === undefined) {
        throw new Error(`seedTaxa: no taxon row for ${entry.scientificName}`);
      }
      taxaCount += 1;

      for (const regionSlug of entry.regions) {
        const regionId = regionIds.get(regionSlug);
        if (regionId === undefined) {
          throw new Error(`seedTaxa: unknown region ${regionSlug}`);
        }
        const { tier, lockoutMonths } = tierFor(entry.scientificName, regionSlug, sensitive);
        await pool.query(
          `
          INSERT INTO ref.taxon_region (taxon_id, region_id, tier, lockout_months)
          VALUES ($1, $2, $3, $4::int[])
          ON CONFLICT (taxon_id, region_id) DO UPDATE SET
            tier = EXCLUDED.tier,
            lockout_months = EXCLUDED.lockout_months
          `,
          [taxon.id, regionId, tier, lockoutMonths],
        );
        taxonRegionCount += 1;
      }
    }

    return { taxaCount, taxonRegionCount };
  } finally {
    await pool.end();
  }
}

export type SeedAllResult = {
  readonly regions: SeedRegionsResult['regions'];
  readonly taxa: SeedTaxaResult;
  readonly places: { readonly inserted: number };
  readonly zones: { readonly zoneCount: number };
};

/** Seed regions, taxa, places fixture, and label-only zones (T2.6–T2.9). */
export async function seedAll(
  connectionString: string,
  options: { boundariesDir?: string; dataDir?: string } = {},
): Promise<SeedAllResult> {
  const boundariesDir = options.boundariesDir ?? boundariesFolder();
  const regions = await seedRegions(connectionString, boundariesDir);
  const taxa = await seedTaxa(connectionString, options.dataDir ?? dataFolder());
  // Lazy imports avoid cycles with seed-places / seed-zones.
  const { seedPlacesFromFixture } = await import('./seed-places.js');
  const { seedZones, zonesFolder } = await import('./seed-zones.js');
  const places = await seedPlacesFromFixture(connectionString);
  const zones = await seedZones(connectionString, zonesFolder(boundariesDir));
  return {
    regions: regions.regions,
    taxa,
    places: { inserted: places.inserted },
    zones: { zoneCount: zones.zoneCount },
  };
}

async function main(): Promise<void> {
  const env = loadEnv(seedEnvSchema);
  const result = await seedAll(env.DATABASE_URL);
  // eslint-disable-next-line no-console -- CLI progress for pnpm db:seed
  console.log(
    `Seeded ${String(result.regions.length)} regions: ${result.regions
      .map((r) => `${r.slug} (${r.timeZone})`)
      .join(', ')}`,
  );
  // eslint-disable-next-line no-console -- CLI progress for pnpm db:seed
  console.log(
    `Seeded ${String(result.taxa.taxaCount)} taxa and ${String(result.taxa.taxonRegionCount)} taxon_region rows`,
  );
  // eslint-disable-next-line no-console -- CLI progress for pnpm db:seed
  console.log(`Seeded ${String(result.places.inserted)} places (GeoNames fixture)`);
  // eslint-disable-next-line no-console -- CLI progress for pnpm db:seed
  console.log(`Seeded ${String(result.zones.zoneCount)} zones (label-only)`);
}

/** True when invoked as `node …/seed.js` or `tsx …/seed.ts` (not when imported). */
function isMain(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) {
    return false;
  }
  // Basename check: safe when sibling CLIs (e.g. seed-places) are bundled into this file.
  const base = basename(resolve(entry));
  return base === 'seed.js' || base === 'seed.ts';
}

if (isMain()) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console -- CLI error path
    console.error(`db:seed failed: ${message}`);
    process.exitCode = 1;
  });
}

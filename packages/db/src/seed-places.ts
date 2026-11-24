import { execFile } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { snapToCell } from '@wildwindow/geoprivacy';
import { loadEnv } from '@wildwindow/shared';
import { z } from 'zod';

import { createPool } from './client.js';
import { readGeonameDump, type GeonameCandidate } from './geonames.js';
import { REGION_SEEDS, boundariesFolder, seedRegions } from './seed.js';

const execFileAsync = promisify(execFile);

const here = dirname(fileURLToPath(import.meta.url));

const placesEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
});

const GEONAMES_DUMP_BASE = 'https://download.geonames.org/export/dump';

/** Country dump codes for beta regions (ARCHITECTURE §3.1). */
export const GEONAMES_COUNTRY_DUMPS = {
  scotland: 'GB',
  sindh: 'PK',
} as const;

export type PlaceSeedRow = {
  readonly name: string;
  readonly altNames: readonly string[];
  readonly kind: 'populated' | 'park';
  readonly cellR7: string;
  readonly population: number | null;
  readonly lat: number;
  readonly lng: number;
};

export type SeedPlacesResult = {
  readonly inserted: number;
  readonly byRegion: Readonly<Record<string, number>>;
};

/** Committed fixture used in tests / offline seed (not the raw dump). */
export function placesFixturePath(): string {
  return resolve(here, '..', '__fixtures__', 'geonames-sample.tsv');
}

/** Local dump directory (git-ignored `data/dumps/`). */
export function placesDumpDir(repoRoot: string = resolve(here, '..', '..', '..')): string {
  return resolve(repoRoot, 'data', 'dumps');
}

export function candidateToPlaceSeed(row: GeonameCandidate): PlaceSeedRow {
  return {
    name: row.name,
    altNames: row.altNames,
    kind: row.kind,
    cellR7: snapToCell(row.lat, row.lng, 7),
    population: row.population > 0 ? row.population : null,
    lat: row.lat,
    lng: row.lng,
  };
}

export async function loadPlaceSeedsFromTsv(filePath: string): Promise<PlaceSeedRow[]> {
  const rows = await readGeonameDump(filePath);
  return rows.map(candidateToPlaceSeed);
}

/**
 * Replace `ref.places` for beta regions with candidates that fall inside
 * each region's polygon (PostGIS ST_Covers). Every inserted row has cell_r7.
 */
export async function seedPlaces(
  connectionString: string,
  placeRows: readonly PlaceSeedRow[],
  options: { clearExisting?: boolean } = {},
): Promise<SeedPlacesResult> {
  const clearExisting = options.clearExisting ?? true;
  const pool = createPool(connectionString);
  try {
    const regionResult = await pool.query<{ id: number; slug: string }>(
      `SELECT id, slug FROM ref.regions WHERE slug = ANY($1::text[])`,
      [REGION_SEEDS.map((r) => r.slug)],
    );
    const regionIds = new Map(regionResult.rows.map((r) => [r.slug, r.id]));
    for (const seed of REGION_SEEDS) {
      if (!regionIds.has(seed.slug)) {
        throw new Error(`seedPlaces: region ${seed.slug} missing — run seedRegions first`);
      }
    }

    if (clearExisting) {
      await pool.query(`DELETE FROM ref.places WHERE region_id = ANY($1::int[])`, [
        [...regionIds.values()],
      ]);
    }

    const byRegion: Record<string, number> = { scotland: 0, sindh: 0 };
    const idToSlug = new Map([...regionIds.entries()].map(([slug, id]) => [id, slug]));
    let inserted = 0;

    const batchSize = 200;
    for (let offset = 0; offset < placeRows.length; offset += batchSize) {
      const batch = placeRows.slice(offset, offset + batchSize);
      const payload = batch.map((row) => ({
        name: row.name,
        altNames: [...row.altNames],
        kind: row.kind,
        cellR7: row.cellR7,
        population: row.population,
        lng: row.lng,
        lat: row.lat,
      }));

      const result = await pool.query<{ region_id: number }>(
        `
        INSERT INTO ref.places (region_id, name, alt_names, kind, cell_r7, population)
        SELECT r.id, v.name, v."altNames", v.kind, v."cellR7", v.population
        FROM ref.regions r
        INNER JOIN jsonb_to_recordset($1::jsonb) AS v(
          name text,
          "altNames" text[],
          kind text,
          "cellR7" text,
          population int,
          lng float8,
          lat float8
        ) ON ST_Covers(r.geom, ST_SetSRID(ST_MakePoint(v.lng, v.lat), 4326))
        WHERE r.slug = ANY($2::text[])
        RETURNING region_id
        `,
        [JSON.stringify(payload), REGION_SEEDS.map((r) => r.slug)],
      );

      for (const row of result.rows) {
        inserted += 1;
        const slug = idToSlug.get(row.region_id);
        if (slug !== undefined) {
          byRegion[slug] = (byRegion[slug] ?? 0) + 1;
        }
      }
    }

    return { inserted, byRegion };
  } finally {
    await pool.end();
  }
}

/** Seed places from the committed fixture (CI / `db:seed`). */
export async function seedPlacesFromFixture(
  connectionString: string,
  fixturePath: string = placesFixturePath(),
): Promise<SeedPlacesResult> {
  const rows = await loadPlaceSeedsFromTsv(fixturePath);
  return seedPlaces(connectionString, rows);
}

async function downloadToFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || response.body === null) {
    throw new Error(`download failed ${url}: HTTP ${String(response.status)}`);
  }
  await mkdir(dirname(destPath), { recursive: true });
  const file = createWriteStream(destPath);
  await pipeline(Readable.fromWeb(response.body as never), file);
}

async function unzipCountryDump(
  zipPath: string,
  dumpDir: string,
  countryCode: string,
): Promise<string> {
  await execFileAsync('unzip', ['-o', '-j', zipPath, `${countryCode}.txt`, '-d', dumpDir]);
  const txtPath = resolve(dumpDir, `${countryCode}.txt`);
  await access(txtPath);
  return txtPath;
}

/**
 * Download GB + PK GeoNames dumps (CC BY 4.0), parse, filter to region
 * polygons, seed `ref.places`. Raw zips stay under git-ignored `data/dumps/`.
 */
export async function downloadAndSeedPlaces(
  connectionString: string,
  options: {
    dumpDir?: string;
    ensureRegions?: boolean;
    boundariesDir?: string;
  } = {},
): Promise<SeedPlacesResult> {
  const dumpDir = options.dumpDir ?? placesDumpDir();
  await mkdir(dumpDir, { recursive: true });

  if (options.ensureRegions !== false) {
    await seedRegions(connectionString, options.boundariesDir ?? boundariesFolder());
  }

  const allRows: PlaceSeedRow[] = [];
  for (const countryCode of Object.values(GEONAMES_COUNTRY_DUMPS)) {
    const zipPath = resolve(dumpDir, `${countryCode}.zip`);
    const url = `${GEONAMES_DUMP_BASE}/${countryCode}.zip`;
    // eslint-disable-next-line no-console -- CLI progress
    console.log(`Downloading ${url}`);
    await downloadToFile(url, zipPath);
    const txtPath = await unzipCountryDump(zipPath, dumpDir, countryCode);
    const candidates = await readGeonameDump(txtPath);
    // eslint-disable-next-line no-console -- CLI progress
    console.log(`Parsed ${String(candidates.length)} kept rows from ${countryCode}.txt`);
    for (const row of candidates) {
      allRows.push(candidateToPlaceSeed(row));
    }
  }

  return seedPlaces(connectionString, allRows);
}

async function main(): Promise<void> {
  const env = loadEnv(placesEnvSchema);
  const useFixture = process.argv.includes('--fixture');
  const result = useFixture
    ? await (async () => {
        await seedRegions(env.DATABASE_URL);
        return seedPlacesFromFixture(env.DATABASE_URL);
      })()
    : await downloadAndSeedPlaces(env.DATABASE_URL);
  // eslint-disable-next-line no-console -- CLI progress
  console.log(
    `Seeded ${String(result.inserted)} places` +
      ` (scotland=${String(result.byRegion['scotland'] ?? 0)},` +
      ` sindh=${String(result.byRegion['sindh'] ?? 0)})`,
  );
}

const isMain =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console -- CLI error path
    console.error(`data:places failed: ${message}`);
    process.exitCode = 1;
  });
}

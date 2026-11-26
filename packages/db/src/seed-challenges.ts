import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadChallengeSeedsFromDir,
  loadEnv,
  type LoadedChallengeSeed,
  type RegionId,
} from '@wildwindow/shared';
import { z } from 'zod';

import { createPool } from './client.js';

const challengesEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
});

const here = dirname(fileURLToPath(import.meta.url));

/** Repo `data/challenges/` — monthly challenge YAML seeds (T8.4). */
export function challengesFolder(repoRoot: string = resolve(here, '..', '..', '..')): string {
  return resolve(repoRoot, 'data', 'challenges');
}

export type SeedChallengesResult = {
  readonly upserted: number;
  readonly slugs: readonly string[];
};

type TaxonRow = {
  readonly id: number;
  readonly scientific_name: string;
  readonly challenge_eligible: boolean;
};

/**
 * Upsert `app.challenges` from challenge seed YAML.
 * Resolves taxon by scientific name; requires challenge_eligible and coverage
 * of every listed region. Safe to re-run (ON CONFLICT slug).
 */
export async function seedChallenges(
  connectionString: string,
  seeds: readonly LoadedChallengeSeed[],
): Promise<SeedChallengesResult> {
  const pool = createPool(connectionString);
  try {
    const taxonResult = await pool.query<TaxonRow>(
      `SELECT id, scientific_name, challenge_eligible FROM ref.taxa ORDER BY id ASC`,
    );
    const byName = new Map<string, TaxonRow>();
    const ambiguous = new Set<string>();
    for (const row of taxonResult.rows) {
      const key = row.scientific_name.toLowerCase();
      if (byName.has(key)) {
        ambiguous.add(key);
        continue;
      }
      byName.set(key, row);
    }

    const regionResult = await pool.query<{ id: number; slug: string }>(
      `SELECT id, slug FROM ref.regions`,
    );
    const regionIds = new Map(regionResult.rows.map((r) => [r.slug, r.id]));

    const slugs: string[] = [];

    for (const seed of seeds) {
      const key = seed.scientificName.toLowerCase();
      if (ambiguous.has(key)) {
        throw new Error(
          `${seed.filePath}: scientificName "${seed.scientificName}" matches multiple ref.taxa rows`,
        );
      }
      const taxon = byName.get(key);
      if (taxon === undefined) {
        throw new Error(
          `${seed.filePath}: taxon "${seed.scientificName}" not found in ref.taxa — run pnpm db:seed (taxa) first`,
        );
      }
      if (!taxon.challenge_eligible) {
        throw new Error(
          `${seed.filePath}: taxon "${seed.scientificName}" is not challenge_eligible (PRD US-13 AC5)`,
        );
      }

      await assertRegionsOpenForTaxon(pool, taxon.id, seed.regions, regionIds, seed.filePath);

      await pool.query(
        `
        INSERT INTO app.challenges (
          slug, title, taxon_id, starts_on, ends_on, rules_md, status
        )
        VALUES ($1, $2, $3, $4::date, $5::date, $6, $7)
        ON CONFLICT (slug) DO UPDATE SET
          title = EXCLUDED.title,
          taxon_id = EXCLUDED.taxon_id,
          starts_on = EXCLUDED.starts_on,
          ends_on = EXCLUDED.ends_on,
          rules_md = EXCLUDED.rules_md,
          status = EXCLUDED.status
        `,
        [seed.slug, seed.title, taxon.id, seed.startsOn, seed.endsOn, seed.rulesMd, seed.status],
      );
      slugs.push(seed.slug);
    }

    return { upserted: slugs.length, slugs };
  } finally {
    await pool.end();
  }
}

async function assertRegionsOpenForTaxon(
  pool: ReturnType<typeof createPool>,
  taxonId: number,
  regions: readonly RegionId[],
  regionIds: ReadonlyMap<string, number>,
  filePath: string,
): Promise<void> {
  for (const slug of regions) {
    const regionId = regionIds.get(slug);
    if (regionId === undefined) {
      throw new Error(
        `${filePath}: region "${slug}" not found in ref.regions — run seedRegions first`,
      );
    }
    const tierResult = await pool.query<{ tier: string }>(
      `
      SELECT tier FROM ref.taxon_region
      WHERE taxon_id = $1 AND region_id = $2
      `,
      [taxonId, regionId],
    );
    const row = tierResult.rows[0];
    if (row === undefined) {
      throw new Error(
        `${filePath}: taxon has no taxon_region row for "${slug}" — challenge spans both beta regions`,
      );
    }
    if (row.tier !== 'open') {
      throw new Error(
        `${filePath}: challenge species must be open tier in "${slug}" (found ${row.tier})`,
      );
    }
  }
}

/** Load YAML from `data/challenges` and upsert into `app.challenges`. */
export async function seedChallengesFromDir(
  connectionString: string,
  dir: string = challengesFolder(),
): Promise<SeedChallengesResult> {
  const seeds = loadChallengeSeedsFromDir(dir);
  return seedChallenges(connectionString, seeds);
}

async function main(): Promise<void> {
  const env = loadEnv(challengesEnvSchema);
  const result = await seedChallengesFromDir(env.DATABASE_URL);
  // eslint-disable-next-line no-console -- CLI progress
  console.log(
    `Seeded ${String(result.upserted)} challenge(s): ${result.slugs.join(', ') || '(none)'}`,
  );
}

/** True when invoked as `node …/seed-challenges.js` or `tsx …/seed-challenges.ts`. */
function isMain(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) {
    return false;
  }
  const base = basename(resolve(entry));
  return base === 'seed-challenges.js' || base === 'seed-challenges.ts';
}

if (isMain()) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console -- CLI error path
    console.error(`seed-challenges failed: ${message}`);
    process.exitCode = 1;
  });
}

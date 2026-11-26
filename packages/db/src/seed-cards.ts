import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadEnv, loadSpeciesCardsFromDir, type ParsedSpeciesCard } from '@wildwindow/shared';
import { z } from 'zod';

import { createPool } from './client.js';
import { REGION_SEEDS, seedRegions } from './seed.js';

const cardsEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
});

const here = dirname(fileURLToPath(import.meta.url));

/** Repo `data/species-cards/` — curated Markdown field cards (T8.1). */
export function speciesCardsFolder(repoRoot: string = resolve(here, '..', '..', '..')): string {
  return resolve(repoRoot, 'data', 'species-cards');
}

/** Committed fixtures for offline / integration tests. */
export function speciesCardsFixtureFolder(): string {
  return resolve(here, '..', '__fixtures__', 'species-cards');
}

export type SeedCardsResult = {
  readonly upserted: number;
  readonly draft: number;
  readonly reviewed: number;
  readonly byRegion: Readonly<Record<string, number>>;
};

function requireTaxonId(
  scientificName: string,
  byName: ReadonlyMap<string, number>,
  filePath: string,
): number {
  const id = byName.get(scientificName.toLowerCase());
  if (id === undefined) {
    throw new Error(
      `${filePath}: taxon "${scientificName}" not found in ref.taxa — run pnpm db:seed first`,
    );
  }
  return id;
}

/**
 * Upsert `ref.species_cards` from parsed Markdown cards (one row per taxon × region).
 * Re-running is safe: existing rows for the same taxon × region are updated.
 */
export async function seedSpeciesCards(
  connectionString: string,
  cards: readonly ParsedSpeciesCard[],
): Promise<SeedCardsResult> {
  const pool = createPool(connectionString);
  try {
    const regionResult = await pool.query<{ id: number; slug: string }>(
      `SELECT id, slug FROM ref.regions WHERE slug = ANY($1::text[])`,
      [REGION_SEEDS.map((r) => r.slug)],
    );
    const regionIds = new Map(regionResult.rows.map((r) => [r.slug, r.id]));
    for (const seed of REGION_SEEDS) {
      if (!regionIds.has(seed.slug)) {
        throw new Error(`seedSpeciesCards: region ${seed.slug} missing — run seedRegions first`);
      }
    }

    const taxonResult = await pool.query<{ id: number; scientific_name: string }>(
      `SELECT id, scientific_name FROM ref.taxa`,
    );
    const taxonLookup = new Map<string, number>();
    for (const row of taxonResult.rows) {
      taxonLookup.set(row.scientific_name.toLowerCase(), row.id);
    }

    let upserted = 0;
    let draft = 0;
    let reviewed = 0;
    const byRegion: Record<string, number> = { scotland: 0, sindh: 0 };

    for (const card of cards) {
      const regionId = regionIds.get(card.region);
      if (regionId === undefined) {
        throw new Error(`seedSpeciesCards: unknown region ${card.region}`);
      }
      const taxonId = requireTaxonId(card.scientificName, taxonLookup, card.filePath);
      const reviewedAt = card.reviewedAt !== null ? new Date(card.reviewedAt) : null;

      const existing = await pool.query<{ id: number }>(
        `
        SELECT id FROM ref.species_cards
        WHERE taxon_id = $1 AND region_id = $2
        ORDER BY id ASC
        LIMIT 1
        `,
        [taxonId, regionId],
      );

      if (existing.rows[0] !== undefined) {
        await pool.query(
          `
          UPDATE ref.species_cards SET
            body_md = $2,
            settings = $3::jsonb,
            ethics_md = $4,
            legal_md = $5,
            status = $6,
            reviewed_by = $7,
            reviewed_at = $8
          WHERE id = $1
          `,
          [
            existing.rows[0].id,
            card.bodyMd,
            JSON.stringify(card.settings),
            card.ethicsMd,
            card.legalMd,
            card.status,
            card.reviewedBy,
            reviewedAt,
          ],
        );
      } else {
        await pool.query(
          `
          INSERT INTO ref.species_cards (
            taxon_id, region_id, body_md, settings, ethics_md, legal_md,
            status, reviewed_by, reviewed_at
          )
          VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9)
          `,
          [
            taxonId,
            regionId,
            card.bodyMd,
            JSON.stringify(card.settings),
            card.ethicsMd,
            card.legalMd,
            card.status,
            card.reviewedBy,
            reviewedAt,
          ],
        );
      }

      upserted += 1;
      if (card.status === 'draft') {
        draft += 1;
      } else {
        reviewed += 1;
      }
      byRegion[card.region] = (byRegion[card.region] ?? 0) + 1;
    }

    return { upserted, draft, reviewed, byRegion };
  } finally {
    await pool.end();
  }
}

/** Load Markdown from `cardsDir` and upsert into `ref.species_cards`. */
export async function seedSpeciesCardsFromDir(
  connectionString: string,
  cardsDir: string,
): Promise<SeedCardsResult> {
  const cards = await loadSpeciesCardsFromDir(cardsDir);
  return seedSpeciesCards(connectionString, cards);
}

export async function seedSpeciesCardsFromFixture(
  connectionString: string,
): Promise<SeedCardsResult> {
  return seedSpeciesCardsFromDir(connectionString, speciesCardsFixtureFolder());
}

async function main(): Promise<void> {
  const env = loadEnv(cardsEnvSchema);
  const useFixture = process.argv.includes('--fixture');
  const cardsDir = useFixture ? speciesCardsFixtureFolder() : speciesCardsFolder();

  // Regions must exist for FK; taxa come from `pnpm db:seed` (tests insert fixtures).
  if (useFixture) {
    await seedRegions(env.DATABASE_URL);
  }

  const result = await seedSpeciesCardsFromDir(env.DATABASE_URL, cardsDir);
  // eslint-disable-next-line no-console -- CLI progress
  console.log(
    `Loaded ${String(result.upserted)} species cards` +
      ` (draft=${String(result.draft)}, reviewed=${String(result.reviewed)};` +
      ` scotland=${String(result.byRegion['scotland'] ?? 0)},` +
      ` sindh=${String(result.byRegion['sindh'] ?? 0)})` +
      ` from ${cardsDir}`,
  );
}

/** True when invoked as `node …/seed-cards.js` or `tsx …/seed-cards.ts`. */
function isMain(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) {
    return false;
  }
  const base = basename(resolve(entry));
  return base === 'seed-cards.js' || base === 'seed-cards.ts';
}

if (isMain()) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console -- CLI error path
    console.error(`data:cards failed: ${message}`);
    process.exitCode = 1;
  });
}

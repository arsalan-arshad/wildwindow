import { Client } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';

import { migrationsFolder, runMigrations } from './migrate.js';
import { seedSpeciesCardsFromFixture } from './seed-cards.js';
import { seedRegions } from './seed.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';

/** Canonical GBIF key for Common kingfisher (data/beta-species.yaml). */
const KINGFISHER_GBIF_KEY = 2475532;

describe('T8.1 species card loader', () => {
  beforeAll(async () => {
    await runMigrations(DATABASE_URL, migrationsFolder());
    await seedRegions(DATABASE_URL);

    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      // Drop polluting same-name taxa from other suite files (e.g. ref.test) so
      // scientificName resolution stays unambiguous for the fixture load.
      await client.query(
        `
        DELETE FROM ref.species_cards
        WHERE taxon_id IN (
          SELECT id FROM ref.taxa
          WHERE lower(scientific_name) = 'alcedo atthis'
            AND gbif_taxon_key <> $1
        )
        `,
        [KINGFISHER_GBIF_KEY],
      );
      await client.query(
        `
        DELETE FROM ref.taxon_region
        WHERE taxon_id IN (
          SELECT id FROM ref.taxa
          WHERE lower(scientific_name) = 'alcedo atthis'
            AND gbif_taxon_key <> $1
        )
        `,
        [KINGFISHER_GBIF_KEY],
      );
      await client.query(
        `
        DELETE FROM ref.taxa
        WHERE lower(scientific_name) = 'alcedo atthis'
          AND gbif_taxon_key <> $1
        `,
        [KINGFISHER_GBIF_KEY],
      );

      await client.query(
        `
        INSERT INTO ref.taxa (
          gbif_taxon_key, scientific_name, common_names, "group", effort_group,
          coastal, tide_pref, activity_pattern, challenge_eligible
        )
        VALUES (
          $1,
          'Alcedo atthis',
          '{"en":"Common kingfisher"}'::jsonb,
          'bird',
          'Aves',
          true,
          'none',
          'diurnal',
          true
        )
        ON CONFLICT (gbif_taxon_key) DO UPDATE SET
          scientific_name = EXCLUDED.scientific_name,
          common_names = EXCLUDED.common_names
        `,
        [KINGFISHER_GBIF_KEY],
      );
    } finally {
      await client.end();
    }

    await seedSpeciesCardsFromFixture(DATABASE_URL);
  });

  it('loads a card with reviewedBy missing as draft (T8.1 acceptance)', async () => {
    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      const result = await client.query<{
        status: string;
        reviewed_by: string | null;
        region: string;
        body_md: string;
      }>(
        `
        SELECT c.status, c.reviewed_by, r.slug AS region, c.body_md
        FROM ref.species_cards c
        JOIN ref.regions r ON r.id = c.region_id
        JOIN ref.taxa t ON t.id = c.taxon_id
        WHERE t.gbif_taxon_key = $1 AND r.slug = 'scotland'
        `,
        [KINGFISHER_GBIF_KEY],
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.status).toBe('draft');
      expect(result.rows[0]?.reviewed_by).toBeNull();
      expect(result.rows[0]?.body_md).toContain('quiet rivers');
    } finally {
      await client.end();
    }
  });

  it('loads a fully stamped card as reviewed', async () => {
    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      const result = await client.query<{
        status: string;
        reviewed_by: string | null;
      }>(
        `
        SELECT c.status, c.reviewed_by
        FROM ref.species_cards c
        JOIN ref.regions r ON r.id = c.region_id
        JOIN ref.taxa t ON t.id = c.taxon_id
        WHERE t.gbif_taxon_key = $1 AND r.slug = 'sindh'
        `,
        [KINGFISHER_GBIF_KEY],
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.status).toBe('reviewed');
      expect(result.rows[0]?.reviewed_by).toBe('Arsalan');
    } finally {
      await client.end();
    }
  });

  it('upserts on re-run without duplicating taxon × region rows', async () => {
    await seedSpeciesCardsFromFixture(DATABASE_URL);
    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      const result = await client.query<{ count: string }>(
        `
        SELECT count(*)::text AS count
        FROM ref.species_cards c
        JOIN ref.taxa t ON t.id = c.taxon_id
        JOIN ref.regions r ON r.id = c.region_id
        WHERE t.gbif_taxon_key = $1
          AND r.slug = ANY($2::text[])
        `,
        [KINGFISHER_GBIF_KEY, ['scotland', 'sindh']],
      );
      expect(Number(result.rows[0]?.count)).toBe(2);
    } finally {
      await client.end();
    }
  });
});

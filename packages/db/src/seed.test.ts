import { validateDataDir } from '@wildwindow/shared';
import { Client } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';

import { migrationsFolder, runMigrations } from './migrate.js';
import { REGION_SEEDS, dataFolder, seedAll } from './seed.js';

/**
 * T2.6 + T2.7 acceptance: regions, taxa, tiers.
 * Never skip — fail if DATABASE_URL / PostGIS is unavailable.
 */
const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';

describe('T2.6 / T2.7 seeds', () => {
  beforeAll(async () => {
    await runMigrations(DATABASE_URL, migrationsFolder());
    await seedAll(DATABASE_URL);
  });

  it('seeds exactly the two beta regions with expected time zones', async () => {
    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      const result = await client.query<{
        slug: string;
        time_zone: string;
        name: string;
      }>(
        `SELECT slug, time_zone, name
         FROM ref.regions
         WHERE slug = ANY($1::text[])
         ORDER BY slug`,
        [REGION_SEEDS.map((r) => r.slug)],
      );
      expect(result.rows).toHaveLength(2);
      expect(result.rows).toEqual([
        { slug: 'scotland', time_zone: 'Europe/London', name: 'Scotland' },
        { slug: 'sindh', time_zone: 'Asia/Karachi', name: 'Sindh' },
      ]);
    } finally {
      await client.end();
    }
  });

  it('covers Glasgow in Scotland and Karachi in Sindh', async () => {
    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      const result = await client.query<{ slug: string }>(
        `
        SELECT r.slug
        FROM ref.regions r
        WHERE r.slug = 'scotland'
          AND ST_Covers(r.geom, ST_SetSRID(ST_MakePoint(-4.25, 55.86), 4326))
        UNION ALL
        SELECT r.slug
        FROM ref.regions r
        WHERE r.slug = 'sindh'
          AND ST_Covers(r.geom, ST_SetSRID(ST_MakePoint(67.01, 24.86), 4326))
        ORDER BY 1
        `,
      );
      expect(result.rows.map((row) => row.slug)).toEqual(['scotland', 'sindh']);
    } finally {
      await client.end();
    }
  });

  it('loads every beta species and tier into ref.taxa / taxon_region', async () => {
    const { betaSpecies, sensitiveSpecies } = validateDataDir(dataFolder());
    const expectedTaxonRegions = betaSpecies.species.reduce(
      (sum, entry) => sum + entry.regions.length,
      0,
    );

    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      const keys = betaSpecies.species.map((entry) => {
        if (entry.gbifTaxonKey === undefined) {
          throw new Error(`missing gbifTaxonKey for ${entry.scientificName}`);
        }
        return entry.gbifTaxonKey;
      });
      const taxa = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM ref.taxa WHERE gbif_taxon_key = ANY($1::int[])`,
        [keys],
      );
      expect(Number(taxa.rows[0]?.count)).toBe(betaSpecies.species.length);

      const links = await client.query<{ count: string }>(
        `
        SELECT count(*)::text AS count
        FROM ref.taxon_region tr
        JOIN ref.taxa t ON t.id = tr.taxon_id
        WHERE t.gbif_taxon_key = ANY($1::int[])
        `,
        [keys],
      );
      expect(Number(links.rows[0]?.count)).toBe(expectedTaxonRegions);

      const kingfisher = await client.query<{
        scientific_name: string;
        gbif_taxon_key: number;
        scotland_tier: string;
        sindh_tier: string;
      }>(
        `
        SELECT t.scientific_name, t.gbif_taxon_key,
               tr_s.tier AS scotland_tier, tr_i.tier AS sindh_tier
        FROM ref.taxa t
        JOIN ref.taxon_region tr_s ON tr_s.taxon_id = t.id
        JOIN ref.regions r_s ON r_s.id = tr_s.region_id AND r_s.slug = 'scotland'
        JOIN ref.taxon_region tr_i ON tr_i.taxon_id = t.id
        JOIN ref.regions r_i ON r_i.id = tr_i.region_id AND r_i.slug = 'sindh'
        WHERE t.scientific_name = 'Alcedo atthis'
        `,
      );
      expect(kingfisher.rows).toHaveLength(1);
      expect(kingfisher.rows[0]?.scotland_tier).toBe('open');
      expect(kingfisher.rows[0]?.sindh_tier).toBe('open');
      expect(kingfisher.rows[0]?.gbif_taxon_key).toBeGreaterThan(0);

      const capercaillie = await client.query<{ tier: string }>(
        `
        SELECT tr.tier
        FROM ref.taxa t
        JOIN ref.taxon_region tr ON tr.taxon_id = t.id
        JOIN ref.regions r ON r.id = tr.region_id
        WHERE t.scientific_name = 'Tetrao urogallus' AND r.slug = 'scotland'
        `,
      );
      expect(capercaillie.rows[0]?.tier).toBe('no_forecast');

      const ospreyLockout = await client.query<{ lockout_months: number[] }>(
        `
        SELECT tr.lockout_months
        FROM ref.taxa t
        JOIN ref.taxon_region tr ON tr.taxon_id = t.id
        JOIN ref.regions r ON r.id = tr.region_id
        WHERE t.scientific_name = 'Pandion haliaetus' AND r.slug = 'scotland'
        `,
      );
      expect(ospreyLockout.rows[0]?.lockout_months).toEqual([3, 4, 5, 6, 7, 8]);

      // Every sensitive row for a beta taxon must match what we seeded.
      for (const row of sensitiveSpecies.species) {
        const seeded = await client.query<{ tier: string }>(
          `
          SELECT tr.tier
          FROM ref.taxa t
          JOIN ref.taxon_region tr ON tr.taxon_id = t.id
          JOIN ref.regions r ON r.id = tr.region_id
          WHERE lower(t.scientific_name) = lower($1) AND r.slug = $2
          `,
          [row.scientificName, row.region],
        );
        expect(seeded.rows[0]?.tier, `${row.scientificName}@${row.region}`).toBe(row.tier);
      }
    } finally {
      await client.end();
    }
  });
});

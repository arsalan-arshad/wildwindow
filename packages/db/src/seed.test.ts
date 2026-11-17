import { Client } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';

import { migrationsFolder, runMigrations } from './migrate.js';
import { REGION_SEEDS, seedRegions } from './seed.js';

/**
 * T2.6 acceptance: seed Scotland + Sindh; Glasgow / Karachi must be covered.
 * Never skip — fail if DATABASE_URL / PostGIS is unavailable.
 */
const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';

describe('T2.6 region seeds', () => {
  beforeAll(async () => {
    await runMigrations(DATABASE_URL, migrationsFolder());
    await seedRegions(DATABASE_URL);
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
          AND ST_Covers(
            r.geom,
            ST_SetSRID(ST_MakePoint(-4.25, 55.86), 4326)
          )
        UNION ALL
        SELECT r.slug
        FROM ref.regions r
        WHERE r.slug = 'sindh'
          AND ST_Covers(
            r.geom,
            ST_SetSRID(ST_MakePoint(67.01, 24.86), 4326)
          )
        ORDER BY 1
        `,
      );
      expect(result.rows.map((row) => row.slug)).toEqual(['scotland', 'sindh']);
    } finally {
      await client.end();
    }
  });
});

import { Client } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';

import { migrationsFolder, runMigrations } from './migrate.js';
import { seedPlacesFromFixture } from './seed-places.js';
import { seedRegions } from './seed.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';

describe('T2.8 GeoNames places seed', () => {
  beforeAll(async () => {
    await runMigrations(DATABASE_URL, migrationsFolder());
    await seedRegions(DATABASE_URL);
    await seedPlacesFromFixture(DATABASE_URL);
  });

  it('finds Glasgow and Karachi with cell_r7 set', async () => {
    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      const glasgow = await client.query<{
        name: string;
        cell_r7: string;
        slug: string;
        kind: string;
      }>(
        `
        SELECT p.name, p.cell_r7, r.slug, p.kind
        FROM ref.places p
        JOIN ref.regions r ON r.id = p.region_id
        WHERE p.name = 'Glasgow' AND r.slug = 'scotland'
        `,
      );
      expect(glasgow.rows).toHaveLength(1);
      expect(glasgow.rows[0]?.kind).toBe('populated');
      expect(glasgow.rows[0]?.cell_r7.length).toBeGreaterThan(0);
      expect(glasgow.rows[0]?.cell_r7).toMatch(/^[0-9a-f]+$/i);

      const karachi = await client.query<{
        name: string;
        cell_r7: string;
        slug: string;
      }>(
        `
        SELECT p.name, p.cell_r7, r.slug
        FROM ref.places p
        JOIN ref.regions r ON r.id = p.region_id
        WHERE p.name = 'Karachi' AND r.slug = 'sindh'
        `,
      );
      expect(karachi.rows).toHaveLength(1);
      expect(karachi.rows[0]?.cell_r7.length).toBeGreaterThan(0);
    } finally {
      await client.end();
    }
  });

  it('every place has cell_r7 and outside-region cities are excluded', async () => {
    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      const missingCell = await client.query<{ count: string }>(
        `
        SELECT count(*)::text AS count
        FROM ref.places p
        JOIN ref.regions r ON r.id = p.region_id
        WHERE r.slug = ANY($1::text[])
          AND (p.cell_r7 IS NULL OR p.cell_r7 = '')
        `,
        [['scotland', 'sindh']],
      );
      expect(Number(missingCell.rows[0]?.count)).toBe(0);

      const excluded = await client.query<{ name: string }>(
        `
        SELECT p.name
        FROM ref.places p
        JOIN ref.regions r ON r.id = p.region_id
        WHERE r.slug = ANY($1::text[]) AND p.name = ANY($2::text[])
        `,
        [
          ['scotland', 'sindh'],
          ['London', 'Lahore'],
        ],
      );
      expect(excluded.rows).toEqual([]);

      const parks = await client.query<{ name: string }>(
        `
        SELECT p.name
        FROM ref.places p
        JOIN ref.regions r ON r.id = p.region_id
        WHERE r.slug = ANY($1::text[]) AND p.kind = 'park'
        ORDER BY p.name
        `,
        [['scotland', 'sindh']],
      );
      expect(parks.rows.map((r) => r.name)).toEqual(
        expect.arrayContaining(['Bellahouston Park', 'Dawsholm Park', 'Jehangir Park']),
      );
    } finally {
      await client.end();
    }
  });

  it('trigram search finds Glasgow', async () => {
    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      const result = await client.query<{ name: string }>(
        `
        SELECT name
        FROM ref.places
        WHERE name % $1
        ORDER BY similarity(name, $1) DESC
        LIMIT 3
        `,
        ['Glasgow'],
      );
      expect(result.rows.some((r) => r.name === 'Glasgow')).toBe(true);
    } finally {
      await client.end();
    }
  });
});

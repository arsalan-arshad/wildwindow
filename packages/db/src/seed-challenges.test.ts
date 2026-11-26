import { Client } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';

import { migrationsFolder, runMigrations } from './migrate.js';
import { seedChallengesFromDir } from './seed-challenges.js';
import { seedAll } from './seed.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';

const KINGFISHER_SLUG = 'kingfisher-month-2026-11';

describe('T8.4 Kingfisher Month challenge seed', () => {
  beforeAll(async () => {
    await runMigrations(DATABASE_URL, migrationsFolder());
    await seedAll(DATABASE_URL);
  });

  it('upserts Kingfisher Month for Alcedo atthis with rules and ethics pledge', async () => {
    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      const result = await client.query<{
        slug: string;
        title: string;
        scientific_name: string;
        starts_on: string;
        ends_on: string;
        status: string;
        rules_md: string;
        challenge_eligible: boolean;
      }>(
        `
        SELECT c.slug, c.title, t.scientific_name, c.starts_on::text, c.ends_on::text,
               c.status, c.rules_md, t.challenge_eligible
        FROM app.challenges c
        JOIN ref.taxa t ON t.id = c.taxon_id
        WHERE c.slug = $1
        `,
        [KINGFISHER_SLUG],
      );
      expect(result.rows).toHaveLength(1);
      const row = result.rows[0];
      expect(row).toBeDefined();
      if (row === undefined) {
        return;
      }
      expect(row.title).toBe('Kingfisher Month');
      expect(row.scientific_name).toBe('Alcedo atthis');
      expect(row.challenge_eligible).toBe(true);
      expect(row.starts_on).toBe('2026-11-01');
      expect(row.ends_on).toBe('2026-11-30');
      expect(row.status).toBe('live');
      const rules = row.rules_md.toLowerCase();
      expect(rules).toMatch(/baiting/);
      expect(rules).toMatch(/playback/);
      expect(rules).toMatch(/nest/);
      expect(rules).toMatch(/scotland/);
      expect(rules).toMatch(/sindh/);
      expect(rules).toMatch(/ethics pledge/);
    } finally {
      await client.end();
    }
  });

  it('re-running seedChallenges is idempotent on slug', async () => {
    const first = await seedChallengesFromDir(DATABASE_URL);
    const second = await seedChallengesFromDir(DATABASE_URL);
    expect(first.slugs).toContain(KINGFISHER_SLUG);
    expect(second.slugs).toEqual(first.slugs);

    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      const count = await client.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM app.challenges WHERE slug = $1`,
        [KINGFISHER_SLUG],
      );
      expect(count.rows[0]?.n).toBe('1');
    } finally {
      await client.end();
    }
  });
});

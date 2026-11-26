import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb } from './client.js';
import { migrationsFolder, runMigrations } from './migrate.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';

describe('T9.8 forecast performance indexes', () => {
  const { db, pool } = createDb({ connectionString: DATABASE_URL });

  beforeAll(async () => {
    await runMigrations(DATABASE_URL, migrationsFolder());
  });

  afterAll(async () => {
    await pool.end();
  });

  it('creates btree indexes used by loadForecastHistory neighbourhood queries', async () => {
    const rows = await db.execute<{ indexname: string }>(sql`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'pub'
        AND indexname IN (
          'taxon_cell_week_taxon_region_week_cell_idx',
          'effort_cell_week_group_region_week_cell_idx'
        )
      ORDER BY indexname
    `);
    expect(rows.rows.map((r) => r.indexname)).toEqual([
      'effort_cell_week_group_region_week_cell_idx',
      'taxon_cell_week_taxon_region_week_cell_idx',
    ]);
  });
});

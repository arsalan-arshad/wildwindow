import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { migrationsFolder, runMigrations } from './migrate.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';

const REQUIRED_SCHEMAS = ['raw', 'ref', 'pub', 'app'] as const;

async function listAppSchemas(client: Client): Promise<string[]> {
  const result = await client.query<{ schema_name: string }>(
    `SELECT schema_name
     FROM information_schema.schemata
     WHERE schema_name = ANY($1::text[])
     ORDER BY schema_name`,
    [REQUIRED_SCHEMAS],
  );
  return result.rows.map((row) => row.schema_name);
}

async function postgisInstalled(client: Client): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM pg_extension WHERE extname = 'postgis'
     ) AS exists`,
  );
  return result.rows[0]?.exists === true;
}

describe('T2.1 migrate creates schemas (idempotent)', () => {
  const client = new Client({ connectionString: DATABASE_URL });

  beforeAll(async () => {
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it('applies migrations and creates raw/ref/pub/app + postgis', async () => {
    await runMigrations(DATABASE_URL, migrationsFolder());

    expect(await postgisInstalled(client)).toBe(true);
    expect(await listAppSchemas(client)).toEqual([...REQUIRED_SCHEMAS].sort());
  });

  it('re-running migrate is a no-op', async () => {
    await runMigrations(DATABASE_URL, migrationsFolder());
    await runMigrations(DATABASE_URL, migrationsFolder());

    expect(await postgisInstalled(client)).toBe(true);
    expect(await listAppSchemas(client)).toEqual([...REQUIRED_SCHEMAS].sort());
  });
});

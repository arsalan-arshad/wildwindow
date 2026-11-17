import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadEnv } from '@wildwindow/shared';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { z } from 'zod';

import { createPool } from './client.js';

const migrateEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
});

const here = dirname(fileURLToPath(import.meta.url));

/** Folder containing SQL migrations + meta journal (shipped with the package). */
export function migrationsFolder(): string {
  // Prefer package-root migrations/ whether running from src (tsx) or dist.
  return resolve(here, '..', 'migrations');
}

export type RunMigrationsResult = {
  readonly migrationsFolder: string;
};

/**
 * Apply pending Drizzle SQL migrations using DATABASE_URL (owner / migrations role).
 * Safe to re-run: already-applied migrations are skipped (T2.1 acceptance).
 */
export async function runMigrations(
  connectionString: string,
  folder: string = migrationsFolder(),
): Promise<RunMigrationsResult> {
  const pool = createPool(connectionString);
  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: folder });
    return { migrationsFolder: folder };
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const env = loadEnv(migrateEnvSchema);
  const result = await runMigrations(env.DATABASE_URL);
  // eslint-disable-next-line no-console -- CLI progress for pnpm db:migrate
  console.log(`Migrations applied from ${result.migrationsFolder}`);
}

const isDirectRun =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console -- CLI error path
    console.error(`db:migrate failed: ${message}`);
    process.exitCode = 1;
  });
}

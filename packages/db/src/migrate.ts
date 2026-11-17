import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadEnv } from '@wildwindow/shared';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { z } from 'zod';

import { createPool } from './client.js';
import { applyRoles } from './roles.js';

const migrateEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  WW_API_DB_PASSWORD: z.string().optional(),
  WW_WORKER_DB_PASSWORD: z.string().optional(),
});

const here = dirname(fileURLToPath(import.meta.url));

/** Folder containing SQL migrations + meta journal (shipped with the package). */
export function migrationsFolder(): string {
  // Prefer package-root migrations/ whether running from src (tsx) or dist.
  return resolve(here, '..', 'migrations');
}

export type RunMigrationsResult = {
  readonly migrationsFolder: string;
  readonly rolesApplied: boolean;
};

/**
 * Apply pending Drizzle SQL migrations using DATABASE_URL (owner / migrations role).
 * When both role passwords are set, also applies §6.3 roles (T2.5).
 * Safe to re-run: already-applied migrations are skipped (T2.1 acceptance).
 */
export async function runMigrations(
  connectionString: string,
  folder: string = migrationsFolder(),
  rolePasswords?: { apiPassword: string; workerPassword: string },
): Promise<RunMigrationsResult> {
  const pool = createPool(connectionString);
  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: folder });
  } finally {
    await pool.end();
  }

  let rolesApplied = false;
  if (rolePasswords !== undefined) {
    await applyRoles(connectionString, rolePasswords);
    rolesApplied = true;
  }

  return { migrationsFolder: folder, rolesApplied };
}

async function main(): Promise<void> {
  const env = loadEnv(migrateEnvSchema);
  const apiPassword = env.WW_API_DB_PASSWORD;
  const workerPassword = env.WW_WORKER_DB_PASSWORD;
  const rolePasswords =
    apiPassword !== undefined &&
    apiPassword.length > 0 &&
    workerPassword !== undefined &&
    workerPassword.length > 0
      ? { apiPassword, workerPassword }
      : undefined;

  const result = await runMigrations(env.DATABASE_URL, migrationsFolder(), rolePasswords);
  // eslint-disable-next-line no-console -- CLI progress for pnpm db:migrate
  console.log(`Migrations applied from ${result.migrationsFolder}`);
  if (result.rolesApplied) {
    // eslint-disable-next-line no-console -- CLI progress for pnpm db:migrate
    console.log('Database roles ww_api / ww_worker applied (T2.5)');
  } else {
    // eslint-disable-next-line no-console -- CLI guidance
    console.log(
      'Skipped roles: set WW_API_DB_PASSWORD and WW_WORKER_DB_PASSWORD to apply ww_api / ww_worker',
    );
  }
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

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema/index.js';

export type Database = NodePgDatabase<typeof schema>;

export type CreateDbOptions = {
  readonly connectionString: string;
};

/**
 * Create a Drizzle client over node-postgres.
 * Caller owns Pool lifecycle when using `createPool` + `drizzle(pool)`.
 */
export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString });
}

export function createDb(options: CreateDbOptions): {
  db: Database;
  pool: Pool;
} {
  const pool = createPool(options.connectionString);
  const db = drizzle(pool, { schema });
  return { db, pool };
}

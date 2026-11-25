import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createDb } from './client.js';
import { migrationsFolder, runMigrations } from './migrate.js';
import { applyRoles, roleConnectionUrl } from './roles.js';
import { waitlist } from './schema/app.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';
const API_PASSWORD = process.env['WW_API_DB_PASSWORD'] ?? 'ww_api_test_password';
const WORKER_PASSWORD = process.env['WW_WORKER_DB_PASSWORD'] ?? 'ww_worker_test_password';

function pgErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    const record = current as Record<string, unknown>;
    if (typeof record['code'] === 'string') {
      return record['code'];
    }
    if (!('cause' in record)) {
      return undefined;
    }
    current = record['cause'];
  }
  return undefined;
}

describe('app.waitlist extended columns', () => {
  beforeAll(async () => {
    await runMigrations(DATABASE_URL, migrationsFolder());
    await applyRoles(DATABASE_URL, {
      apiPassword: API_PASSWORD,
      workerPassword: WORKER_PASSWORD,
    });
  });

  beforeEach(async () => {
    const { db, pool } = createDb({
      connectionString: roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD),
    });
    try {
      await db.delete(waitlist);
    } finally {
      await pool.end();
    }
  });

  it('enforces unique lower(email) for ww_api inserts', async () => {
    const { db, pool } = createDb({
      connectionString: roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD),
    });
    try {
      await db.insert(waitlist).values({
        email: 'name@x.com',
        consentAt: new Date(),
        source: 'waitlist',
      });
      await expect(
        db.insert(waitlist).values({
          email: 'Name@x.com',
          consentAt: new Date(),
          source: 'landing',
        }),
      ).rejects.toSatisfy((error: unknown) => pgErrorCode(error) === '23505');
    } finally {
      await pool.end();
    }
  });
});

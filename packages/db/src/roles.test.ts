import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { migrationsFolder, runMigrations } from './migrate.js';
import { applyRoles, roleConnectionUrl } from './roles.js';

/**
 * T2.5 acceptance: ww_api must not read raw.occurrences and must read pub.
 * This suite must never be skipped — fail hard if DATABASE_URL is missing.
 */
const DATABASE_URL = process.env['DATABASE_URL'];
if (DATABASE_URL === undefined || DATABASE_URL.length === 0) {
  throw new Error('DATABASE_URL is required for T2.5 roles isolation tests (must not skip)');
}

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

describe('T2.5 ww_api privacy isolation', () => {
  beforeAll(async () => {
    await runMigrations(DATABASE_URL, migrationsFolder());
    await applyRoles(DATABASE_URL, {
      apiPassword: API_PASSWORD,
      workerPassword: WORKER_PASSWORD,
    });
  });

  afterAll(async () => {
    // no shared pool; each test opens its own client
  });

  it('denies ww_api SELECT on raw.occurrences', async () => {
    const client = new Client({
      connectionString: roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD),
    });
    await client.connect();
    try {
      let denied = false;
      try {
        await client.query('SELECT 1 FROM raw.occurrences');
      } catch (error: unknown) {
        denied = true;
        // insufficient_privilege
        expect(pgErrorCode(error)).toBe('42501');
      }
      expect(denied).toBe(true);
    } finally {
      await client.end();
    }
  });

  it('allows ww_api SELECT on pub.taxon_cell_week', async () => {
    const client = new Client({
      connectionString: roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD),
    });
    await client.connect();
    try {
      const result = await client.query('SELECT 1 AS ok FROM pub.taxon_cell_week LIMIT 1');
      expect(result.command).toBe('SELECT');
      expect(Array.isArray(result.rows)).toBe(true);
    } finally {
      await client.end();
    }
  });
});

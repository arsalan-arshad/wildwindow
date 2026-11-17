import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb } from './client.js';
import { migrationsFolder, runMigrations } from './migrate.js';
import { taxa, users, watchlist } from './schema/index.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';

function requireRow<T>(row: T | undefined, label: string): T {
  if (row === undefined) {
    throw new Error(`expected ${label} row`);
  }
  return row;
}

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

function isUniqueViolation(error: unknown): boolean {
  return pgErrorCode(error) === '23505';
}

describe('T2.4 app tables unique constraints', () => {
  const { db, pool } = createDb({ connectionString: DATABASE_URL });

  beforeAll(async () => {
    await runMigrations(DATABASE_URL, migrationsFolder());
  });

  afterAll(async () => {
    await pool.end();
  });

  it('enforces users.firebase_uid uniqueness', async () => {
    const suffix = String(Date.now());
    const firebaseUid = `firebase-uid-${suffix}`;

    await db.insert(users).values({
      firebaseUid,
      displayName: 'First',
    });

    let threw = false;
    try {
      await db.insert(users).values({
        firebaseUid,
        displayName: 'Duplicate',
      });
    } catch (error: unknown) {
      threw = true;
      expect(isUniqueViolation(error)).toBe(true);
    }
    expect(threw).toBe(true);
  });

  it('enforces watchlist (user_id, taxon_id, cell_r7) uniqueness', async () => {
    const suffix = String(Date.now());

    const [userRow] = await db
      .insert(users)
      .values({
        firebaseUid: `wl-user-${suffix}`,
        displayName: 'Watcher',
      })
      .returning({ id: users.id });
    const user = requireRow(userRow, 'user');

    const [taxonRow] = await db
      .insert(taxa)
      .values({
        gbifTaxonKey: 1_800_000_000 + (Date.now() % 100_000_000),
        scientificName: 'Watchlist taxon',
        commonNames: { en: 'Watch bird' },
        group: 'bird',
        effortGroup: 'birds',
      })
      .returning({ id: taxa.id });
    const taxon = requireRow(taxonRow, 'taxon');

    const cellR7 = '8719582a8ffffff';
    await db.insert(watchlist).values({
      userId: user.id,
      taxonId: taxon.id,
      cellR7,
    });

    let threw = false;
    try {
      await db.insert(watchlist).values({
        userId: user.id,
        taxonId: taxon.id,
        cellR7,
      });
    } catch (error: unknown) {
      threw = true;
      expect(isUniqueViolation(error)).toBe(true);
    }
    expect(threw).toBe(true);
  });
});

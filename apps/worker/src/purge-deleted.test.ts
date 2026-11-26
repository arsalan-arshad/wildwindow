import { access, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  challengeEntries,
  challenges,
  createDb,
  logbookEntries,
  migrationsFolder,
  runMigrations,
  taxa,
  users,
  watchlist,
} from '@wildwindow/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { runPurgeDeleted } from './purge-deleted.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';

const UID = 'purge-deleted-test-uid';
const UID_FRESH = 'purge-deleted-test-uid-fresh';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('purge-deleted (T5.14)', () => {
  const { db, pool } = createDb({ connectionString: DATABASE_URL });
  let storageRoot: string;
  let challengeId: number | undefined;
  let createdTaxonId: number | undefined;

  beforeAll(async () => {
    await runMigrations(DATABASE_URL, migrationsFolder());
    storageRoot = await mkdtemp(join(tmpdir(), 'ww-purge-'));
  });

  async function cleanupUsers(): Promise<void> {
    for (const uid of [UID, UID_FRESH]) {
      const rows = await db.select({ id: users.id }).from(users).where(eq(users.firebaseUid, uid));
      for (const row of rows) {
        await db.delete(challengeEntries).where(eq(challengeEntries.userId, row.id));
        await db.delete(logbookEntries).where(eq(logbookEntries.userId, row.id));
        await db.delete(watchlist).where(eq(watchlist.userId, row.id));
        await db.delete(users).where(eq(users.id, row.id));
      }
    }
    if (challengeId !== undefined) {
      await db.delete(challenges).where(eq(challenges.id, challengeId));
      challengeId = undefined;
    }
    if (createdTaxonId !== undefined) {
      await db.delete(taxa).where(eq(taxa.id, createdTaxonId));
      createdTaxonId = undefined;
    }
  }

  beforeEach(async () => {
    await cleanupUsers();
  });

  afterAll(async () => {
    await cleanupUsers();
    await pool.end();
    await rm(storageRoot, { recursive: true, force: true });
  });

  async function ensureTaxon(): Promise<number> {
    const existing = await db.select({ id: taxa.id }).from(taxa).limit(1);
    const hit = existing[0]?.id;
    if (hit !== undefined) {
      return hit;
    }
    const inserted = await db
      .insert(taxa)
      .values({
        gbifTaxonKey: 1_930_000_001 + (Date.now() % 1000),
        scientificName: `Purge deleted test taxon ${String(Date.now())}`,
        commonNames: { en: 'Purge bird' },
        group: 'bird',
        effortGroup: 'birds',
      })
      .returning({ id: taxa.id });
    const id = inserted[0]?.id;
    if (id === undefined) {
      throw new Error('expected taxon insert');
    }
    createdTaxonId = id;
    return id;
  }

  it('hard-deletes soft-deleted users older than retention, including photos and exports', async () => {
    const taxonId = await ensureTaxon();

    const [user] = await db
      .insert(users)
      .values({
        firebaseUid: UID,
        email: 'purge-deleted@example.com',
        displayName: 'Purge Me',
        deletedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      })
      .returning({ id: users.id });
    if (user === undefined) {
      throw new Error('expected user');
    }

    const photoKey = `uploads/${user.id}/purge.jpg`;
    const thumbKey = `uploads/${user.id}/purge-thumb.jpg`;
    const exportKey = `exports/${user.id}/old-export.json`;
    await mkdir(join(storageRoot, 'uploads', user.id), { recursive: true });
    await mkdir(join(storageRoot, 'exports', user.id), { recursive: true });
    await writeFile(join(storageRoot, photoKey), Buffer.from('photo'));
    await writeFile(join(storageRoot, thumbKey), Buffer.from('thumb'));
    await writeFile(join(storageRoot, exportKey), Buffer.from('{"ok":true}\n'));

    await db.insert(watchlist).values({
      userId: user.id,
      taxonId,
      cellR7: '871f1d489ffffff',
    });

    const [lb] = await db
      .insert(logbookEntries)
      .values({
        userId: user.id,
        taxonId,
        takenAt: new Date('2026-11-01T10:00:00.000Z'),
        photoKey,
        thumbKey,
        notes: 'purge me',
      })
      .returning({ id: logbookEntries.id });
    if (lb === undefined) {
      throw new Error('expected logbook');
    }

    const [ch] = await db
      .insert(challenges)
      .values({
        slug: `purge-e2e-${String(Date.now() % 1_000_000)}`,
        title: 'Purge challenge',
        taxonId,
        startsOn: '2026-11-01',
        endsOn: '2026-12-01',
        rulesMd: 'rules',
        status: 'live',
      })
      .returning({ id: challenges.id });
    challengeId = ch?.id;
    if (challengeId === undefined) {
      throw new Error('expected challenge');
    }

    await db.insert(challengeEntries).values({
      challengeId,
      userId: user.id,
      logbookEntryId: lb.id,
      countryCode: 'GB',
      regionLabel: 'Scotland',
      photoKey,
      pledgeAcceptedAt: new Date('2026-11-02T00:00:00.000Z'),
      status: 'pending',
      publishAfter: new Date('2026-11-09T00:00:00.000Z'),
    });

    const [fresh] = await db
      .insert(users)
      .values({
        firebaseUid: UID_FRESH,
        email: 'purge-fresh@example.com',
        deletedAt: new Date(),
      })
      .returning({ id: users.id });

    const result = await runPurgeDeleted({
      env: { DATABASE_URL },
      storageEnv: {
        NODE_ENV: 'test',
        STORAGE_DRIVER: 'local',
        LOCAL_STORAGE_DIR: storageRoot,
      },
      retentionDays: 30,
    });

    expect(result.purgedUsers).toBeGreaterThanOrEqual(1);
    expect(result.userIds).toContain(user.id);
    expect(result.userIds).not.toContain(fresh?.id);

    expect(await db.select({ id: users.id }).from(users).where(eq(users.id, user.id))).toEqual([]);
    expect(
      await db.select({ id: watchlist.id }).from(watchlist).where(eq(watchlist.userId, user.id)),
    ).toEqual([]);
    expect(
      await db
        .select({ id: logbookEntries.id })
        .from(logbookEntries)
        .where(eq(logbookEntries.userId, user.id)),
    ).toEqual([]);
    expect(
      await db
        .select({ id: challengeEntries.id })
        .from(challengeEntries)
        .where(eq(challengeEntries.userId, user.id)),
    ).toEqual([]);

    expect(await pathExists(join(storageRoot, photoKey))).toBe(false);
    expect(await pathExists(join(storageRoot, thumbKey))).toBe(false);
    expect(await pathExists(join(storageRoot, 'exports', user.id))).toBe(false);

    if (fresh !== undefined) {
      const still = await db.select({ id: users.id }).from(users).where(eq(users.id, fresh.id));
      expect(still).toHaveLength(1);
    }
  });

  it('skips accounts still inside the retention window', async () => {
    const [user] = await db
      .insert(users)
      .values({
        firebaseUid: UID,
        email: 'purge-recent@example.com',
        deletedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      })
      .returning({ id: users.id });
    if (user === undefined) {
      throw new Error('expected user');
    }

    const result = await runPurgeDeleted({
      env: { DATABASE_URL },
      storageEnv: {
        NODE_ENV: 'test',
        STORAGE_DRIVER: 'local',
        LOCAL_STORAGE_DIR: storageRoot,
      },
      retentionDays: 30,
    });

    expect(result.userIds).not.toContain(user.id);
    const still = await db.select({ id: users.id }).from(users).where(eq(users.id, user.id));
    expect(still).toHaveLength(1);
  });
});

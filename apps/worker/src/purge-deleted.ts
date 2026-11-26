import {
  auditLog,
  challengeEntries,
  createDb,
  entitlements,
  logbookEntries,
  users,
  watchlist,
} from '@wildwindow/db';
import { loadEnv } from '@wildwindow/shared';
import { and, eq, isNotNull, lte } from 'drizzle-orm';
import { z } from 'zod';

import {
  createPurgeStorage,
  loadPurgeStorageEnv,
  type PurgeStorage,
  type PurgeStorageEnv,
} from './storage/create-storage.js';

/** Soft-delete retention before hard purge (ARCHITECTURE §7 / T5.14). */
export const PURGE_RETENTION_DAYS = 30 as const;

const purgeDbEnvSchema = z.object({
  /**
   * Owner / migrations URL — `ww_worker` has no DML on app.users / logbook (§6.3).
   * Same pattern as `make-admin`.
   */
  DATABASE_URL: z.string().min(1),
});

export type PurgeDeletedOptions = {
  readonly env?: z.infer<typeof purgeDbEnvSchema>;
  readonly storageEnv?: PurgeStorageEnv;
  readonly storage?: PurgeStorage;
  /** Clock injection for tests. */
  readonly now?: Date;
  /** Override retention (default 30). Tests may pass `0` to purge immediately. */
  readonly retentionDays?: number;
};

export type PurgeDeletedResult = {
  readonly purgedUsers: number;
  readonly deletedObjects: number;
  readonly userIds: readonly string[];
};

/**
 * Hard-delete accounts soft-deleted at least `retentionDays` ago, including photos
 * and export objects (T5.14).
 */
export async function runPurgeDeleted(
  options: PurgeDeletedOptions = {},
): Promise<PurgeDeletedResult> {
  const env = options.env ?? loadEnv(purgeDbEnvSchema);
  const retentionDays = options.retentionDays ?? PURGE_RETENTION_DAYS;
  if (!Number.isInteger(retentionDays) || retentionDays < 0) {
    throw new Error(`purge-deleted: retentionDays must be a non-negative integer`);
  }

  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

  const storage =
    options.storage ??
    createPurgeStorage(options.storageEnv ?? loadPurgeStorageEnv());

  const { db, pool } = createDb({ connectionString: env.DATABASE_URL });
  try {
    const due = await db
      .select({ id: users.id })
      .from(users)
      .where(and(isNotNull(users.deletedAt), lte(users.deletedAt, cutoff)));

    let deletedObjects = 0;
    const userIds: string[] = [];

    for (const row of due) {
      const objects = await purgeOneUser(db, storage, row.id);
      deletedObjects += objects;
      userIds.push(row.id);
    }

    return {
      purgedUsers: userIds.length,
      deletedObjects,
      userIds,
    };
  } finally {
    await pool.end();
  }
}

type Db = ReturnType<typeof createDb>['db'];

async function purgeOneUser(db: Db, storage: PurgeStorage, userId: string): Promise<number> {
  const logbookRows = await db
    .select({
      photoKey: logbookEntries.photoKey,
      thumbKey: logbookEntries.thumbKey,
    })
    .from(logbookEntries)
    .where(eq(logbookEntries.userId, userId));

  const challengeRows = await db
    .select({ photoKey: challengeEntries.photoKey })
    .from(challengeEntries)
    .where(eq(challengeEntries.userId, userId));

  const objectKeys = new Set<string>();
  for (const row of logbookRows) {
    objectKeys.add(row.photoKey);
    if (row.thumbKey !== null && row.thumbKey.length > 0) {
      objectKeys.add(row.thumbKey);
    }
  }
  for (const row of challengeRows) {
    objectKeys.add(row.photoKey);
  }

  // FK order: challenge_entries → logbook → watchlist/entitlements → audit null → users
  await db.delete(challengeEntries).where(eq(challengeEntries.userId, userId));
  await db.delete(logbookEntries).where(eq(logbookEntries.userId, userId));
  await db.delete(watchlist).where(eq(watchlist.userId, userId));
  await db.delete(entitlements).where(eq(entitlements.userId, userId));
  await db
    .update(auditLog)
    .set({ actorUserId: null })
    .where(eq(auditLog.actorUserId, userId));

  const deleted = await db.delete(users).where(eq(users.id, userId)).returning({ id: users.id });
  if (deleted[0] === undefined) {
    // Concurrent purge — treat as already gone.
    return 0;
  }

  let deletedObjects = 0;
  for (const key of objectKeys) {
    await storage.deleteObject(key);
    deletedObjects += 1;
  }
  deletedObjects += await storage.deleteUserExportPrefix(userId);

  return deletedObjects;
}

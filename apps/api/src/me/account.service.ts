import { Inject, Injectable } from '@nestjs/common';
import {
  challengeEntries,
  logbookEntries,
  regions,
  users,
  watchlist,
  type Database,
} from '@wildwindow/db';
import {
  type MeDeleteOk,
  type MeExportOk,
  type OwnerExactLocation,
} from '@wildwindow/shared';
import { and, asc, eq, isNull } from 'drizzle-orm';

import { API_ENV, type ApiEnv } from '../config/api-env.js';
import { DB } from '../db/db.module.js';
import { notFoundError, serviceUnavailable } from '../http/api-error.js';
import { STORAGE_SERVICE, type StorageService } from '../storage/storage.types.js';

import { decryptExactPoint, resolveLogbookEncKey } from './logbook-crypto.js';

/** Soft-delete grace period before worker `purge-deleted` hard-deletes (ARCHITECTURE §7). */
export const ACCOUNT_PURGE_AFTER_DAYS = 30 as const;

/** Signed download / photo link TTL for data export (PRD US-12). */
const EXPORT_URL_TTL_SECONDS = 24 * 60 * 60;

export type AccountExportPayload = {
  readonly exportedAt: string;
  readonly user: {
    readonly id: string;
    readonly email: string | null;
    readonly displayName: string | null;
    readonly homeRegionSlug: string | null;
    readonly locale: string;
    readonly role: string;
    readonly createdAt: string;
  };
  readonly watchlist: ReadonlyArray<{
    readonly id: string;
    readonly taxonId: string;
    readonly cellR7: string;
    readonly createdAt: string;
  }>;
  readonly logbook: ReadonlyArray<{
    readonly id: string;
    readonly taxonId: string | null;
    readonly takenAt: string;
    readonly cellR7: string | null;
    readonly photoKey: string;
    readonly photoUrl: string;
    readonly thumbKey: string | null;
    readonly thumbUrl: string | null;
    readonly exif: Record<string, unknown>;
    readonly notes: string | null;
    readonly exactLocation: OwnerExactLocation | null;
    readonly createdAt: string;
    readonly updatedAt: string;
  }>;
  readonly challengeEntries: ReadonlyArray<{
    readonly id: string;
    readonly challengeId: string;
    readonly logbookEntryId: string;
    readonly countryCode: string;
    readonly regionLabel: string;
    readonly photoKey: string;
    readonly photoUrl: string;
    readonly status: string;
    readonly rejectReason: string | null;
    readonly pledgeAcceptedAt: string;
    readonly publishAfter: string;
    readonly createdAt: string;
  }>;
};

@Injectable()
export class AccountService {
  private readonly encKey: Buffer;

  constructor(
    @Inject(DB) private readonly db: Database | null,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {
    this.encKey = resolveLogbookEncKey(env.LOGBOOK_ENC_KEY, env.NODE_ENV);
  }

  private requireDb(): Database {
    if (this.db === null) {
      throw serviceUnavailable('Database is not configured');
    }
    return this.db;
  }

  /** Soft-delete the account; worker `purge-deleted` hard-deletes after 30 days. */
  async softDelete(userId: string, now: Date = new Date()): Promise<MeDeleteOk> {
    const db = this.requireDb();
    const [updated] = await db
      .update(users)
      .set({ deletedAt: now })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .returning({ id: users.id });

    if (updated === undefined) {
      throw notFoundError('User not found');
    }

    return { ok: true, purgeAfterDays: ACCOUNT_PURGE_AFTER_DAYS };
  }

  /**
   * Build a JSON export of every user-owned record (with signed photo links),
   * store it, and return a signed download URL (ARCHITECTURE §7 / T5.14).
   */
  async exportData(userId: string, now: Date = new Date()): Promise<MeExportOk> {
    const db = this.requireDb();

    const userRows = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        locale: users.locale,
        role: users.role,
        createdAt: users.createdAt,
        regionSlug: regions.slug,
      })
      .from(users)
      .leftJoin(regions, eq(users.homeRegionId, regions.id))
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    const user = userRows[0];
    if (user === undefined) {
      throw notFoundError('User not found');
    }

    const watchlistRows = await db
      .select({
        id: watchlist.id,
        taxonId: watchlist.taxonId,
        cellR7: watchlist.cellR7,
        createdAt: watchlist.createdAt,
      })
      .from(watchlist)
      .where(eq(watchlist.userId, userId))
      .orderBy(asc(watchlist.id));

    const logbookRows = await db
      .select({
        id: logbookEntries.id,
        taxonId: logbookEntries.taxonId,
        takenAt: logbookEntries.takenAt,
        cellR7: logbookEntries.cellR7,
        exactPointEnc: logbookEntries.exactPointEnc,
        photoKey: logbookEntries.photoKey,
        thumbKey: logbookEntries.thumbKey,
        exif: logbookEntries.exif,
        notes: logbookEntries.notes,
        createdAt: logbookEntries.createdAt,
        updatedAt: logbookEntries.updatedAt,
      })
      .from(logbookEntries)
      .where(eq(logbookEntries.userId, userId))
      .orderBy(asc(logbookEntries.id));

    const challengeRows = await db
      .select({
        id: challengeEntries.id,
        challengeId: challengeEntries.challengeId,
        logbookEntryId: challengeEntries.logbookEntryId,
        countryCode: challengeEntries.countryCode,
        regionLabel: challengeEntries.regionLabel,
        photoKey: challengeEntries.photoKey,
        status: challengeEntries.status,
        rejectReason: challengeEntries.rejectReason,
        pledgeAcceptedAt: challengeEntries.pledgeAcceptedAt,
        publishAfter: challengeEntries.publishAfter,
        createdAt: challengeEntries.createdAt,
      })
      .from(challengeEntries)
      .where(eq(challengeEntries.userId, userId))
      .orderBy(asc(challengeEntries.id));

    const logbook = await Promise.all(
      logbookRows.map(async (row) => {
        const photo = await this.storage.createPresignedGet({
          key: row.photoKey,
          expiresInSeconds: EXPORT_URL_TTL_SECONDS,
        });
        let thumbUrl: string | null = null;
        if (row.thumbKey !== null && row.thumbKey.length > 0) {
          const thumb = await this.storage.createPresignedGet({
            key: row.thumbKey,
            expiresInSeconds: EXPORT_URL_TTL_SECONDS,
          });
          thumbUrl = thumb.url;
        }
        return {
          id: String(row.id),
          taxonId: row.taxonId === null ? null : String(row.taxonId),
          takenAt: row.takenAt.toISOString(),
          cellR7: row.cellR7,
          photoKey: row.photoKey,
          photoUrl: photo.url,
          thumbKey: row.thumbKey,
          thumbUrl,
          exif: row.exif,
          notes: row.notes,
          exactLocation:
            row.exactPointEnc === null ? null : decryptExactPoint(row.exactPointEnc, this.encKey),
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        };
      }),
    );

    const challenges = await Promise.all(
      challengeRows.map(async (row) => {
        const photo = await this.storage.createPresignedGet({
          key: row.photoKey,
          expiresInSeconds: EXPORT_URL_TTL_SECONDS,
        });
        return {
          id: String(row.id),
          challengeId: String(row.challengeId),
          logbookEntryId: String(row.logbookEntryId),
          countryCode: row.countryCode,
          regionLabel: row.regionLabel,
          photoKey: row.photoKey,
          photoUrl: photo.url,
          status: row.status,
          rejectReason: row.rejectReason,
          pledgeAcceptedAt: row.pledgeAcceptedAt.toISOString(),
          publishAfter: row.publishAfter.toISOString(),
          createdAt: row.createdAt.toISOString(),
        };
      }),
    );

    const payload: AccountExportPayload = {
      exportedAt: now.toISOString(),
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        homeRegionSlug: user.regionSlug,
        locale: user.locale,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
      watchlist: watchlistRows.map((row) => ({
        id: String(row.id),
        taxonId: String(row.taxonId),
        cellR7: row.cellR7,
        createdAt: row.createdAt.toISOString(),
      })),
      logbook,
      challengeEntries: challenges,
    };

    const exportKey = `exports/${userId}/${now.toISOString().replace(/[:.]/g, '-')}.json`;
    const body = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    await this.storage.putObject(exportKey, body, 'application/json');

    const signed = await this.storage.createPresignedGet({
      key: exportKey,
      expiresInSeconds: EXPORT_URL_TTL_SECONDS,
    });

    return {
      status: 'ready',
      downloadUrl: signed.url,
    };
  }
}

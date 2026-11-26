import { Inject, Injectable } from '@nestjs/common';
import { taxa, watchlist, type Database } from '@wildwindow/db';
import {
  type WatchlistCreateRequest,
  type WatchlistItem,
  type WatchlistResponse,
} from '@wildwindow/shared';
import { and, asc, count, eq } from 'drizzle-orm';
import { getResolution, isValidCell } from 'h3-js';

import { API_ENV, type ApiEnv } from '../config/api-env.js';
import { DB } from '../db/db.module.js';
import {
  notFoundError,
  serviceUnavailable,
  validationError,
  watchlistLimitError,
} from '../http/api-error.js';

function parseTaxonId(raw: string): number {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw validationError('taxonId must be a positive integer');
  }
  const id = Number(trimmed);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw validationError('taxonId must be a positive integer');
  }
  return id;
}

function parseCellR7(raw: string): string {
  const cell = raw.trim().toLowerCase();
  if (cell.length === 0 || !isValidCell(cell) || getResolution(cell) !== 7) {
    throw validationError('cellR7 must be a valid H3 resolution-7 cell');
  }
  return cell;
}

function parseWatchlistId(raw: string): number {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw notFoundError('Watchlist item not found');
  }
  const id = Number(trimmed);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw notFoundError('Watchlist item not found');
  }
  return id;
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6; depth += 1) {
    if (typeof current !== 'object' || current === null) {
      return false;
    }
    const record = current as Record<string, unknown>;
    if (record['code'] === '23505') {
      return true;
    }
    if (!('cause' in record)) {
      return false;
    }
    current = record['cause'];
  }
  return false;
}

function toItem(row: {
  readonly id: number;
  readonly taxonId: number;
  readonly cellR7: string;
  readonly createdAt: Date;
}): WatchlistItem {
  return {
    id: String(row.id),
    taxonId: String(row.taxonId),
    cellR7: row.cellR7,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class WatchlistService {
  constructor(
    @Inject(DB) private readonly db: Database | null,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  private requireDb(): Database {
    if (this.db === null) {
      throw serviceUnavailable('Database is not configured');
    }
    return this.db;
  }

  async list(userId: string): Promise<WatchlistResponse> {
    const db = this.requireDb();
    const rows = await db
      .select({
        id: watchlist.id,
        taxonId: watchlist.taxonId,
        cellR7: watchlist.cellR7,
        createdAt: watchlist.createdAt,
      })
      .from(watchlist)
      .where(eq(watchlist.userId, userId))
      .orderBy(asc(watchlist.createdAt), asc(watchlist.id));

    return {
      items: rows.map(toItem),
      limit: this.env.WATCHLIST_LIMIT_FREE,
    };
  }

  async add(userId: string, body: WatchlistCreateRequest): Promise<WatchlistItem> {
    const db = this.requireDb();
    const taxonId = parseTaxonId(body.taxonId);
    const cellR7 = parseCellR7(body.cellR7);
    const limit = this.env.WATCHLIST_LIMIT_FREE;

    const taxonRows = await db
      .select({ id: taxa.id })
      .from(taxa)
      .where(eq(taxa.id, taxonId))
      .limit(1);
    if (taxonRows[0] === undefined) {
      throw notFoundError(`Unknown taxon: ${String(taxonId)}`);
    }

    // Idempotent: same (taxon, cell) for this user returns the existing row.
    const existing = await db
      .select({
        id: watchlist.id,
        taxonId: watchlist.taxonId,
        cellR7: watchlist.cellR7,
        createdAt: watchlist.createdAt,
      })
      .from(watchlist)
      .where(
        and(
          eq(watchlist.userId, userId),
          eq(watchlist.taxonId, taxonId),
          eq(watchlist.cellR7, cellR7),
        ),
      )
      .limit(1);
    const already = existing[0];
    if (already !== undefined) {
      return toItem(already);
    }

    const [countRow] = await db
      .select({ n: count() })
      .from(watchlist)
      .where(eq(watchlist.userId, userId));
    const currentCount = countRow?.n ?? 0;
    if (currentCount >= limit) {
      throw watchlistLimitError(limit);
    }

    try {
      const [inserted] = await db.insert(watchlist).values({ userId, taxonId, cellR7 }).returning({
        id: watchlist.id,
        taxonId: watchlist.taxonId,
        cellR7: watchlist.cellR7,
        createdAt: watchlist.createdAt,
      });
      if (inserted === undefined) {
        throw serviceUnavailable('Failed to create watchlist item');
      }
      return toItem(inserted);
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        // Race: another request inserted the same triple — return it.
        const raced = await db
          .select({
            id: watchlist.id,
            taxonId: watchlist.taxonId,
            cellR7: watchlist.cellR7,
            createdAt: watchlist.createdAt,
          })
          .from(watchlist)
          .where(
            and(
              eq(watchlist.userId, userId),
              eq(watchlist.taxonId, taxonId),
              eq(watchlist.cellR7, cellR7),
            ),
          )
          .limit(1);
        const row = raced[0];
        if (row !== undefined) {
          return toItem(row);
        }
      }
      throw error;
    }
  }

  async remove(userId: string, idRaw: string): Promise<void> {
    const db = this.requireDb();
    const id = parseWatchlistId(idRaw);

    const deleted = await db
      .delete(watchlist)
      .where(and(eq(watchlist.id, id), eq(watchlist.userId, userId)))
      .returning({ id: watchlist.id });

    if (deleted[0] === undefined) {
      // Same 404 whether missing or owned by someone else (no cross-user leak).
      throw notFoundError('Watchlist item not found');
    }
  }
}

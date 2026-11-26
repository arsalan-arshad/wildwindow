import { Inject, Injectable } from '@nestjs/common';
import { logbookEntries, taxa, type Database } from '@wildwindow/db';
import {
  type LogbookCreateRequest,
  type LogbookEntryOwner,
  type LogbookEntryPublic,
  type LogbookListResponse,
  type LogbookPatchRequest,
  type OwnerExactLocation,
} from '@wildwindow/shared';
import { and, asc, desc, eq } from 'drizzle-orm';
import { getResolution, isValidCell } from 'h3-js';

import { API_ENV, type ApiEnv } from '../config/api-env.js';
import { DB } from '../db/db.module.js';
import { notFoundError, serviceUnavailable, validationError } from '../http/api-error.js';
import { STORAGE_SERVICE, type StorageService } from '../storage/storage.types.js';

import { decryptExactPoint, encryptExactPoint, resolveLogbookEncKey } from './logbook-crypto.js';

type LogbookRow = {
  readonly id: number;
  readonly taxonId: number | null;
  readonly takenAt: Date;
  readonly cellR7: string | null;
  readonly exactPointEnc: Buffer | null;
  readonly photoKey: string;
  readonly thumbKey: string | null;
  readonly exif: Record<string, unknown>;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

function parseOptionalTaxonId(raw: string | null | undefined): number | null | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (raw === null) {
    return null;
  }
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

function parseOptionalCellR7(raw: string | null | undefined): string | null | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (raw === null) {
    return null;
  }
  const cell = raw.trim().toLowerCase();
  if (cell.length === 0 || !isValidCell(cell) || getResolution(cell) !== 7) {
    throw validationError('cellR7 must be a valid H3 resolution-7 cell');
  }
  return cell;
}

function parseLogbookId(raw: string): number {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw notFoundError('Logbook entry not found');
  }
  const id = Number(trimmed);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw notFoundError('Logbook entry not found');
  }
  return id;
}

function parseTakenAt(raw: string): Date {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw validationError('takenAt must be an ISO-8601 datetime');
  }
  return date;
}

function assertOwnedPhotoKey(userId: string, photoKey: string): void {
  const prefix = `uploads/${userId}/`;
  if (!photoKey.startsWith(prefix) || photoKey.includes('..') || photoKey.includes('\0')) {
    throw validationError('photoKey must be an upload owned by the current user');
  }
}

function toPublic(row: LogbookRow): LogbookEntryPublic {
  return {
    id: String(row.id),
    taxonId: row.taxonId === null ? null : String(row.taxonId),
    takenAt: row.takenAt.toISOString(),
    cellR7: row.cellR7,
    photoKey: row.photoKey,
    thumbKey: row.thumbKey,
    exif: row.exif,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class LogbookService {
  private readonly encKey: Buffer;

  constructor(
    @Inject(DB) private readonly db: Database | null,
    @Inject(API_ENV) private readonly env: ApiEnv,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {
    this.encKey = resolveLogbookEncKey(this.env.LOGBOOK_ENC_KEY, this.env.NODE_ENV);
  }

  private requireDb(): Database {
    if (this.db === null) {
      throw serviceUnavailable('Database is not configured');
    }
    return this.db;
  }

  private toOwner(row: LogbookRow): LogbookEntryOwner {
    let exactLocation: OwnerExactLocation | null;
    try {
      exactLocation = decryptExactPoint(row.exactPointEnc, this.encKey);
    } catch {
      throw serviceUnavailable('Failed to decrypt logbook exact point');
    }
    return {
      ...toPublic(row),
      exactLocation,
    };
  }

  async list(userId: string): Promise<LogbookListResponse> {
    const db = this.requireDb();
    const rows = await db
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
      .orderBy(desc(logbookEntries.takenAt), asc(logbookEntries.id));

    return { items: rows.map(toPublic) };
  }

  async get(userId: string, idRaw: string): Promise<LogbookEntryOwner> {
    const row = await this.findOwned(userId, parseLogbookId(idRaw));
    return this.toOwner(row);
  }

  async create(userId: string, body: LogbookCreateRequest): Promise<LogbookEntryOwner> {
    const db = this.requireDb();
    assertOwnedPhotoKey(userId, body.photoKey);
    if (body.thumbKey !== undefined) {
      assertOwnedPhotoKey(userId, body.thumbKey);
    }

    const taxonId = parseOptionalTaxonId(body.taxonId ?? null);
    if (taxonId !== null && taxonId !== undefined) {
      await this.assertTaxonExists(taxonId);
    }

    const cellR7 = parseOptionalCellR7(body.cellR7 ?? null) ?? null;
    const takenAt = parseTakenAt(body.takenAt);
    const exactPointEnc =
      body.exactLocation === undefined ? null : encryptExactPoint(body.exactLocation, this.encKey);

    const [inserted] = await db
      .insert(logbookEntries)
      .values({
        userId,
        taxonId: taxonId ?? null,
        takenAt,
        cellR7,
        exactPointEnc,
        photoKey: body.photoKey,
        thumbKey: body.thumbKey ?? null,
        exif: body.exif ?? {},
        notes: body.notes ?? null,
      })
      .returning({
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
      });

    if (inserted === undefined) {
      throw serviceUnavailable('Failed to create logbook entry');
    }
    return this.toOwner(inserted);
  }

  async patch(
    userId: string,
    idRaw: string,
    body: LogbookPatchRequest,
  ): Promise<LogbookEntryOwner> {
    const db = this.requireDb();
    const id = parseLogbookId(idRaw);
    // Ensure ownership before update (same 404 for missing / other user).
    await this.findOwned(userId, id);

    const updates: {
      taxonId?: number | null;
      notes?: string | null;
      cellR7?: string | null;
      exactPointEnc?: Buffer | null;
      updatedAt: Date;
    } = { updatedAt: new Date() };

    if (body.taxonId !== undefined) {
      const taxonId = parseOptionalTaxonId(body.taxonId);
      if (taxonId !== null && taxonId !== undefined) {
        await this.assertTaxonExists(taxonId);
      }
      updates.taxonId = taxonId ?? null;
    }
    if (body.notes !== undefined) {
      updates.notes = body.notes;
    }
    if (body.cellR7 !== undefined) {
      updates.cellR7 = parseOptionalCellR7(body.cellR7) ?? null;
    }
    if (body.exactLocation !== undefined) {
      updates.exactPointEnc =
        body.exactLocation === null ? null : encryptExactPoint(body.exactLocation, this.encKey);
    }

    const [updated] = await db
      .update(logbookEntries)
      .set(updates)
      .where(and(eq(logbookEntries.id, id), eq(logbookEntries.userId, userId)))
      .returning({
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
      });

    if (updated === undefined) {
      throw notFoundError('Logbook entry not found');
    }
    return this.toOwner(updated);
  }

  async remove(userId: string, idRaw: string): Promise<void> {
    const db = this.requireDb();
    const id = parseLogbookId(idRaw);
    const row = await this.findOwned(userId, id);

    const deleted = await db
      .delete(logbookEntries)
      .where(and(eq(logbookEntries.id, id), eq(logbookEntries.userId, userId)))
      .returning({ id: logbookEntries.id });

    if (deleted[0] === undefined) {
      throw notFoundError('Logbook entry not found');
    }

    // Best-effort photo cleanup after the row is gone (T5.11).
    await this.storage.deleteObject(row.photoKey);
    if (row.thumbKey !== null && row.thumbKey.length > 0) {
      await this.storage.deleteObject(row.thumbKey);
    }
  }

  private async findOwned(userId: string, id: number): Promise<LogbookRow> {
    const db = this.requireDb();
    const rows = await db
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
      .where(and(eq(logbookEntries.id, id), eq(logbookEntries.userId, userId)))
      .limit(1);
    const row = rows[0];
    if (row === undefined) {
      throw notFoundError('Logbook entry not found');
    }
    return row;
  }

  private async assertTaxonExists(taxonId: number): Promise<void> {
    const db = this.requireDb();
    const rows = await db.select({ id: taxa.id }).from(taxa).where(eq(taxa.id, taxonId)).limit(1);
    if (rows[0] === undefined) {
      throw notFoundError(`Unknown taxon: ${String(taxonId)}`);
    }
  }
}

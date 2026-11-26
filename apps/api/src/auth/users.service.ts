import { Inject, Injectable } from '@nestjs/common';
import { regions, users, type Database } from '@wildwindow/db';
import { type Locale, type RegionId, type UserRole } from '@wildwindow/shared';
import { and, eq, isNull, sql } from 'drizzle-orm';

import { DB } from '../db/db.module.js';
import { type RequestUser } from '../geoprivacy/owner-location.js';
import { notFoundError, serviceUnavailable, unauthorizedError } from '../http/api-error.js';

import type { VerifiedIdToken } from './token-verifier.js';

function normalizeEmail(email: string | undefined): string | null {
  if (email === undefined) {
    return null;
  }
  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function parseRole(value: string): UserRole {
  return value === 'admin' ? 'admin' : 'user';
}

function parseLocale(value: string): Locale {
  return value === 'ur' ? 'ur' : 'en';
}

export type MeProfileRow = {
  readonly id: string;
  readonly displayName: string | null;
  readonly homeRegionSlug: RegionId | null;
  readonly locale: Locale;
  readonly role: UserRole;
};

@Injectable()
export class UsersService {
  constructor(@Inject(DB) private readonly db: Database | null) {}

  private requireDb(): Database {
    if (this.db === null) {
      throw serviceUnavailable('Database is not configured');
    }
    return this.db;
  }

  /**
   * Create or refresh `app.users` from a verified Firebase token (ARCHITECTURE §8).
   * Soft-deleted accounts are rejected (401) until purge/T5.14 restore exists.
   */
  async upsertFromToken(token: VerifiedIdToken): Promise<RequestUser> {
    const db = this.requireDb();
    const email = normalizeEmail(token.email);
    const displayNameFromToken =
      token.name !== undefined && token.name.trim().length > 0 ? token.name.trim() : null;

    const existing = await db
      .select({
        id: users.id,
        firebaseUid: users.firebaseUid,
        email: users.email,
        displayName: users.displayName,
        homeRegionId: users.homeRegionId,
        locale: users.locale,
        role: users.role,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(eq(users.firebaseUid, token.uid))
      .limit(1);

    const row = existing[0];
    if (row !== undefined) {
      if (row.deletedAt !== null) {
        throw unauthorizedError('Account has been deleted');
      }

      const emailChanged = email !== null && email !== row.email;
      const nameMissing = row.displayName === null && displayNameFromToken !== null;
      if (emailChanged || nameMissing) {
        const [updated] = await db
          .update(users)
          .set({
            ...(emailChanged ? { email } : {}),
            ...(nameMissing ? { displayName: displayNameFromToken } : {}),
          })
          .where(eq(users.id, row.id))
          .returning({
            id: users.id,
            firebaseUid: users.firebaseUid,
            email: users.email,
            displayName: users.displayName,
            homeRegionId: users.homeRegionId,
            locale: users.locale,
            role: users.role,
          });
        if (updated === undefined) {
          throw serviceUnavailable('Failed to update user');
        }
        return this.toRequestUser(updated);
      }

      return this.toRequestUser(row);
    }

    const [inserted] = await db
      .insert(users)
      .values({
        firebaseUid: token.uid,
        email,
        displayName: displayNameFromToken,
      })
      .returning({
        id: users.id,
        firebaseUid: users.firebaseUid,
        email: users.email,
        displayName: users.displayName,
        homeRegionId: users.homeRegionId,
        locale: users.locale,
        role: users.role,
      });

    if (inserted === undefined) {
      throw serviceUnavailable('Failed to create user');
    }
    return this.toRequestUser(inserted);
  }

  async getProfile(userId: string): Promise<MeProfileRow> {
    const db = this.requireDb();
    const rows = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        locale: users.locale,
        role: users.role,
        regionSlug: regions.slug,
      })
      .from(users)
      .leftJoin(regions, eq(users.homeRegionId, regions.id))
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    const row = rows[0];
    if (row === undefined) {
      throw notFoundError('User not found');
    }

    const slug = row.regionSlug;
    const homeRegionSlug: RegionId | null =
      slug === 'scotland' || slug === 'sindh' ? slug : null;

    return {
      id: row.id,
      displayName: row.displayName,
      homeRegionSlug,
      locale: parseLocale(row.locale),
      role: parseRole(row.role),
    };
  }

  async patchProfile(
    userId: string,
    patch: {
      readonly displayName?: string | null | undefined;
      readonly homeRegionSlug?: RegionId | null | undefined;
      readonly locale?: Locale | undefined;
    },
  ): Promise<MeProfileRow> {
    const db = this.requireDb();

    let homeRegionId: number | null | undefined;
    if (patch.homeRegionSlug !== undefined) {
      if (patch.homeRegionSlug === null) {
        homeRegionId = null;
      } else {
        const regionRows = await db
          .select({ id: regions.id })
          .from(regions)
          .where(eq(regions.slug, patch.homeRegionSlug))
          .limit(1);
        const region = regionRows[0];
        if (region === undefined) {
          throw notFoundError(`Unknown region: ${patch.homeRegionSlug}`);
        }
        homeRegionId = region.id;
      }
    }

    const [updated] = await db
      .update(users)
      .set({
        ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
        ...(homeRegionId !== undefined ? { homeRegionId } : {}),
        ...(patch.locale !== undefined ? { locale: patch.locale } : {}),
      })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .returning({ id: users.id });

    if (updated === undefined) {
      throw notFoundError('User not found');
    }
    return this.getProfile(userId);
  }

  /** Promote a user to admin by normalized email (worker `make-admin`). */
  static normalizeEmailForLookup(email: string): string {
    return email.trim().toLowerCase();
  }

  /** Used by unit tests / CLI helpers — lower(email) match. */
  async findIdByEmail(email: string): Promise<string | null> {
    const db = this.requireDb();
    const normalized = UsersService.normalizeEmailForLookup(email);
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${normalized}`)
      .limit(1);
    return rows[0]?.id ?? null;
  }

  private toRequestUser(row: {
    readonly id: string;
    readonly firebaseUid: string;
    readonly email: string | null;
    readonly displayName: string | null;
    readonly homeRegionId: number | null;
    readonly locale: string;
    readonly role: string;
  }): RequestUser {
    return {
      id: row.id,
      firebaseUid: row.firebaseUid,
      email: row.email,
      displayName: row.displayName,
      homeRegionId: row.homeRegionId,
      locale: row.locale,
      role: parseRole(row.role),
    };
  }
}

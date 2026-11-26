import { Inject, Injectable } from '@nestjs/common';
import {
  challengeEntries,
  challenges,
  logbookEntries,
  taxa,
  taxonRegion,
  type Database,
} from '@wildwindow/db';
import {
  type ChallengeEntriesQuery,
  type ChallengeEntriesResponse,
  type ChallengeResponse,
  type ChallengeStatus,
  type ChallengeSubmitOk,
  type ChallengeSubmitRequest,
} from '@wildwindow/shared';
import { and, asc, count, desc, eq, gte, lt, lte, sql } from 'drizzle-orm';

import { DB } from '../db/db.module.js';
import { conflictError, notFoundError, validationError } from '../http/api-error.js';
import { STORAGE_SERVICE, type StorageService } from '../storage/storage.types.js';

/** Entries go public no sooner than 7 days after submit (PRD US-13 / ARCHITECTURE §6.2). */
export const CHALLENGE_PUBLISH_DELAY_MS = 7 * 24 * 60 * 60 * 1000;

const ENTRIES_PAGE_SIZE = 20;

/** Signed photo URL lifetime for public gallery listings. */
const PHOTO_URL_TTL_SECONDS = 60 * 60;

type ChallengeRow = {
  readonly id: number;
  readonly slug: string;
  readonly title: string;
  readonly taxonId: number;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly rulesMd: string;
  readonly status: string;
};

@Injectable()
export class ChallengesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  async current(now: Date = new Date()): Promise<ChallengeResponse> {
    const today = utcDateString(now);
    const rows = await this.db
      .select({
        id: challenges.id,
        slug: challenges.slug,
        title: challenges.title,
        taxonId: challenges.taxonId,
        startsOn: challenges.startsOn,
        endsOn: challenges.endsOn,
        rulesMd: challenges.rulesMd,
        status: challenges.status,
      })
      .from(challenges)
      .where(
        and(
          inActiveStatus(challenges.status),
          lte(challenges.startsOn, today),
          gte(challenges.endsOn, today),
        ),
      )
      .orderBy(desc(challenges.startsOn), asc(challenges.id))
      .limit(1);

    const row = rows[0];
    if (row === undefined) {
      throw notFoundError('No current challenge');
    }
    return this.toSummary(row, now);
  }

  async getBySlug(slug: string, now: Date = new Date()): Promise<ChallengeResponse> {
    const row = await this.findChallengeBySlug(slug);
    if (row === null) {
      throw notFoundError('Challenge not found');
    }
    // Draft challenges are not public.
    if (normalizeChallengeStatus(row.status) === 'draft') {
      throw notFoundError('Challenge not found');
    }
    return this.toSummary(row, now);
  }

  async listEntries(
    slug: string,
    query: ChallengeEntriesQuery,
    now: Date = new Date(),
  ): Promise<ChallengeEntriesResponse> {
    const challenge = await this.findChallengeBySlug(slug);
    if (challenge === null || normalizeChallengeStatus(challenge.status) === 'draft') {
      throw notFoundError('Challenge not found');
    }

    const cursorId = parseCursor(query.cursor);
    const country = query.country !== undefined ? query.country.trim().toUpperCase() : undefined;

    const conditions = [
      eq(challengeEntries.challengeId, challenge.id),
      eq(challengeEntries.status, 'approved'),
      lte(challengeEntries.publishAfter, now),
    ];
    if (country !== undefined) {
      conditions.push(eq(challengeEntries.countryCode, country));
    }
    if (cursorId !== undefined) {
      conditions.push(lt(challengeEntries.id, cursorId));
    }

    const rows = await this.db
      .select({
        id: challengeEntries.id,
        countryCode: challengeEntries.countryCode,
        regionLabel: challengeEntries.regionLabel,
        photoKey: challengeEntries.photoKey,
        publishAfter: challengeEntries.publishAfter,
      })
      .from(challengeEntries)
      .where(and(...conditions))
      .orderBy(desc(challengeEntries.id))
      .limit(ENTRIES_PAGE_SIZE + 1);

    const page = rows.slice(0, ENTRIES_PAGE_SIZE);
    const entries = await Promise.all(
      page.map(async (row) => {
        const signed = await this.storage.createPresignedGet({
          key: row.photoKey,
          expiresInSeconds: PHOTO_URL_TTL_SECONDS,
        });
        return {
          id: String(row.id),
          countryCode: row.countryCode,
          regionLabel: row.regionLabel,
          photoUrl: signed.url,
          publishedAt: row.publishAfter.toISOString(),
        };
      }),
    );

    const last = page[page.length - 1];
    const nextCursor =
      rows.length > ENTRIES_PAGE_SIZE && last !== undefined ? String(last.id) : null;

    return { entries, nextCursor };
  }

  async submit(
    slug: string,
    userId: string,
    body: ChallengeSubmitRequest,
    now: Date = new Date(),
  ): Promise<ChallengeSubmitOk> {
    const challenge = await this.findChallengeBySlug(slug);
    if (challenge === null || normalizeChallengeStatus(challenge.status) === 'draft') {
      throw notFoundError('Challenge not found');
    }

    const apiStatus = normalizeChallengeStatus(challenge.status);
    const today = utcDateString(now);
    if (apiStatus !== 'active' || challenge.startsOn > today || challenge.endsOn < today) {
      throw validationError('Challenge is not open for submissions');
    }

    await this.assertChallengeTaxonIsOpen(challenge.taxonId);

    const logbookId = parsePositiveIntId(body.logbookEntryId, 'logbookEntryId');
    const logbookRows = await this.db
      .select({
        id: logbookEntries.id,
        userId: logbookEntries.userId,
        taxonId: logbookEntries.taxonId,
        photoKey: logbookEntries.photoKey,
      })
      .from(logbookEntries)
      .where(and(eq(logbookEntries.id, logbookId), eq(logbookEntries.userId, userId)))
      .limit(1);

    const logbook = logbookRows[0];
    if (logbook === undefined) {
      throw notFoundError('Logbook entry not found');
    }
    if (logbook.taxonId === null || logbook.taxonId !== challenge.taxonId) {
      throw validationError('Logbook entry species must match the challenge species');
    }

    const countryCode = body.countryCode.trim().toUpperCase();
    if (countryCode.length !== 2) {
      throw validationError('countryCode must be a 2-letter ISO code');
    }
    const regionLabel = body.regionLabel.trim();
    if (regionLabel.length === 0 || regionLabel.length > 200) {
      throw validationError('regionLabel must be 1–200 characters');
    }

    const publishAfter = new Date(now.getTime() + CHALLENGE_PUBLISH_DELAY_MS);

    try {
      const inserted = await this.db
        .insert(challengeEntries)
        .values({
          challengeId: challenge.id,
          userId,
          logbookEntryId: logbook.id,
          countryCode,
          regionLabel,
          photoKey: logbook.photoKey,
          pledgeAcceptedAt: now,
          status: 'pending',
          publishAfter,
        })
        .returning({
          id: challengeEntries.id,
          publishAfter: challengeEntries.publishAfter,
        });

      const row = inserted[0];
      if (row === undefined) {
        throw new Error('challenge entry insert returned no row');
      }
      return {
        id: String(row.id),
        status: 'pending',
        publishAfter: row.publishAfter.toISOString(),
      };
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        throw conflictError(
          'CHALLENGE_ENTRY_EXISTS',
          'This logbook entry has already been submitted to a challenge',
        );
      }
      throw err;
    }
  }

  private async findChallengeBySlug(slug: string): Promise<ChallengeRow | null> {
    const trimmed = slug.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const rows = await this.db
      .select({
        id: challenges.id,
        slug: challenges.slug,
        title: challenges.title,
        taxonId: challenges.taxonId,
        startsOn: challenges.startsOn,
        endsOn: challenges.endsOn,
        rulesMd: challenges.rulesMd,
        status: challenges.status,
      })
      .from(challenges)
      .where(eq(challenges.slug, trimmed))
      .limit(1);
    return rows[0] ?? null;
  }

  private async toSummary(row: ChallengeRow, now: Date): Promise<ChallengeResponse> {
    const countryCounts = await this.countryCounts(row.id, now);
    return {
      slug: row.slug,
      title: row.title,
      taxonId: String(row.taxonId),
      startsOn: row.startsOn,
      endsOn: row.endsOn,
      rulesMd: row.rulesMd,
      status: normalizeChallengeStatus(row.status),
      countryCounts,
    };
  }

  private async countryCounts(
    challengeId: number,
    now: Date,
  ): Promise<ChallengeResponse['countryCounts']> {
    const rows = await this.db
      .select({
        countryCode: challengeEntries.countryCode,
        count: count(),
      })
      .from(challengeEntries)
      .where(
        and(
          eq(challengeEntries.challengeId, challengeId),
          eq(challengeEntries.status, 'approved'),
          lte(challengeEntries.publishAfter, now),
        ),
      )
      .groupBy(challengeEntries.countryCode)
      .orderBy(asc(challengeEntries.countryCode));

    return rows.map((row) => ({
      countryCode: row.countryCode,
      count: row.count,
    }));
  }

  /**
   * PRD US-13 AC5: only `open` tier species can be challenge species.
   * Require challengeEligible and every taxon_region row to be `open`.
   */
  private async assertChallengeTaxonIsOpen(taxonId: number): Promise<void> {
    const taxonRows = await this.db
      .select({
        challengeEligible: taxa.challengeEligible,
      })
      .from(taxa)
      .where(eq(taxa.id, taxonId))
      .limit(1);
    const taxon = taxonRows[0];
    if (taxon === undefined) {
      throw validationError('Challenge species is not available');
    }
    if (!taxon.challengeEligible) {
      throw validationError('Challenge species is not challenge-eligible');
    }

    const tierRows = await this.db
      .select({ tier: taxonRegion.tier })
      .from(taxonRegion)
      .where(eq(taxonRegion.taxonId, taxonId));

    if (tierRows.length === 0) {
      throw validationError('Challenge species has no region tier; must be open');
    }
    for (const row of tierRows) {
      if (row.tier !== 'open') {
        throw validationError('Challenge species must be open tier in every region');
      }
    }
  }
}

/** Accept DB `live` (ARCHITECTURE §6.2) or API `active` (shared Zod). */
export function normalizeChallengeStatus(raw: string): ChallengeStatus {
  if (raw === 'active' || raw === 'live') {
    return 'active';
  }
  if (raw === 'closed') {
    return 'closed';
  }
  if (raw === 'draft') {
    return 'draft';
  }
  throw validationError(`Unknown challenge status: ${raw}`);
}

function inActiveStatus(column: typeof challenges.status) {
  return sql`${column} IN ('active', 'live')`;
}

function utcDateString(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${String(y)}-${m}-${d}`;
}

function parseCursor(raw: string | undefined): number | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw validationError('cursor must be a positive integer id');
  }
  const id = Number(trimmed);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw validationError('cursor must be a positive integer id');
  }
  return id;
}

function parsePositiveIntId(raw: string, field: string): number {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw validationError(`${field} must be a positive integer`);
  }
  const id = Number(trimmed);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw validationError(`${field} must be a positive integer`);
  }
  return id;
}

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) {
    return false;
  }
  const code = 'code' in err ? err.code : undefined;
  if (code === '23505') {
    return true;
  }
  const cause = 'cause' in err ? err.cause : undefined;
  if (typeof cause === 'object' && cause !== null && 'code' in cause) {
    return cause.code === '23505';
  }
  return false;
}

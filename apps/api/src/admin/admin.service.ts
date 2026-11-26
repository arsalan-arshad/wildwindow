import { Inject, Injectable } from '@nestjs/common';
import {
  auditLog,
  challengeEntries,
  challenges,
  forecastCache,
  ingestRuns,
  regions,
  speciesCards,
  taxa,
  taxonRegion,
  type Database,
} from '@wildwindow/db';
import {
  ChallengeEntryModerationStatusSchema,
  IngestRunStatusSchema,
  RegionIdSchema,
  SensitivityTierSchema,
  type AdminChallengeEntriesQuery,
  type AdminChallengeEntriesResponse,
  type AdminChallengeEntry,
  type AdminChallengeEntryPatch,
  type AdminIngestRun,
  type AdminIngestRunsResponse,
  type AdminSpeciesCard,
  type AdminSpeciesCardPatch,
  type AdminSpeciesResponse,
  type AdminTaxonRegion,
  type AdminTaxonRegionPatch,
  type RegionId,
  type SensitivityTier,
} from '@wildwindow/shared';
import { and, desc, eq } from 'drizzle-orm';

import { DB } from '../db/db.module.js';
import { notFoundError, serviceUnavailable, validationError } from '../http/api-error.js';

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

function parseRegionSlug(raw: string): RegionId {
  const parsed = RegionIdSchema.safeParse(raw);
  if (!parsed.success) {
    throw notFoundError(`Unknown region: ${raw}`);
  }
  return parsed.data;
}

function parseEntryId(raw: string): number {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw validationError('entry id must be a positive integer');
  }
  const id = Number(trimmed);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw validationError('entry id must be a positive integer');
  }
  return id;
}

/** Sort unique lockout months ascending (1–12). */
export function normalizeLockoutMonths(months: readonly number[]): number[] {
  return [...new Set(months)].sort((a, b) => a - b);
}

function asJsonRecord(value: unknown): Record<string, unknown> | null {
  if (value === null) {
    return null;
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { value };
}

@Injectable()
export class AdminService {
  constructor(@Inject(DB) private readonly db: Database | null) {}

  private requireDb(): Database {
    if (this.db === null) {
      throw serviceUnavailable('Database is not configured');
    }
    return this.db;
  }

  private async writeAudit(
    db: Database,
    options: {
      readonly actorUserId: string;
      readonly action: string;
      readonly entity: string;
      readonly entityId: string;
      readonly before: Record<string, unknown> | null;
      readonly after: Record<string, unknown> | null;
    },
  ): Promise<void> {
    await db.insert(auditLog).values({
      actorUserId: options.actorUserId,
      action: options.action,
      entity: options.entity,
      entityId: options.entityId,
      before: options.before,
      after: options.after,
    });
  }

  private async clearForecastCache(db: Database, taxonId: number): Promise<void> {
    await db.delete(forecastCache).where(eq(forecastCache.taxonId, taxonId));
  }

  private async resolveRegion(
    db: Database,
    slug: RegionId,
  ): Promise<{ readonly id: number; readonly slug: RegionId }> {
    const rows = await db
      .select({ id: regions.id, slug: regions.slug })
      .from(regions)
      .where(eq(regions.slug, slug))
      .limit(1);
    const row = rows[0];
    if (row === undefined) {
      throw notFoundError(`Unknown region: ${slug}`);
    }
    return { id: row.id, slug: RegionIdSchema.parse(row.slug) };
  }

  private async assertTaxonExists(db: Database, taxonId: number): Promise<void> {
    const rows = await db.select({ id: taxa.id }).from(taxa).where(eq(taxa.id, taxonId)).limit(1);
    if (rows[0] === undefined) {
      throw notFoundError(`Species ${String(taxonId)} not found`);
    }
  }

  async getSpecies(taxonIdRaw: string, regionRaw: string): Promise<AdminSpeciesResponse> {
    const db = this.requireDb();
    const taxonId = parseTaxonId(taxonIdRaw);
    const slug = parseRegionSlug(regionRaw);
    await this.assertTaxonExists(db, taxonId);
    const region = await this.resolveRegion(db, slug);

    const cards = await db
      .select({
        bodyMd: speciesCards.bodyMd,
        settings: speciesCards.settings,
        ethicsMd: speciesCards.ethicsMd,
        legalMd: speciesCards.legalMd,
        status: speciesCards.status,
        reviewedBy: speciesCards.reviewedBy,
        reviewedAt: speciesCards.reviewedAt,
      })
      .from(speciesCards)
      .where(and(eq(speciesCards.taxonId, taxonId), eq(speciesCards.regionId, region.id)))
      .limit(1);

    return this.toSpeciesResponse(taxonId, slug, cards[0]);
  }

  async patchSpecies(
    taxonIdRaw: string,
    actorUserId: string,
    actorLabel: string,
    body: AdminSpeciesCardPatch,
  ): Promise<AdminSpeciesResponse> {
    const db = this.requireDb();
    const taxonId = parseTaxonId(taxonIdRaw);
    const slug = body.region;
    await this.assertTaxonExists(db, taxonId);
    const region = await this.resolveRegion(db, slug);

    const existing = await db
      .select({
        id: speciesCards.id,
        bodyMd: speciesCards.bodyMd,
        settings: speciesCards.settings,
        ethicsMd: speciesCards.ethicsMd,
        legalMd: speciesCards.legalMd,
        status: speciesCards.status,
        reviewedBy: speciesCards.reviewedBy,
        reviewedAt: speciesCards.reviewedAt,
      })
      .from(speciesCards)
      .where(and(eq(speciesCards.taxonId, taxonId), eq(speciesCards.regionId, region.id)))
      .limit(1);

    const beforeRow = existing[0];
    const before = beforeRow === undefined ? null : this.cardSnapshot(beforeRow);

    const nextBodyMd = body.bodyMd ?? beforeRow?.bodyMd;
    if (nextBodyMd === undefined || nextBodyMd.length === 0) {
      throw validationError('bodyMd is required when creating a species card');
    }

    const nextStatus = body.status ?? beforeRow?.status ?? 'draft';
    if (nextStatus !== 'draft' && nextStatus !== 'reviewed') {
      throw validationError('status must be draft or reviewed');
    }

    const nextSettings = body.settings ?? beforeRow?.settings ?? {};
    const nextEthics = body.ethicsMd !== undefined ? body.ethicsMd : (beforeRow?.ethicsMd ?? null);
    const nextLegal = body.legalMd !== undefined ? body.legalMd : (beforeRow?.legalMd ?? null);

    let nextReviewedBy = beforeRow?.reviewedBy ?? null;
    let nextReviewedAt = beforeRow?.reviewedAt ?? null;
    if (nextStatus === 'reviewed') {
      nextReviewedBy = actorLabel;
      nextReviewedAt = new Date();
    } else if (body.status === 'draft') {
      // Demoting to draft clears review stamp so the public catalogue hides it.
      nextReviewedBy = null;
      nextReviewedAt = null;
    }

    if (beforeRow === undefined) {
      await db.insert(speciesCards).values({
        taxonId,
        regionId: region.id,
        bodyMd: nextBodyMd,
        settings: nextSettings,
        ethicsMd: nextEthics,
        legalMd: nextLegal,
        status: nextStatus,
        reviewedBy: nextReviewedBy,
        reviewedAt: nextReviewedAt,
      });
    } else {
      await db
        .update(speciesCards)
        .set({
          bodyMd: nextBodyMd,
          settings: nextSettings,
          ethicsMd: nextEthics,
          legalMd: nextLegal,
          status: nextStatus,
          reviewedBy: nextReviewedBy,
          reviewedAt: nextReviewedAt,
        })
        .where(eq(speciesCards.id, beforeRow.id));
    }

    const afterRows = await db
      .select({
        bodyMd: speciesCards.bodyMd,
        settings: speciesCards.settings,
        ethicsMd: speciesCards.ethicsMd,
        legalMd: speciesCards.legalMd,
        status: speciesCards.status,
        reviewedBy: speciesCards.reviewedBy,
        reviewedAt: speciesCards.reviewedAt,
      })
      .from(speciesCards)
      .where(and(eq(speciesCards.taxonId, taxonId), eq(speciesCards.regionId, region.id)))
      .limit(1);
    const afterRow = afterRows[0];
    if (afterRow === undefined) {
      throw new Error('AdminService.patchSpecies: card missing after write');
    }

    await this.writeAudit(db, {
      actorUserId,
      action: beforeRow === undefined ? 'species_card.create' : 'species_card.update',
      entity: 'species_card',
      entityId: `${String(taxonId)}:${slug}`,
      before,
      after: this.cardSnapshot(afterRow),
    });
    await this.clearForecastCache(db, taxonId);

    return this.toSpeciesResponse(taxonId, slug, afterRow);
  }

  async getTaxonRegion(taxonIdRaw: string, regionRaw: string): Promise<AdminTaxonRegion> {
    const db = this.requireDb();
    const taxonId = parseTaxonId(taxonIdRaw);
    const slug = parseRegionSlug(regionRaw);
    return this.loadTaxonRegion(db, taxonId, slug);
  }

  async patchTaxonRegion(
    taxonIdRaw: string,
    regionRaw: string,
    actorUserId: string,
    actorLabel: string,
    body: AdminTaxonRegionPatch,
  ): Promise<AdminTaxonRegion> {
    const db = this.requireDb();
    const taxonId = parseTaxonId(taxonIdRaw);
    const slug = parseRegionSlug(regionRaw);

    if (
      body.tier === undefined &&
      body.lockoutMonths === undefined &&
      body.reviewer === undefined
    ) {
      throw validationError('At least one of tier, lockoutMonths, or reviewer is required');
    }

    const current = await this.loadTaxonRegion(db, taxonId, slug);
    const region = await this.resolveRegion(db, slug);

    const nextTier: SensitivityTier = body.tier ?? current.tier;
    const nextLockout =
      body.lockoutMonths !== undefined
        ? normalizeLockoutMonths(body.lockoutMonths)
        : current.lockoutMonths;
    const nextReviewer = body.reviewer ?? actorLabel;
    const nextReviewedAt = new Date();

    await db
      .update(taxonRegion)
      .set({
        tier: nextTier,
        lockoutMonths: nextLockout,
        reviewer: nextReviewer,
        reviewedAt: nextReviewedAt,
      })
      .where(and(eq(taxonRegion.taxonId, taxonId), eq(taxonRegion.regionId, region.id)));

    const after: AdminTaxonRegion = {
      taxonId: String(taxonId),
      regionSlug: slug,
      tier: nextTier,
      lockoutMonths: nextLockout,
      reviewer: nextReviewer,
      reviewedAt: nextReviewedAt.toISOString(),
    };

    await this.writeAudit(db, {
      actorUserId,
      action: 'taxon_region.update',
      entity: 'taxon_region',
      entityId: `${String(taxonId)}:${slug}`,
      before: asJsonRecord(current),
      after: asJsonRecord(after),
    });
    await this.clearForecastCache(db, taxonId);

    return after;
  }

  async listChallengeEntries(
    query: AdminChallengeEntriesQuery,
  ): Promise<AdminChallengeEntriesResponse> {
    const db = this.requireDb();
    const base = db
      .select({
        id: challengeEntries.id,
        challengeSlug: challenges.slug,
        userId: challengeEntries.userId,
        countryCode: challengeEntries.countryCode,
        regionLabel: challengeEntries.regionLabel,
        photoKey: challengeEntries.photoKey,
        status: challengeEntries.status,
        rejectReason: challengeEntries.rejectReason,
        publishAfter: challengeEntries.publishAfter,
        createdAt: challengeEntries.createdAt,
      })
      .from(challengeEntries)
      .innerJoin(challenges, eq(challenges.id, challengeEntries.challengeId));

    const rows =
      query.status !== undefined
        ? await base
            .where(eq(challengeEntries.status, query.status))
            .orderBy(desc(challengeEntries.createdAt))
        : await base.orderBy(desc(challengeEntries.createdAt));

    return {
      entries: rows.map((row) => this.toChallengeEntry(row)),
    };
  }

  async getChallengeEntry(idRaw: string): Promise<AdminChallengeEntry> {
    const db = this.requireDb();
    return this.loadChallengeEntry(db, parseEntryId(idRaw));
  }

  async patchChallengeEntry(
    idRaw: string,
    actorUserId: string,
    body: AdminChallengeEntryPatch,
  ): Promise<AdminChallengeEntry> {
    const db = this.requireDb();
    const id = parseEntryId(idRaw);
    const before = await this.loadChallengeEntry(db, id);

    const nextRejectReason =
      body.status === 'rejected' ? (body.rejectReason?.trim() ?? null) : null;

    if (
      body.status === 'rejected' &&
      (nextRejectReason === null || nextRejectReason.length === 0)
    ) {
      throw validationError('rejectReason is required when status is rejected');
    }

    await db
      .update(challengeEntries)
      .set({
        status: body.status,
        rejectReason: nextRejectReason,
      })
      .where(eq(challengeEntries.id, id));

    const after = await this.loadChallengeEntry(db, id);

    await this.writeAudit(db, {
      actorUserId,
      action: 'challenge_entry.moderate',
      entity: 'challenge_entry',
      entityId: String(id),
      before: asJsonRecord(before),
      after: asJsonRecord(after),
    });

    return after;
  }

  async listIngestRuns(): Promise<AdminIngestRunsResponse> {
    const db = this.requireDb();
    const rows = await db
      .select({
        id: ingestRuns.id,
        source: ingestRuns.source,
        regionSlug: regions.slug,
        kind: ingestRuns.kind,
        gbifDownloadKey: ingestRuns.gbifDownloadKey,
        doi: ingestRuns.doi,
        status: ingestRuns.status,
        total: ingestRuns.total,
        loaded: ingestRuns.loaded,
        rejectedLicence: ingestRuns.rejectedLicence,
        rejectedCoords: ingestRuns.rejectedCoords,
        rejectedOther: ingestRuns.rejectedOther,
        startedAt: ingestRuns.startedAt,
        finishedAt: ingestRuns.finishedAt,
      })
      .from(ingestRuns)
      .innerJoin(regions, eq(regions.id, ingestRuns.regionId))
      .orderBy(desc(ingestRuns.id));

    const runs: AdminIngestRun[] = rows.map((row) => ({
      id: String(row.id),
      source: row.source,
      regionSlug: RegionIdSchema.parse(row.regionSlug),
      kind: row.kind,
      gbifDownloadKey: row.gbifDownloadKey,
      doi: row.doi,
      status: IngestRunStatusSchema.parse(row.status),
      total: row.total,
      loaded: row.loaded,
      rejectedLicence: row.rejectedLicence,
      rejectedCoords: row.rejectedCoords,
      rejectedOther: row.rejectedOther,
      startedAt: row.startedAt?.toISOString() ?? null,
      finishedAt: row.finishedAt?.toISOString() ?? null,
    }));

    return { runs };
  }

  private async loadTaxonRegion(
    db: Database,
    taxonId: number,
    slug: RegionId,
  ): Promise<AdminTaxonRegion> {
    const region = await this.resolveRegion(db, slug);
    const rows = await db
      .select({
        tier: taxonRegion.tier,
        lockoutMonths: taxonRegion.lockoutMonths,
        reviewer: taxonRegion.reviewer,
        reviewedAt: taxonRegion.reviewedAt,
      })
      .from(taxonRegion)
      .where(and(eq(taxonRegion.taxonId, taxonId), eq(taxonRegion.regionId, region.id)))
      .limit(1);
    const row = rows[0];
    if (row === undefined) {
      throw notFoundError(`Taxon ${String(taxonId)} has no link for region ${slug}`);
    }
    return {
      taxonId: String(taxonId),
      regionSlug: slug,
      tier: SensitivityTierSchema.parse(row.tier),
      lockoutMonths: normalizeLockoutMonths(row.lockoutMonths),
      reviewer: row.reviewer,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
    };
  }

  private async loadChallengeEntry(db: Database, id: number): Promise<AdminChallengeEntry> {
    const rows = await db
      .select({
        id: challengeEntries.id,
        challengeSlug: challenges.slug,
        userId: challengeEntries.userId,
        countryCode: challengeEntries.countryCode,
        regionLabel: challengeEntries.regionLabel,
        photoKey: challengeEntries.photoKey,
        status: challengeEntries.status,
        rejectReason: challengeEntries.rejectReason,
        publishAfter: challengeEntries.publishAfter,
        createdAt: challengeEntries.createdAt,
      })
      .from(challengeEntries)
      .innerJoin(challenges, eq(challenges.id, challengeEntries.challengeId))
      .where(eq(challengeEntries.id, id))
      .limit(1);
    const row = rows[0];
    if (row === undefined) {
      throw notFoundError(`Challenge entry ${String(id)} not found`);
    }
    return this.toChallengeEntry(row);
  }

  private toChallengeEntry(row: {
    readonly id: number;
    readonly challengeSlug: string;
    readonly userId: string;
    readonly countryCode: string;
    readonly regionLabel: string;
    readonly photoKey: string;
    readonly status: string;
    readonly rejectReason: string | null;
    readonly publishAfter: Date;
    readonly createdAt: Date;
  }): AdminChallengeEntry {
    return {
      id: String(row.id),
      challengeSlug: row.challengeSlug,
      userId: row.userId,
      countryCode: row.countryCode,
      regionLabel: row.regionLabel,
      photoKey: row.photoKey,
      status: ChallengeEntryModerationStatusSchema.parse(row.status),
      rejectReason: row.rejectReason,
      publishAfter: row.publishAfter.toISOString(),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private cardSnapshot(row: {
    readonly bodyMd: string;
    readonly settings: Record<string, unknown>;
    readonly ethicsMd: string | null;
    readonly legalMd: string | null;
    readonly status: string;
    readonly reviewedBy: string | null;
    readonly reviewedAt: Date | null;
  }): Record<string, unknown> {
    return {
      bodyMd: row.bodyMd,
      settings: row.settings,
      ethicsMd: row.ethicsMd,
      legalMd: row.legalMd,
      status: row.status,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
    };
  }

  private toSpeciesResponse(
    taxonId: number,
    slug: RegionId,
    row:
      | {
          readonly bodyMd: string;
          readonly settings: Record<string, unknown>;
          readonly ethicsMd: string | null;
          readonly legalMd: string | null;
          readonly status: string;
          readonly reviewedBy: string | null;
          readonly reviewedAt: Date | null;
        }
      | undefined,
  ): AdminSpeciesResponse {
    if (row === undefined) {
      return {
        taxonId: String(taxonId),
        regionSlug: slug,
        card: null,
        cardStatus: 'missing',
      };
    }
    const status = row.status === 'reviewed' ? 'reviewed' : 'draft';
    const card: AdminSpeciesCard = {
      bodyMd: row.bodyMd,
      settings: row.settings,
      ethicsMd: row.ethicsMd,
      legalMd: row.legalMd,
      status,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
    };
    return {
      taxonId: String(taxonId),
      regionSlug: slug,
      card,
      cardStatus: status,
    };
  }
}

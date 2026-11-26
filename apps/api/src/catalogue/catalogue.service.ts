import { Inject, Injectable } from '@nestjs/common';
import {
  areaLabelFor,
  places,
  regions,
  speciesCards,
  taxa,
  taxonRegion,
  taxonRegionWeek,
  type Database,
} from '@wildwindow/db';
import {
  ActivityPatternSchema,
  CommonNamesSchema,
  RegionIdSchema,
  SensitivityTierSchema,
  SpeciesGroupSchema,
  TidePrefSchema,
  type AreaResponse,
  type PlacesQuery,
  type PlacesResponse,
  type RegionId,
  type RegionSpeciesQuery,
  type RegionSpeciesResponse,
  type RegionsResponse,
  type SeasonalityResponse,
  type SpeciesDetail,
  type SpeciesGroup,
} from '@wildwindow/shared';
import { and, asc, eq, or, sql, type SQL } from 'drizzle-orm';
import { cellToLatLng, getResolution, isValidCell } from 'h3-js';

import { API_ENV, type ApiEnv } from '../config/api-env.js';
import { DB } from '../db/db.module.js';
import { notFoundError, serviceUnavailable, validationError } from '../http/api-error.js';

import { relativeSeasonalityWeeks } from './seasonality.js';

/** Public copy when the cell sits outside beta region polygons (PRD US-02). */
const NOT_COVERED_LABEL = 'Not covered yet';

/** Fallback when a covered cell has no zone/place label yet. */
const COVERED_FALLBACK_LABEL = 'Covered area';

const PLACES_SEARCH_LIMIT = 20;

function escapeIlikePattern(raw: string): string {
  // Escape LIKE metacharacters so user input is matched literally.
  return raw.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}

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

function parseCommonNames(value: unknown): { en: string; ur?: string } {
  const parsed = CommonNamesSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('Invalid common_names JSON on taxon row');
  }
  // exactOptionalPropertyTypes: omit `ur` when absent rather than `ur: undefined`.
  if (parsed.data.ur === undefined) {
    return { en: parsed.data.en };
  }
  return { en: parsed.data.en, ur: parsed.data.ur };
}

@Injectable()
export class CatalogueService {
  constructor(
    @Inject(DB) private readonly db: Database | null,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  private requireDb(): Database {
    if (this.db === null) {
      throw serviceUnavailable('Catalogue is temporarily unavailable');
    }
    return this.db;
  }

  private requireApiDbUrl(): string {
    const url = this.env.DATABASE_URL_API;
    if (url === undefined || url.length === 0) {
      throw serviceUnavailable('Catalogue is temporarily unavailable');
    }
    return url;
  }

  async listRegions(): Promise<RegionsResponse> {
    const db = this.requireDb();
    const rows = await db
      .select({
        slug: regions.slug,
        name: regions.name,
        countryCode: regions.countryCode,
        timeZone: regions.timeZone,
      })
      .from(regions)
      .orderBy(asc(regions.slug));

    const list = rows.flatMap((row) => {
      const slug = RegionIdSchema.safeParse(row.slug);
      if (!slug.success) {
        return [];
      }
      return [
        {
          slug: slug.data,
          name: row.name,
          countryCode: row.countryCode,
          timeZone: row.timeZone,
        },
      ];
    });

    return { regions: list };
  }

  async listRegionSpecies(
    slugRaw: string,
    query: RegionSpeciesQuery,
  ): Promise<RegionSpeciesResponse> {
    const db = this.requireDb();
    const slug = parseRegionSlug(slugRaw);

    const regionRows = await db
      .select({ id: regions.id, slug: regions.slug })
      .from(regions)
      .where(eq(regions.slug, slug))
      .limit(1);
    const region = regionRows[0];
    if (region === undefined) {
      throw notFoundError(`Unknown region: ${slug}`);
    }

    const filters: SQL[] = [eq(taxonRegion.regionId, region.id)];

    if (query.group !== undefined) {
      const group = SpeciesGroupSchema.parse(query.group);
      filters.push(eq(taxa.group, group));
    }

    const q = query.q?.trim();
    if (q !== undefined && q.length > 0) {
      const pattern = `%${escapeIlikePattern(q)}%`;
      const nameMatch = or(
        sql`${taxa.scientificName} ILIKE ${pattern} ESCAPE '\\'`,
        sql`${taxa.commonNames}->>'en' ILIKE ${pattern} ESCAPE '\\'`,
        sql`${taxa.commonNames}->>'ur' ILIKE ${pattern} ESCAPE '\\'`,
      );
      if (nameMatch !== undefined) {
        filters.push(nameMatch);
      }
    }

    const rows = await db
      .select({
        taxonId: taxa.id,
        scientificName: taxa.scientificName,
        commonNames: taxa.commonNames,
        group: taxa.group,
        coastal: taxa.coastal,
        challengeEligible: taxa.challengeEligible,
        tier: taxonRegion.tier,
      })
      .from(taxa)
      .innerJoin(taxonRegion, eq(taxonRegion.taxonId, taxa.id))
      .where(and(...filters))
      .orderBy(asc(taxa.scientificName));

    const species = rows.map((row) => {
      const group = SpeciesGroupSchema.parse(row.group);
      return {
        taxonId: String(row.taxonId),
        scientificName: row.scientificName,
        commonNames: parseCommonNames(row.commonNames),
        group,
        tier: SensitivityTierSchema.parse(row.tier),
        coastal: row.coastal,
        challengeEligible: row.challengeEligible,
      };
    });

    return { regionSlug: slug, species };
  }

  async getSpeciesDetail(taxonIdRaw: string, regionRaw: string): Promise<SpeciesDetail> {
    const db = this.requireDb();
    const taxonId = parseTaxonId(taxonIdRaw);
    const slug = parseRegionSlug(regionRaw);

    const regionRows = await db
      .select({ id: regions.id, slug: regions.slug })
      .from(regions)
      .where(eq(regions.slug, slug))
      .limit(1);
    const region = regionRows[0];
    if (region === undefined) {
      throw notFoundError(`Unknown region: ${slug}`);
    }

    const rows = await db
      .select({
        taxonId: taxa.id,
        scientificName: taxa.scientificName,
        commonNames: taxa.commonNames,
        group: taxa.group,
        coastal: taxa.coastal,
        tidePref: taxa.tidePref,
        activityPattern: taxa.activityPattern,
        challengeEligible: taxa.challengeEligible,
        tier: taxonRegion.tier,
        cardStatus: speciesCards.status,
        cardBodyMd: speciesCards.bodyMd,
        cardSettings: speciesCards.settings,
        cardEthicsMd: speciesCards.ethicsMd,
        cardLegalMd: speciesCards.legalMd,
        cardReviewedBy: speciesCards.reviewedBy,
        cardReviewedAt: speciesCards.reviewedAt,
      })
      .from(taxa)
      .innerJoin(taxonRegion, eq(taxonRegion.taxonId, taxa.id))
      .leftJoin(
        speciesCards,
        and(
          eq(speciesCards.taxonId, taxa.id),
          eq(speciesCards.regionId, region.id),
          eq(speciesCards.status, 'reviewed'),
        ),
      )
      .where(and(eq(taxa.id, taxonId), eq(taxonRegion.regionId, region.id)))
      .limit(1);

    const row = rows[0];
    if (row === undefined) {
      throw notFoundError(`Species ${String(taxonId)} not found in region ${slug}`);
    }

    const group: SpeciesGroup = SpeciesGroupSchema.parse(row.group);
    let card: SpeciesDetail['card'] = null;
    if (
      row.cardStatus === 'reviewed' &&
      row.cardBodyMd !== null &&
      row.cardReviewedBy !== null &&
      row.cardReviewedAt !== null
    ) {
      card = {
        bodyMd: row.cardBodyMd,
        settings: row.cardSettings ?? {},
        ethicsMd: row.cardEthicsMd,
        legalMd: row.cardLegalMd,
        reviewedBy: row.cardReviewedBy,
        reviewedAt: row.cardReviewedAt.toISOString(),
      };
    }

    const tidePref = row.tidePref === null ? null : TidePrefSchema.parse(row.tidePref);
    const activityPattern =
      row.activityPattern === null ? null : ActivityPatternSchema.parse(row.activityPattern);

    return {
      taxonId: String(row.taxonId),
      scientificName: row.scientificName,
      commonNames: parseCommonNames(row.commonNames),
      group,
      regionSlug: slug,
      tier: SensitivityTierSchema.parse(row.tier),
      coastal: row.coastal,
      tidePref,
      activityPattern,
      challengeEligible: row.challengeEligible,
      card,
    };
  }

  async getSeasonality(taxonIdRaw: string, regionRaw: string): Promise<SeasonalityResponse> {
    const db = this.requireDb();
    const taxonId = parseTaxonId(taxonIdRaw);
    const slug = parseRegionSlug(regionRaw);

    const regionRows = await db
      .select({ id: regions.id, slug: regions.slug })
      .from(regions)
      .where(eq(regions.slug, slug))
      .limit(1);
    const region = regionRows[0];
    if (region === undefined) {
      throw notFoundError(`Unknown region: ${slug}`);
    }

    // Confirm the taxon is linked to this region (even if no week rows yet).
    const link = await db
      .select({ taxonId: taxonRegion.taxonId })
      .from(taxonRegion)
      .where(and(eq(taxonRegion.taxonId, taxonId), eq(taxonRegion.regionId, region.id)))
      .limit(1);
    if (link[0] === undefined) {
      throw notFoundError(`Species ${String(taxonId)} not found in region ${slug}`);
    }

    const weekRows = await db
      .select({
        week: taxonRegionWeek.week,
        nRecords: taxonRegionWeek.nRecords,
        nEffort: taxonRegionWeek.nEffort,
      })
      .from(taxonRegionWeek)
      .where(and(eq(taxonRegionWeek.taxonId, taxonId), eq(taxonRegionWeek.regionId, region.id)));

    const weeks = relativeSeasonalityWeeks(
      weekRows.map((row) => ({
        week: row.week,
        nRecords: row.nRecords,
        nEffort: row.nEffort,
      })),
    );

    return {
      taxonId: String(taxonId),
      regionSlug: slug,
      weeks: [...weeks],
    };
  }

  async searchPlaces(query: PlacesQuery): Promise<PlacesResponse> {
    const db = this.requireDb();
    const q = query.q.trim();
    if (q.length === 0) {
      throw validationError('q must be a non-empty search string');
    }

    const filters: SQL[] = [
      // pg_trgm similarity operator (GIN on places.name — T2.3 / T5.5).
      sql`${places.name} % ${q}`,
    ];

    if (query.region !== undefined) {
      filters.push(eq(regions.slug, query.region));
    }

    const rows = await db
      .select({
        id: places.id,
        name: places.name,
        regionSlug: regions.slug,
        cellR7: places.cellR7,
      })
      .from(places)
      .innerJoin(regions, eq(places.regionId, regions.id))
      .where(and(...filters))
      .orderBy(sql`similarity(${places.name}, ${q}) DESC`, asc(places.name))
      .limit(PLACES_SEARCH_LIMIT);

    const list = rows.flatMap((row) => {
      const regionSlug = RegionIdSchema.safeParse(row.regionSlug);
      if (!regionSlug.success) {
        return [];
      }
      return [
        {
          id: String(row.id),
          name: row.name,
          regionSlug: regionSlug.data,
          cellR7: row.cellR7,
        },
      ];
    });

    return { places: list };
  }

  async getArea(cellR7Raw: string): Promise<AreaResponse> {
    const db = this.requireDb();
    const cell = cellR7Raw.trim();
    if (cell.length === 0 || !isValidCell(cell) || getResolution(cell) !== 7) {
      throw validationError('cellR7 must be a valid H3 resolution-7 cell');
    }

    // Coverage uses the cell centre against beta region polygons (never returned).
    const [lat, lng] = cellToLatLng(cell);
    const coverage = await db.execute<{ slug: string }>(sql`
      SELECT r.slug
      FROM ref.regions r
      WHERE r.slug IN ('scotland', 'sindh')
        AND ST_Covers(
          r.geom,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
        )
      LIMIT 1
    `);
    const coveredRow = coverage.rows[0];
    if (coveredRow === undefined) {
      return {
        cellR7: cell,
        label: NOT_COVERED_LABEL,
        regionSlug: null,
        covered: false,
      };
    }

    const lookup = await areaLabelFor(this.requireApiDbUrl(), cell);
    const regionFromCoverage = RegionIdSchema.safeParse(coveredRow.slug);
    const regionFromLabel =
      lookup?.regionSlug !== undefined && lookup.regionSlug !== null
        ? RegionIdSchema.safeParse(lookup.regionSlug)
        : null;

    let regionSlug: RegionId | null = null;
    if (regionFromLabel?.success) {
      regionSlug = regionFromLabel.data;
    } else if (regionFromCoverage.success) {
      regionSlug = regionFromCoverage.data;
    }

    const label =
      lookup?.label !== undefined && lookup.label.length > 0
        ? lookup.label
        : COVERED_FALLBACK_LABEL;

    return {
      cellR7: cell,
      label,
      regionSlug,
      covered: true,
    };
  }
}

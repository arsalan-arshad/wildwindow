import { Inject, Injectable } from '@nestjs/common';
import { forecastCache, regions, taxa, taxonRegion, type Database } from '@wildwindow/db';
import { displayCellFor, GeoPrivacyError, type Tier } from '@wildwindow/geoprivacy';
import {
  computeForecast,
  isActivityPattern,
  SCORING_V1,
  type ActivityPattern,
  type ForecastResponse as ScoringForecastResponse,
  type TidePref,
} from '@wildwindow/scoring';
import {
  CommonNamesSchema,
  ForecastResponseSchema,
  SensitivityTierSchema,
  TidePrefSchema,
  type ForecastQuery,
  type ForecastResponse,
} from '@wildwindow/shared';
import { and, asc, eq, gt } from 'drizzle-orm';
import { cellToLatLng, getResolution, isValidCell } from 'h3-js';

import { API_ENV, type ApiEnv } from '../config/api-env.js';
import { DB } from '../db/db.module.js';
import { notFoundError, serviceUnavailable, validationError } from '../http/api-error.js';
import { WeatherService } from '../providers/weather/weather.service.js';

import { labelForDisplayCell, regionCoveringCell } from './forecast-geo.js';
import { loadForecastHistory } from './forecast-history.js';
import {
  forecastWindowStartUtc,
  sevenLocalDates,
  weatherByDateFromHours,
} from './forecast-weather.js';
import { weekFromLocalYmd } from './iso-week.js';
import { neighbourhoodCells } from './neighbourhood.js';

const FORECAST_CACHE_TTL_MS = 60 * 60 * 1000;
const WEATHER_HOURS = 7 * 24 + 12;

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

function assertRes7Cell(cell: string): void {
  if (!isValidCell(cell)) {
    throw validationError('cell must be a valid H3 index');
  }
  if (getResolution(cell) !== 7) {
    throw validationError('cell must be a res-7 H3 index (device-snapped)');
  }
}

function parseCommonName(value: unknown): string | undefined {
  const parsed = CommonNamesSchema.safeParse(value);
  if (!parsed.success) {
    return undefined;
  }
  return parsed.data.en;
}

function toPublicResponse(result: ScoringForecastResponse): ForecastResponse {
  // Re-parse through the shared Zod schema so wire types stay honest (no coords).
  return ForecastResponseSchema.parse(result);
}

@Injectable()
export class ForecastService {
  constructor(
    @Inject(DB) private readonly db: Database | null,
    @Inject(API_ENV) private readonly env: ApiEnv,
    private readonly weather: WeatherService,
  ) {}

  private requireDb(): Database {
    if (this.db === null) {
      throw serviceUnavailable('Forecast is temporarily unavailable');
    }
    return this.db;
  }

  private connectionString(): string {
    const url = this.env.DATABASE_URL_API;
    if (url === undefined || url.length === 0) {
      throw serviceUnavailable('Forecast is temporarily unavailable');
    }
    return url;
  }

  async getForecast(query: ForecastQuery): Promise<ForecastResponse> {
    const db = this.requireDb();
    const taxonId = parseTaxonId(query.taxonId);
    assertRes7Cell(query.cell);

    const coveredRegion = await regionCoveringCell(db, query.cell);

    // Taxon + tier: when covered, use that region; otherwise any beta link for metadata.
    const taxonRow = await this.loadTaxonContext(db, taxonId, coveredRegion?.id ?? null);
    if (taxonRow === null) {
      throw notFoundError(`Species ${query.taxonId} not found`);
    }

    const tier: Tier = SensitivityTierSchema.parse(taxonRow.tier);
    const timeZone = coveredRegion?.timeZone ?? taxonRow.fallbackTimeZone;
    const lockoutMonths = taxonRow.lockoutMonths;

    let displayCell: string | null;
    try {
      displayCell = displayCellFor(query.cell, tier);
    } catch (err) {
      if (err instanceof GeoPrivacyError) {
        throw validationError(err.message);
      }
      throw err;
    }

    const covered = coveredRegion !== null;
    const areaLabel =
      displayCell === null
        ? null
        : ((await labelForDisplayCell(this.connectionString(), displayCell))?.label ??
          coveredRegion?.name ??
          null);

    // Status overrides before cache / aggregates (§5.5).
    if (
      tier === 'no_forecast' ||
      !covered ||
      this.isLockoutWindow(query.start, timeZone, lockoutMonths)
    ) {
      const early = computeForecast({
        taxonId: String(taxonId),
        tier,
        displayCell: displayCell ?? query.cell,
        areaLabel: areaLabel ?? coveredRegion?.name ?? 'Unknown area',
        timeZone,
        startDate: query.start,
        lat: 0,
        lng: 0,
        lockoutMonths,
        covered,
        history: {
          nSpecies: 0,
          nEffort: 0,
          regionEffort: 0,
          regionRate: 0,
          rrRef: 0,
          distinctYears: 0,
        },
        hourProfile: {
          counts: Array.from({ length: 24 }, () => 0),
          activityPattern: taxonRow.activityPattern,
        },
        weatherByDate: {},
        ...(taxonRow.tidePref === null ? {} : { tidePref: taxonRow.tidePref }),
        ...(taxonRow.commonName === undefined ? {} : { commonName: taxonRow.commonName }),
      });
      return toPublicResponse(early);
    }

    if (displayCell === null) {
      // Defensive: displayCellFor only returns null for no_forecast (handled above).
      throw serviceUnavailable('Forecast display cell unavailable');
    }

    const cached = await this.readCache(db, taxonId, displayCell, query.start, tier);
    if (cached !== null) {
      return cached;
    }

    const [lat, lng] = cellToLatLng(displayCell);
    const week = weekFromLocalYmd(query.start);
    const cells = neighbourhoodCells(displayCell, tier);
    const { history, hourCounts } = await loadForecastHistory(db, {
      taxonId,
      regionId: coveredRegion.id,
      effortGroup: taxonRow.effortGroup,
      cells,
      week,
      scoringVersion: SCORING_V1.version,
    });

    const dates = sevenLocalDates(query.start, timeZone);
    const fromUtc = forecastWindowStartUtc(query.start, timeZone);
    const hours = await this.weather.hourlyForCell(displayCell, fromUtc, WEATHER_HOURS);
    const weatherByDate = weatherByDateFromHours({ hours, dates, timeZone });

    // MVP: omit tidesByDate so factor D is `not_used` (T4.8 / TIDE_PROVIDER=none).
    const computed = computeForecast({
      taxonId: String(taxonId),
      tier,
      displayCell,
      areaLabel: areaLabel ?? coveredRegion.name,
      timeZone,
      startDate: query.start,
      lat,
      lng,
      lockoutMonths,
      covered: true,
      history,
      hourProfile: {
        counts: [...hourCounts],
        activityPattern: taxonRow.activityPattern,
      },
      weatherByDate,
      ...(taxonRow.tidePref === null ? {} : { tidePref: taxonRow.tidePref }),
      ...(taxonRow.commonName === undefined ? {} : { commonName: taxonRow.commonName }),
    });

    const response = toPublicResponse(computed);
    await this.writeCache(db, taxonId, displayCell, query.start, response);
    return response;
  }

  private isLockoutWindow(
    startYmd: string,
    timeZone: string,
    lockoutMonths: readonly number[],
  ): boolean {
    if (lockoutMonths.length === 0) {
      return false;
    }
    // Mirror computeForecast: any day in the 7-day window in a lockout month.
    const dates = sevenLocalDates(startYmd, timeZone);
    for (const date of dates) {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
      if (match === null) {
        continue;
      }
      const month = Number(match[2]);
      if (lockoutMonths.includes(month)) {
        return true;
      }
    }
    return false;
  }

  private async loadTaxonContext(
    db: Database,
    taxonId: number,
    regionId: number | null,
  ): Promise<{
    readonly tier: string;
    readonly lockoutMonths: readonly number[];
    readonly effortGroup: string;
    readonly activityPattern: ActivityPattern;
    readonly tidePref: TidePref | null;
    readonly commonName: string | undefined;
    readonly fallbackTimeZone: string;
  } | null> {
    if (regionId !== null) {
      const rows = await db
        .select({
          tier: taxonRegion.tier,
          lockoutMonths: taxonRegion.lockoutMonths,
          effortGroup: taxa.effortGroup,
          activityPattern: taxa.activityPattern,
          tidePref: taxa.tidePref,
          commonNames: taxa.commonNames,
          timeZone: regions.timeZone,
        })
        .from(taxa)
        .innerJoin(taxonRegion, eq(taxonRegion.taxonId, taxa.id))
        .innerJoin(regions, eq(regions.id, taxonRegion.regionId))
        .where(and(eq(taxa.id, taxonId), eq(taxonRegion.regionId, regionId)))
        .limit(1);
      const row = rows[0];
      if (row === undefined) {
        return null;
      }
      return this.mapTaxonRow(row);
    }

    // Not covered: still need taxon + a tier for the status payload.
    const rows = await db
      .select({
        tier: taxonRegion.tier,
        lockoutMonths: taxonRegion.lockoutMonths,
        effortGroup: taxa.effortGroup,
        activityPattern: taxa.activityPattern,
        tidePref: taxa.tidePref,
        commonNames: taxa.commonNames,
        timeZone: regions.timeZone,
      })
      .from(taxa)
      .innerJoin(taxonRegion, eq(taxonRegion.taxonId, taxa.id))
      .innerJoin(regions, eq(regions.id, taxonRegion.regionId))
      .where(eq(taxa.id, taxonId))
      .orderBy(asc(regions.slug))
      .limit(1);
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return this.mapTaxonRow(row);
  }

  private mapTaxonRow(row: {
    readonly tier: string;
    readonly lockoutMonths: number[];
    readonly effortGroup: string;
    readonly activityPattern: string | null;
    readonly tidePref: string | null;
    readonly commonNames: unknown;
    readonly timeZone: string;
  }): {
    readonly tier: string;
    readonly lockoutMonths: readonly number[];
    readonly effortGroup: string;
    readonly activityPattern: ActivityPattern;
    readonly tidePref: TidePref | null;
    readonly commonName: string | undefined;
    readonly fallbackTimeZone: string;
  } {
    const activityRaw = row.activityPattern ?? 'diurnal';
    const activityPattern: ActivityPattern = isActivityPattern(activityRaw)
      ? activityRaw
      : 'diurnal';
    let tidePref: TidePref | null = null;
    if (row.tidePref !== null) {
      const parsedTide = TidePrefSchema.safeParse(row.tidePref);
      tidePref = parsedTide.success ? parsedTide.data : null;
    }
    return {
      tier: row.tier,
      lockoutMonths: row.lockoutMonths,
      effortGroup: row.effortGroup,
      activityPattern,
      tidePref,
      commonName: parseCommonName(row.commonNames),
      fallbackTimeZone: row.timeZone,
    };
  }

  private async readCache(
    db: Database,
    taxonId: number,
    displayCell: string,
    startDate: string,
    tier: Tier,
  ): Promise<ForecastResponse | null> {
    const now = new Date();
    const rows = await db
      .select({
        payload: forecastCache.payload,
        expiresAt: forecastCache.expiresAt,
      })
      .from(forecastCache)
      .where(
        and(
          eq(forecastCache.taxonId, taxonId),
          eq(forecastCache.displayCell, displayCell),
          eq(forecastCache.startDate, startDate),
          eq(forecastCache.scoringVersion, SCORING_V1.version),
          gt(forecastCache.expiresAt, now),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    const parsed = ForecastResponseSchema.safeParse(row.payload);
    if (!parsed.success) {
      return null;
    }
    // Tier change invalidates: cached payload must match the current tier.
    if (parsed.data.tier !== tier) {
      return null;
    }
    return parsed.data;
  }

  private async writeCache(
    db: Database,
    taxonId: number,
    displayCell: string,
    startDate: string,
    payload: ForecastResponse,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + FORECAST_CACHE_TTL_MS);
    await db
      .insert(forecastCache)
      .values({
        taxonId,
        displayCell,
        startDate,
        scoringVersion: SCORING_V1.version,
        payload,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [
          forecastCache.taxonId,
          forecastCache.displayCell,
          forecastCache.startDate,
          forecastCache.scoringVersion,
        ],
        set: {
          payload,
          expiresAt,
        },
      });
  }
}

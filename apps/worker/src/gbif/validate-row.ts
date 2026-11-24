import { createHmac } from 'node:crypto';

import { GBIF_LICENSE_ALLOWLIST } from './predicate.js';

/** Rejection buckets aligned with ingest_runs.rejected_* counters. */
export type ValidateRejectReason = 'licence' | 'coords' | 'date' | 'other';

export type GbifOccurrenceRow = {
  readonly gbifID?: string;
  readonly taxonKey?: string;
  readonly decimalLatitude?: string;
  readonly decimalLongitude?: string;
  readonly coordinateUncertaintyInMeters?: string;
  readonly eventDate?: string;
  readonly license?: string;
  readonly datasetKey?: string;
  readonly recordedBy?: string;
  readonly [key: string]: string | undefined;
};

export type ValidateRowContext = {
  readonly observerHashSalt: string;
  /** True when the point lies inside the ingest region polygon. */
  readonly isInsideRegion: (lat: number, lng: number) => boolean;
};

/**
 * Accepted occurrence after §3.2 step 3 checks.
 * Never includes raw `recordedBy` or other PII.
 */
export type ValidatedOccurrence = {
  readonly sourceRecordId: string;
  readonly taxonKey: number;
  readonly lat: number;
  readonly lng: number;
  /** Effective uncertainty (missing → 1000). */
  readonly uncertaintyM: number;
  /**
   * Finest H3 resolution this point may use:
   * 7 when uncertainty ≤ 1000 m; 5 when ≤ 10_000 m.
   */
  readonly maxRes: 7 | 5;
  readonly eventDate: string;
  readonly year: number;
  readonly week: number;
  readonly hour: number | null;
  readonly license: string;
  readonly datasetKey: string;
  readonly observerHash: string;
};

export type ValidateRowResult =
  | { readonly ok: true; readonly record: ValidatedOccurrence }
  | { readonly ok: false; readonly reason: ValidateRejectReason };

export const UNCERTAINTY_RES7_MAX_M = 1000;
export const UNCERTAINTY_COARSE_MAX_M = 10_000;
export const UNCERTAINTY_DEFAULT_M = 1000;

const LICENSE_SET = new Set<string>(GBIF_LICENSE_ALLOWLIST);

function trim(value: string | undefined): string {
  return value?.trim() ?? '';
}

/** Normalise observer string before HMAC (trim + collapse whitespace + lower-case). */
export function normaliseObserver(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function hashObserver(salt: string, recordedBy: string): string {
  return createHmac('sha256', salt).update(normaliseObserver(recordedBy), 'utf8').digest('hex');
}

/**
 * ISO week-year and week (1–53). Callers merge week 53 → 52 per §3.2.
 */
export function isoWeekParts(utcDate: Date): { readonly isoYear: number; readonly week: number } {
  const day = new Date(
    Date.UTC(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate()),
  );
  const dayNum = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - dayNum);
  const isoYear = day.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((day.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return { isoYear, week };
}

type ParsedEventDate = {
  readonly dateOnly: string;
  readonly year: number;
  readonly week: number;
  readonly hour: number | null;
};

/**
 * Parse GBIF eventDate. Hour is set only when a time is present and is not 00:00.
 */
export function parseEventDate(raw: string): ParsedEventDate | undefined {
  const value = raw.trim();
  if (value.length === 0) {
    return undefined;
  }

  // YYYY-MM-DD or YYYY-MM-DDTHH:MM[:SS][Z|±offset]
  const match =
    /^(?<y>\d{4})-(?<m>\d{2})-(?<d>\d{2})(?:[T ](?<h>\d{2}):(?<min>\d{2})(?::(?<s>\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(
      value,
    );
  if (match?.groups === undefined) {
    return undefined;
  }

  const y = Number(match.groups['y']);
  const m = Number(match.groups['m']);
  const d = Number(match.groups['d']);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
    return undefined;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return undefined;
  }

  const utc = new Date(Date.UTC(y, m - 1, d));
  if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== m - 1 || utc.getUTCDate() !== d) {
    return undefined;
  }

  const { isoYear, week: rawWeek } = isoWeekParts(utc);
  const week = rawWeek >= 53 ? 52 : rawWeek;

  let hour: number | null = null;
  const hRaw = match.groups['h'];
  const minRaw = match.groups['min'];
  if (hRaw !== undefined && minRaw !== undefined) {
    const h = Number(hRaw);
    const min = Number(minRaw);
    if (!Number.isInteger(h) || !Number.isInteger(min) || h < 0 || h > 23 || min < 0 || min > 59) {
      return undefined;
    }
    // 00:00 is a common GBIF placeholder — do not treat as a real hour.
    if (!(h === 0 && min === 0)) {
      hour = h;
    }
  }

  return {
    dateOnly: `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    year: isoYear,
    week,
    hour,
  };
}

function parseCoordinate(raw: string | undefined): number | undefined {
  const text = trim(raw);
  if (text.length === 0) {
    return undefined;
  }
  const n = Number(text);
  if (!Number.isFinite(n)) {
    return undefined;
  }
  return n;
}

function parseUncertaintyM(raw: string | undefined): number | undefined {
  const text = trim(raw);
  if (text.length === 0) {
    return UNCERTAINTY_DEFAULT_M;
  }
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) {
    return undefined;
  }
  return n;
}

/**
 * Validate one GBIF SIMPLE_CSV occurrence row (§3.2 step 3).
 * Pure: no I/O; region membership and salt come from `ctx`.
 */
export function validateRow(row: GbifOccurrenceRow, ctx: ValidateRowContext): ValidateRowResult {
  const license = trim(row.license);
  if (!LICENSE_SET.has(license)) {
    return { ok: false, reason: 'licence' };
  }

  const lat = parseCoordinate(row.decimalLatitude);
  const lng = parseCoordinate(row.decimalLongitude);
  if (lat === undefined || lng === undefined) {
    return { ok: false, reason: 'coords' };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { ok: false, reason: 'coords' };
  }
  if (!ctx.isInsideRegion(lat, lng)) {
    return { ok: false, reason: 'coords' };
  }

  const uncertaintyM = parseUncertaintyM(row.coordinateUncertaintyInMeters);
  if (uncertaintyM === undefined) {
    return { ok: false, reason: 'coords' };
  }
  if (uncertaintyM > UNCERTAINTY_COARSE_MAX_M) {
    return { ok: false, reason: 'coords' };
  }
  const maxRes: 7 | 5 = uncertaintyM <= UNCERTAINTY_RES7_MAX_M ? 7 : 5;

  const event = parseEventDate(trim(row.eventDate));
  if (event === undefined) {
    return { ok: false, reason: 'date' };
  }

  const sourceRecordId = trim(row.gbifID);
  const datasetKey = trim(row.datasetKey);
  const taxonKeyRaw = trim(row.taxonKey);
  if (sourceRecordId.length === 0 || datasetKey.length === 0 || taxonKeyRaw.length === 0) {
    return { ok: false, reason: 'other' };
  }
  const taxonKey = Number(taxonKeyRaw);
  if (!Number.isInteger(taxonKey) || taxonKey <= 0) {
    return { ok: false, reason: 'other' };
  }

  const observerHash = hashObserver(ctx.observerHashSalt, row.recordedBy ?? '');

  const record: ValidatedOccurrence = {
    sourceRecordId,
    taxonKey,
    lat,
    lng,
    uncertaintyM,
    maxRes,
    eventDate: event.dateOnly,
    year: event.year,
    week: event.week,
    hour: event.hour,
    license,
    datasetKey,
    observerHash,
  };

  return { ok: true, record };
}

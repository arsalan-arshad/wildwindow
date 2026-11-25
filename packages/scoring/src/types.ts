/**
 * Scoring I/O types mirroring ARCHITECTURE §7 forecast response (and §4 status overrides).
 * Zod schemas for the HTTP edge live in `packages/shared` (T5.1); these are the pure-core shapes.
 */
import type { Tier } from '@wildwindow/geoprivacy';

export type ForecastStatus = 'ok' | 'unavailable' | 'lockout' | 'not_covered';

export type Confidence = 'high' | 'medium' | 'low';

/** Local clock times as `HH:MM` in the region's time zone. */
export type LocalHm = string;

export type TimeBlock = {
  readonly start: LocalHm;
  readonly end: LocalHm;
};

export type DayFactors = {
  readonly seasonality: number;
  readonly timeOfDay: number;
  readonly light: number;
  /** Numeric Wx, or `no_forecast_yet` when beyond the provider horizon (§4.2). */
  readonly weather: number | 'no_forecast_yet';
  /** Numeric D, or `not_used` when tide does not apply (§4.2). */
  readonly tide: number | 'not_used';
};

export type DayLightWindows = {
  readonly goldenAm: readonly [LocalHm, LocalHm] | null;
  readonly goldenPm: readonly [LocalHm, LocalHm] | null;
};

export type ForecastDay = {
  readonly date: string;
  readonly score: number;
  readonly bestBlock: TimeBlock;
  readonly factors: DayFactors;
  readonly light: DayLightWindows;
};

/** Inputs for `computeForecast` (T4.6). Cell centre only — never a raw user pin. */
export type ForecastInput = {
  readonly taxonId: string;
  readonly tier: Tier;
  readonly displayCell: string;
  readonly areaLabel: string;
  readonly timeZone: string;
  /** First day of the 7-day window as `YYYY-MM-DD` in `timeZone`. */
  readonly startDate: string;
  /** Display-cell centre latitude (degrees). */
  readonly lat: number;
  /** Display-cell centre longitude (degrees). */
  readonly lng: number;
  /** Lockout months 1–12 when the tier uses breeding lockout; empty otherwise. */
  readonly lockoutMonths: readonly number[];
  /** Optional human reason shown when status is `lockout`. */
  readonly lockoutReason?: string;
};

type ForecastBase = {
  readonly scoringVersion: '1.0';
  readonly taxonId: string;
  readonly tier: Tier;
  readonly timeZone: string;
};

export type ForecastOk = ForecastBase & {
  readonly status: 'ok';
  readonly displayCell: string;
  readonly areaLabel: string;
  readonly weekScore: number;
  readonly bestDay: string;
  readonly confidence: Confidence;
  /** Present when confidence is Low (§4.4). */
  readonly range: readonly [number, number] | null;
  readonly days: readonly ForecastDay[];
  readonly explanations: readonly string[];
};

export type ForecastUnavailable = ForecastBase & {
  readonly status: 'unavailable';
  readonly displayCell: null;
  readonly areaLabel: string | null;
  readonly weekScore: null;
  readonly bestDay: null;
  readonly confidence: null;
  readonly range: null;
  readonly days: null;
  readonly explanations: readonly string[];
};

export type ForecastLockout = ForecastBase & {
  readonly status: 'lockout';
  readonly displayCell: string | null;
  readonly areaLabel: string | null;
  readonly weekScore: null;
  readonly bestDay: null;
  readonly confidence: null;
  readonly range: null;
  readonly days: null;
  readonly reason: string;
  readonly explanations: readonly string[];
};

export type ForecastNotCovered = ForecastBase & {
  readonly status: 'not_covered';
  readonly displayCell: null;
  readonly areaLabel: string | null;
  readonly weekScore: null;
  readonly bestDay: null;
  readonly confidence: null;
  readonly range: null;
  readonly days: null;
  readonly explanations: readonly string[];
};

export type ForecastResponse =
  | ForecastOk
  | ForecastUnavailable
  | ForecastLockout
  | ForecastNotCovered;

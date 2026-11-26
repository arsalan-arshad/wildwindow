/**
 * Forecast detail helpers (S-07 / T6.5).
 * Light windows are computed on-device from the display-cell centre (US-06);
 * lat/lng are never stored or logged.
 */
import { cellToLatLng, isValidCell } from 'h3-js';
import { lightForDay, type LightDay } from '@wildwindow/scoring/light';

export type { LightDay };

import type { RegionId } from '@/lib/regions';

export const FORECAST_STATUSES = ['ok', 'unavailable', 'lockout', 'not_covered'] as const;
export type ForecastStatus = (typeof FORECAST_STATUSES)[number];

export const CONFIDENCE_LABELS = ['high', 'medium', 'low'] as const;
export type ConfidenceLabel = (typeof CONFIDENCE_LABELS)[number];

export type TimeBlock = {
  readonly start: string;
  readonly end: string;
};

export type DayFactors = {
  readonly seasonality: number;
  readonly timeOfDay: number;
  readonly light: number;
  readonly weather: number | 'no_forecast_yet';
  readonly tide: number | 'not_used';
};

export type ForecastDay = {
  readonly date: string;
  readonly score: number;
  readonly bestBlock: TimeBlock;
  readonly factors: DayFactors;
  readonly light: {
    readonly goldenAm: readonly [string, string] | null;
    readonly goldenPm: readonly [string, string] | null;
  };
};

export type ForecastOk = {
  readonly status: 'ok';
  readonly scoringVersion: '1.0';
  readonly taxonId: string;
  readonly tier: string;
  readonly timeZone: string;
  readonly displayCell: string;
  readonly areaLabel: string;
  readonly weekScore: number;
  readonly bestDay: string;
  readonly confidence: ConfidenceLabel;
  readonly range: readonly [number, number] | null;
  readonly days: readonly ForecastDay[];
  readonly explanations: readonly string[];
};

export type ForecastStatusOnly = {
  readonly status: 'unavailable' | 'lockout' | 'not_covered';
  readonly scoringVersion: '1.0';
  readonly taxonId: string;
  readonly tier: string;
  readonly timeZone: string;
  readonly displayCell: string | null;
  readonly areaLabel: string | null;
  readonly weekScore: null;
  readonly bestDay: null;
  readonly confidence: null;
  readonly range: null;
  readonly days: null;
  readonly explanations: readonly string[];
  readonly reason?: string;
};

export type ForecastResponse = ForecastOk | ForecastStatusOnly;

export type FactorKey = 'seasonality' | 'timeOfDay' | 'light' | 'weather' | 'tide';

export const FACTOR_KEYS: readonly FactorKey[] = [
  'seasonality',
  'timeOfDay',
  'light',
  'weather',
  'tide',
] as const;

export const REGION_TIME_ZONES: Readonly<Record<RegionId, string>> = {
  scotland: 'Europe/London',
  sindh: 'Asia/Karachi',
};

const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Local calendar `YYYY-MM-DD` for `at` in `timeZone` (no hidden clock — pass `now`). */
export function localYmd(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (year === undefined || month === undefined || day === undefined) {
    throw new RangeError(`Unable to format local date for zone ${timeZone}`);
  }
  return `${year}-${month}-${day}`;
}

export function forecastStartForRegion(region: RegionId, now: Date = new Date()): string {
  return localYmd(now, REGION_TIME_ZONES[region]);
}

/** Short weekday label for a `YYYY-MM-DD` in `timeZone` (e.g. Thu). */
export function weekdayShort(dateYmd: string, timeZone: string, locale = 'en'): string {
  if (!YMD_PATTERN.test(dateYmd)) {
    return dateYmd;
  }
  // Noon avoids DST edge cases when interpreting the calendar date.
  const utcGuess = new Date(`${dateYmd}T12:00:00.000Z`);
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'short',
  }).format(utcGuess);
}

/** Medium date label (e.g. 21 Nov). */
export function mediumDate(dateYmd: string, timeZone: string, locale = 'en'): string {
  if (!YMD_PATTERN.test(dateYmd)) {
    return dateYmd;
  }
  const utcGuess = new Date(`${dateYmd}T12:00:00.000Z`);
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    day: 'numeric',
    month: 'short',
  }).format(utcGuess);
}

export function formatBlock(block: TimeBlock): string {
  return `${block.start}–${block.end}`;
}

export function formatInterval(interval: readonly [string, string] | null): string | null {
  if (interval === null) {
    return null;
  }
  return `${interval[0]}–${interval[1]}`;
}

/** Factor value for display — never a probability / "% chance". */
export function formatFactorValue(value: DayFactors[FactorKey]): string {
  if (value === 'not_used') {
    return 'not_used';
  }
  if (value === 'no_forecast_yet') {
    return 'no_forecast_yet';
  }
  return value.toFixed(2);
}

export function isNumericFactor(value: DayFactors[FactorKey]): value is number {
  return typeof value === 'number';
}

/**
 * On-device light for a display cell centre. Lat/lng exist only for the
 * synchronous `lightForDay` call and are discarded with the return.
 */
export function lightForDisplayCell(params: {
  readonly displayCell: string;
  readonly date: string;
  readonly timeZone: string;
}): LightDay | null {
  const { displayCell, date, timeZone } = params;
  if (!isValidCell(displayCell)) {
    return null;
  }
  const [lat, lng] = cellToLatLng(displayCell);
  return lightForDay({ date, timeZone, lat, lng });
}

export function findDay(days: readonly ForecastDay[], date: string): ForecastDay | undefined {
  return days.find((day) => day.date === date);
}

/** Honest score label copy — Window score, never "% chance". */
export function weekScoreDisplay(forecast: ForecastOk): {
  readonly primary: string;
  readonly showRange: boolean;
  readonly lowConfidence: boolean;
} {
  const lowConfidence = forecast.confidence === 'low';
  if (lowConfidence && forecast.range !== null) {
    return {
      primary: `${String(forecast.range[0])}–${String(forecast.range[1])}`,
      showRange: true,
      lowConfidence: true,
    };
  }
  return {
    primary: String(forecast.weekScore),
    showRange: false,
    lowConfidence: false,
  };
}

/** Guard used in tests: copy must never call the score a probability. */
export function textImpliesPercentChance(text: string): boolean {
  return /%\s*chance|chance\s+of\s+\d|probability/i.test(text);
}

import type { HourlyWeather } from '../providers/weather/types.js';
import type { DayWeatherInput } from '@wildwindow/scoring';

function formatLocalYmd(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  if (y === undefined || m === undefined || d === undefined) {
    throw new RangeError(`Unable to format local date for zone ${timeZone}`);
  }
  return `${y}-${m}-${d}`;
}

function localHour(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    hour12: false,
  }).formatToParts(at);
  const hour = parts.find((p) => p.type === 'hour')?.value;
  if (hour === undefined) {
    throw new RangeError(`Unable to format local hour for zone ${timeZone}`);
  }
  return Number(hour === '24' ? '0' : hour);
}

function offsetMsAt(at: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = dtf.formatToParts(at);
  const tzName = parts.find((p) => p.type === 'timeZoneName')?.value;
  if (tzName === undefined) {
    throw new RangeError(`Unable to resolve offset for ${timeZone}`);
  }
  if (tzName === 'GMT' || tzName === 'UTC') {
    return 0;
  }
  const m = /^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(tzName);
  if (m === null) {
    throw new RangeError(`Unexpected timeZoneName ${tzName} for ${timeZone}`);
  }
  const sign = m[1] === '-' ? -1 : 1;
  const hours = Number(m[2]);
  const minutes = m[3] === undefined ? 0 : Number(m[3]);
  return sign * (hours * 3_600_000 + minutes * 60_000);
}

function zonedLocalNoon(dateYmd: string, timeZone: string): Date {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateYmd);
  if (dm === null) {
    throw new RangeError(`Expected YYYY-MM-DD, got ${dateYmd}`);
  }
  const year = Number(dm[1]);
  const month = Number(dm[2]);
  const day = Number(dm[3]);
  let utcGuess = Date.UTC(year, month - 1, day, 12, 0, 0, 0);
  for (let i = 0; i < 3; i += 1) {
    const offset = offsetMsAt(new Date(utcGuess), timeZone);
    const next = Date.UTC(year, month - 1, day, 12, 0, 0, 0) - offset;
    if (next === utcGuess) {
      break;
    }
    utcGuess = next;
  }
  return new Date(utcGuess);
}

/** Seven local calendar dates starting at `startYmd` (inclusive). */
export function sevenLocalDates(startYmd: string, timeZone: string): readonly string[] {
  const dates: string[] = [];
  const startNoon = zonedLocalNoon(startYmd, timeZone);
  for (let i = 0; i < 7; i += 1) {
    const shifted = new Date(startNoon.getTime() + i * 24 * 60 * 60 * 1000);
    dates.push(formatLocalYmd(shifted, timeZone));
  }
  return dates;
}

/**
 * Bucket hourly provider samples into local-date → local-hour maps for scoring.
 * Days with no samples are marked `beyondHorizon` (§4.2).
 */
export function weatherByDateFromHours(params: {
  readonly hours: readonly HourlyWeather[];
  readonly dates: readonly string[];
  readonly timeZone: string;
}): Readonly<Record<string, DayWeatherInput>> {
  type HourSample = {
    precipProb: number;
    precipMm: number;
    windKph: number;
    cloudPct: number;
  };
  const byDate: Record<string, { byHour: Partial<Record<number, HourSample>> }> = {};

  for (const hour of params.hours) {
    const at = new Date(hour.timeUtc);
    if (Number.isNaN(at.getTime())) {
      continue;
    }
    const date = formatLocalYmd(at, params.timeZone);
    const h = localHour(at, params.timeZone);
    const day = byDate[date] ?? { byHour: {} };
    day.byHour[h] = {
      precipProb: hour.precipProb,
      precipMm: hour.precipMm,
      windKph: hour.windKph,
      cloudPct: hour.cloudPct,
    };
    byDate[date] = day;
  }

  const out: Record<string, DayWeatherInput> = {};
  for (const date of params.dates) {
    const day = byDate[date];
    if (day === undefined || Object.keys(day.byHour).length === 0) {
      out[date] = { beyondHorizon: true };
    } else {
      out[date] = { byHour: day.byHour };
    }
  }
  return out;
}

/** Instant for the start of the local forecast window (midnight-ish via noon−12h). */
export function forecastWindowStartUtc(startYmd: string, timeZone: string): Date {
  const noon = zonedLocalNoon(startYmd, timeZone);
  return new Date(noon.getTime() - 12 * 60 * 60 * 1000);
}

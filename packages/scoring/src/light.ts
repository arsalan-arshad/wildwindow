/**
 * Light helpers for Window score (§4.2 T/G, T4.2).
 * Pure: pass the calendar date and cell-centre coordinates; no hidden clock.
 *
 * Altitude bands (degrees, matching ARCHITECTURE §4.2 / T4.2):
 * - civil dawn/dusk: −6°
 * - blue hour: −6° … −4°
 * - golden hour: −4° … +6°
 *
 * Uses `suncalc` v2 (`getPosition` altitude is already in degrees).
 */
import { addTime, getPosition, getTimes, type SunTimes } from 'suncalc';

import { SCORING_V1 } from './config/v1.js';
import { formatLocalHm, offsetMsAt, zonedLocalDateTime } from './tz.js';

export type LatLng = {
  readonly lat: number;
  readonly lng: number;
};

export type TimeBlock = {
  readonly start: string;
  readonly end: string;
};

export type LightInterval = readonly [string, string];

export type LightDay = {
  readonly date: string;
  readonly timeZone: string;
  /** Civil dawn `HH:MM` local, or null when the sun never reaches −6° that day. */
  readonly civilDawn: string | null;
  readonly civilDusk: string | null;
  readonly goldenAm: LightInterval | null;
  readonly goldenPm: LightInterval | null;
  readonly blueAm: LightInterval | null;
  readonly bluePm: LightInterval | null;
  /** 2-hour blocks starting on the hour, entirely within civil daylight. */
  readonly candidateBlocks: readonly TimeBlock[];
};

/** Register the −4° golden/blue boundary once (suncalc mutates its angle table). */
const GOLDEN_LOW = SCORING_V1.light.goldenHourLowDeg;
addTime(GOLDEN_LOW, 'goldenMorningStart', 'goldenEveningEnd');

function assertFiniteLatLng(lat: number, lng: number): void {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new RangeError(`lat must be in [-90, 90], got ${String(lat)}`);
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new RangeError(`lng must be in [-180, 180], got ${String(lng)}`);
  }
}

function asDate(value: Date | null | undefined): Date | null {
  if (value == null) {
    return null;
  }
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    return null;
  }
  return value;
}

/** Narrow custom `SunTimes` index-signature values to `Date | null`. */
function asDateOrNull(value: Date | boolean | null | undefined): Date | null {
  if (value instanceof Date) {
    return value;
  }
  return null;
}

/** Sun altitude above the horizon in degrees (suncalc v2 already returns degrees). */
export function sunAltitudeDeg(at: Date, loc: LatLng): number {
  assertFiniteLatLng(loc.lat, loc.lng);
  return getPosition(at, loc.lat, loc.lng).altitude;
}

function intervalOrNull(
  start: Date | null,
  end: Date | null,
  timeZone: string,
): LightInterval | null {
  if (start === null || end === null) {
    return null;
  }
  if (end.getTime() <= start.getTime()) {
    return null;
  }
  return [formatLocalHm(start, timeZone), formatLocalHm(end, timeZone)];
}

function hm(date: Date | null, timeZone: string): string | null {
  return date === null ? null : formatLocalHm(date, timeZone);
}

/**
 * 2-hour blocks starting on the local hour, entirely within [civilDawn, civilDusk].
 * Empty when civil daylight is missing or shorter than two hours (polar night).
 * When the sun stays above −6° all day (midnight sun), returns every hour-aligned 2h block.
 */
export function candidateBlocks(params: {
  readonly date: string;
  readonly timeZone: string;
  readonly civilDawn: Date | null;
  readonly civilDusk: Date | null;
  /** True when altitude stays ≥ civil threshold all day. */
  readonly alwaysDaylight?: boolean;
}): readonly TimeBlock[] {
  const { date, timeZone, civilDawn, civilDusk, alwaysDaylight = false } = params;
  const blockHours = SCORING_V1.light.blockHours;
  const blocks: TimeBlock[] = [];

  if (alwaysDaylight) {
    for (let h = 0; h < 24; h += 1) {
      const startH = String(h).padStart(2, '0');
      const endH = String((h + blockHours) % 24).padStart(2, '0');
      blocks.push({ start: `${startH}:00`, end: `${endH}:00` });
    }
    return blocks;
  }

  if (civilDawn === null || civilDusk === null) {
    return [];
  }

  for (let h = 0; h <= 24 - blockHours; h += 1) {
    const startHm = `${String(h).padStart(2, '0')}:00`;
    const endHour = h + blockHours;
    const endHm = `${String(endHour).padStart(2, '0')}:00`;
    const startAt = zonedLocalDateTime(date, startHm, timeZone);
    const endAt = zonedLocalDateTime(date, endHm, timeZone);
    if (startAt.getTime() >= civilDawn.getTime() && endAt.getTime() <= civilDusk.getTime()) {
      blocks.push({ start: startHm, end: endHm });
    }
  }
  return blocks;
}

function sunTimesForCivilDay(dateYmd: string, timeZone: string, loc: LatLng): SunTimes {
  const localNoon = zonedLocalDateTime(dateYmd, '12:00', timeZone);
  const utcOffsetMinutes = offsetMsAt(localNoon, timeZone) / 60_000;
  return getTimes(localNoon, loc.lat, loc.lng, 0, utcOffsetMinutes);
}

/**
 * Civil dawn/dusk, golden/blue hour windows, and candidate 2-hour blocks for one local day.
 * Never throws for polar latitudes: missing events become `null` / empty lists.
 */
export function lightForDay(params: {
  readonly date: string;
  readonly timeZone: string;
  readonly lat: number;
  readonly lng: number;
}): LightDay {
  const { date, timeZone, lat, lng } = params;
  assertFiniteLatLng(lat, lng);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new RangeError(`date must be YYYY-MM-DD, got ${date}`);
  }

  const loc: LatLng = { lat, lng };
  const times = sunTimesForCivilDay(date, timeZone, loc);

  const dawn = asDate(times.dawn);
  const dusk = asDate(times.dusk);
  // Custom −4° crossings registered via addTime (index signature on SunTimes).
  const goldenAmStart = asDate(asDateOrNull(times['goldenMorningStart']));
  const goldenAmEnd = asDate(times.goldenHourEnd);
  const goldenPmStart = asDate(times.goldenHour);
  const goldenPmEnd = asDate(asDateOrNull(times['goldenEveningEnd']));

  const alwaysDaylight = times.alwaysUp === true;
  // Continuous civil daylight: dawn/dusk null; treat as alwaysDaylight when noon ≥ −6°
  // and suncalc reported no dawn/dusk (covers alwaysUp and near-polar civil-day cases).
  const continuousCivil =
    alwaysDaylight || (dawn === null && dusk === null && times.alwaysDown !== true);

  let alwaysCivilDay = continuousCivil;
  if (continuousCivil && !alwaysDaylight) {
    const noon = asDate(times.solarNoon);
    if (noon !== null) {
      alwaysCivilDay = sunAltitudeDeg(noon, loc) >= SCORING_V1.light.civilAltitudeDeg;
    } else {
      alwaysCivilDay = false;
    }
  }

  const blueAm = intervalOrNull(dawn, goldenAmStart, timeZone);
  const goldenAm = intervalOrNull(goldenAmStart, goldenAmEnd, timeZone);
  const goldenPm = intervalOrNull(goldenPmStart, goldenPmEnd, timeZone);
  const bluePm = intervalOrNull(goldenPmEnd, dusk, timeZone);

  const blocks = candidateBlocks({
    date,
    timeZone,
    civilDawn: dawn,
    civilDusk: dusk,
    alwaysDaylight: alwaysCivilDay,
  });

  return {
    date,
    timeZone,
    civilDawn: alwaysCivilDay ? null : hm(dawn, timeZone),
    civilDusk: alwaysCivilDay ? null : hm(dusk, timeZone),
    goldenAm,
    goldenPm,
    blueAm,
    bluePm,
    candidateBlocks: blocks,
  };
}

/** Fraction of a [start, end] block that overlaps golden hour (for factor G). */
export function goldenFraction(params: {
  readonly blockStart: Date;
  readonly blockEnd: Date;
  readonly goldenAm: readonly [Date, Date] | null;
  readonly goldenPm: readonly [Date, Date] | null;
}): number {
  const { blockStart, blockEnd, goldenAm, goldenPm } = params;
  const duration = blockEnd.getTime() - blockStart.getTime();
  if (duration <= 0) {
    return 0;
  }
  let overlap = 0;
  for (const win of [goldenAm, goldenPm]) {
    if (win === null) {
      continue;
    }
    const lo = Math.max(blockStart.getTime(), win[0].getTime());
    const hi = Math.min(blockEnd.getTime(), win[1].getTime());
    if (hi > lo) {
      overlap += hi - lo;
    }
  }
  return Math.min(1, overlap / duration);
}

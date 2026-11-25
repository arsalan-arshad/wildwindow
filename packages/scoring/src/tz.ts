/** Time-zone helpers for light windows — pure, no hidden clock. */

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * Format a UTC instant as `HH:MM` in `timeZone` (24-hour, no seconds).
 */
export function formatLocalHm(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(at);
  const hour = parts.find((p) => p.type === 'hour')?.value;
  const minute = parts.find((p) => p.type === 'minute')?.value;
  if (hour === undefined || minute === undefined) {
    throw new RangeError(`Unable to format local time for zone ${timeZone}`);
  }
  // en-GB can emit "24" for midnight in some engines — normalise to 00.
  const h = hour === '24' ? '00' : hour;
  return `${h}:${minute}`;
}

/**
 * Absolute value of the UTC offset (ms) of `timeZone` at instant `at`.
 * Positive east of UTC (Karachi +5h → +18_000_000).
 */
export function offsetMsAt(at: Date, timeZone: string): number {
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
  // "GMT", "GMT+5", "GMT+05:30", "GMT-4"
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

/**
 * Instant corresponding to local calendar `YYYY-MM-DD` + `HH:MM` in `timeZone`.
 */
export function zonedLocalDateTime(dateYmd: string, hm: string, timeZone: string): Date {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateYmd);
  const tm = /^(\d{2}):(\d{2})$/.exec(hm);
  if (dm === null || tm === null) {
    throw new RangeError(`Expected YYYY-MM-DD and HH:MM, got ${dateYmd} ${hm}`);
  }
  const year = Number(dm[1]);
  const month = Number(dm[2]);
  const day = Number(dm[3]);
  const hour = Number(tm[1]);
  const minute = Number(tm[2]);
  // First guess: treat components as UTC, then correct by the zone offset at that instant.
  let utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  for (let i = 0; i < 3; i += 1) {
    const offset = offsetMsAt(new Date(utcGuess), timeZone);
    const next = Date.UTC(year, month - 1, day, hour, minute, 0, 0) - offset;
    if (next === utcGuess) {
      break;
    }
    utcGuess = next;
  }
  return new Date(utcGuess);
}

/** Local calendar date `YYYY-MM-DD` for `at` in `timeZone`. */
export function formatLocalYmd(at: Date, timeZone: string): string {
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

export function localHourMinute(
  at: Date,
  timeZone: string,
): {
  hour: number;
  minute: number;
} {
  const hm = formatLocalHm(at, timeZone);
  const [h, m] = hm.split(':');
  return { hour: Number(h), minute: Number(m) };
}

export { pad2 };

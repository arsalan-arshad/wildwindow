import { TIER_POLICY, type Tier } from './tiers.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * True when `eventDate` is at least the tier's delayDays before `now`
 * (calendar-independent: uses UTC millisecond difference).
 */
export function isOlderThanDelay(eventDate: Date, now: Date, tier: Tier): boolean {
  const delayDays = TIER_POLICY[tier].delayDays;
  if (delayDays === 0) {
    return eventDate.getTime() <= now.getTime();
  }
  const ageMs = now.getTime() - eventDate.getTime();
  return ageMs >= delayDays * MS_PER_DAY;
}

/**
 * True when the calendar month of `date` in `timeZone` is one of `months` (1–12).
 * Uses `Intl` parts so DST transitions are handled by the platform.
 */
export function isInLockout(date: Date, months: readonly number[], timeZone: string): boolean {
  if (months.length === 0) {
    return false;
  }
  for (const month of months) {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new RangeError(`lockout month must be 1–12, got ${String(month)}`);
    }
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'numeric',
  }).formatToParts(date);
  const monthPart = parts.find((part) => part.type === 'month');
  if (monthPart === undefined) {
    throw new Error(`Intl did not return a month for timeZone ${timeZone}`);
  }
  const month = Number(monthPart.value);
  return months.includes(month);
}

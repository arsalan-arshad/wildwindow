/**
 * Factor T — time of day for a 2-hour block (§4.2 / T4.4).
 */
import { ACTIVITY_TEMPLATES } from './activity-templates.js';
import { SCORING_V1 } from './config/v1.js';

import type { ActivityPattern } from './activity-pattern.js';

const HOURS = 24;

function assertHourCounts(counts: readonly number[]): void {
  if (counts.length !== HOURS) {
    throw new RangeError(
      `hourly profile must have ${String(HOURS)} bins, got ${String(counts.length)}`,
    );
  }
  for (let i = 0; i < counts.length; i += 1) {
    const v = counts[i];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      throw new RangeError(`hour ${String(i)} count must be a non-negative finite number`);
    }
  }
}

/**
 * Circular 3-tap smooth with `SCORING_V1.hourKernel` ([0.25, 0.5, 0.25]).
 */
export function smoothHourlyCounts(counts: readonly number[]): number[] {
  assertHourCounts(counts);
  const [kPrev, kSelf, kNext] = SCORING_V1.hourKernel;
  const out: number[] = [];
  for (let h = 0; h < HOURS; h += 1) {
    const prev = counts[(h + HOURS - 1) % HOURS];
    const self = counts[h];
    const next = counts[(h + 1) % HOURS];
    if (prev === undefined || self === undefined || next === undefined) {
      throw new RangeError('hour index out of range');
    }
    out.push(kPrev * prev + kSelf * self + kNext * next);
  }
  return out;
}

/**
 * Smoothed hourly shares in [0, 1] that sum to 1.
 * Profiles with fewer than `hourProfileMinRecords` timed records use the
 * activity-pattern template instead of the empirical counts.
 */
export function hourlyShares(
  counts: readonly number[],
  activityPattern: ActivityPattern,
): number[] {
  assertHourCounts(counts);
  const total = counts.reduce((sum, n) => sum + n, 0);
  const source =
    total < SCORING_V1.hourProfileMinRecords ? ACTIVITY_TEMPLATES[activityPattern] : counts;
  const smoothed = smoothHourlyCounts(source);
  const sum = smoothed.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    // Degenerate: uniform prior so T stays well-defined.
    return Array.from({ length: HOURS }, () => 1 / HOURS);
  }
  return smoothed.map((v) => v / sum);
}

/** Mass of a 2-hour block starting at local hour `h` (wraps across midnight). */
export function blockMass(shares: readonly number[], startHour: number): number {
  if (!Number.isInteger(startHour) || startHour < 0 || startHour > 23) {
    throw new RangeError(`startHour must be an integer 0–23, got ${String(startHour)}`);
  }
  assertHourCounts(shares);
  const a = shares[startHour];
  const b = shares[(startHour + 1) % HOURS];
  if (a === undefined || b === undefined) {
    throw new RangeError('hour index out of range');
  }
  return a + b;
}

/**
 * T_b = block mass / max mass over candidate blocks. The best block gets T = 1.
 * Empty candidates → 0.
 */
export function factorT(params: {
  readonly shares: readonly number[];
  readonly blockStartHour: number;
  readonly candidateStartHours: readonly number[];
}): number {
  const { shares, blockStartHour, candidateStartHours } = params;
  if (candidateStartHours.length === 0) {
    return 0;
  }
  let maxMass = 0;
  for (const h of candidateStartHours) {
    maxMass = Math.max(maxMass, blockMass(shares, h));
  }
  if (maxMass <= 0) {
    return 0;
  }
  return blockMass(shares, blockStartHour) / maxMass;
}

/** Parse `HH:MM` → hour 0–23 (minutes must be 00 for candidate blocks). */
export function startHourFromHm(hm: string): number {
  const m = /^(\d{2}):(\d{2})$/.exec(hm);
  if (m === null) {
    throw new RangeError(`expected HH:MM, got ${hm}`);
  }
  const hour = Number(m[1]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError(`hour out of range in ${hm}`);
  }
  return hour;
}

/**
 * Factor D — tide for a 2-hour block (§4.2 / T4.5).
 *
 * Preferred windows:
 * - low = ±windowHours around low tide
 * - high = ±windowHours around high tide
 * - rising = from low to high
 * - falling = from high to low
 *
 * When tide does not apply (no pref / `none` / no provider data): D = 1, flagged `not_used`.
 */
import { SCORING_V1 } from './config/v1.js';

import type { TidePref } from './tide-pref.js';

export type TideExtremes = {
  readonly highs: readonly Date[];
  readonly lows: readonly Date[];
};

export type FactorDResult = {
  readonly value: number;
  readonly tide: number | 'not_used';
};

function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function preferredWindows(
  pref: Exclude<TidePref, 'none'>,
  tides: TideExtremes,
  windowMs: number,
): readonly (readonly [number, number])[] {
  const windows: [number, number][] = [];

  if (pref === 'low') {
    for (const low of tides.lows) {
      const t = low.getTime();
      windows.push([t - windowMs, t + windowMs]);
    }
    return windows;
  }
  if (pref === 'high') {
    for (const high of tides.highs) {
      const t = high.getTime();
      windows.push([t - windowMs, t + windowMs]);
    }
    return windows;
  }

  // rising / falling: pair each low with the next high (or vice versa) in time order.
  const events: { readonly at: number; readonly kind: 'high' | 'low' }[] = [
    ...tides.highs.map((d) => ({ at: d.getTime(), kind: 'high' as const })),
    ...tides.lows.map((d) => ({ at: d.getTime(), kind: 'low' as const })),
  ].sort((a, b) => a.at - b.at);

  for (let i = 0; i < events.length - 1; i += 1) {
    const cur = events[i];
    const next = events[i + 1];
    if (cur === undefined || next === undefined) {
      continue;
    }
    if (pref === 'rising' && cur.kind === 'low' && next.kind === 'high') {
      windows.push([cur.at, next.at]);
    }
    if (pref === 'falling' && cur.kind === 'high' && next.kind === 'low') {
      windows.push([cur.at, next.at]);
    }
  }
  return windows;
}

export function factorD(params: {
  readonly tidePref: TidePref | null | undefined;
  readonly blockStart: Date;
  readonly blockEnd: Date;
  readonly tides: TideExtremes | null;
}): FactorDResult {
  const { tidePref, blockStart, blockEnd, tides } = params;
  const preferred = SCORING_V1.tide.preferred;
  const outside = SCORING_V1.tide.outside;

  if (
    tidePref === undefined ||
    tidePref === null ||
    tidePref === 'none' ||
    tides === null ||
    (tides.highs.length === 0 && tides.lows.length === 0)
  ) {
    return { value: preferred, tide: 'not_used' };
  }

  const blockLo = blockStart.getTime();
  const blockHi = blockEnd.getTime();
  if (!(blockHi > blockLo)) {
    throw new RangeError('blockEnd must be after blockStart');
  }

  const windowMs = SCORING_V1.tide.windowHours * 3_600_000;
  const windows = preferredWindows(tidePref, tides, windowMs);
  for (const win of windows) {
    if (intervalsOverlap(blockLo, blockHi, win[0], win[1])) {
      return { value: preferred, tide: preferred };
    }
  }
  return { value: outside, tide: outside };
}

/**
 * Combine factors into conditions C_b and DayScore (§4.3).
 */
import { SCORING_V1 } from './config/v1.js';

function assertUnitInterval(name: string, value: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be in [0, 1], got ${String(value)}`);
  }
}

/**
 * C_b = (timeBase + timeWeight·T) · (lightBase + lightWeight·G) · Wx · D
 * Each parenthesis ≤ 1 when T,G ≤ 1; overall C_b ≤ 1 when Wx,D ≤ 1.
 */
export function conditionsC(params: {
  readonly t: number;
  readonly g: number;
  readonly wx: number;
  readonly d: number;
}): number {
  assertUnitInterval('t', params.t);
  assertUnitInterval('g', params.g);
  assertUnitInterval('wx', params.wx);
  assertUnitInterval('d', params.d);
  const { timeBase, timeWeight, lightBase, lightWeight } = SCORING_V1.conditions;
  return (
    (timeBase + timeWeight * params.t) * (lightBase + lightWeight * params.g) * params.wx * params.d
  );
}

/** DayScore_d = round(100 · sqrt(H) · max_b C_b), integer in 0..100. */
export function dayScore(h: number, maxC: number): number {
  assertUnitInterval('h', h);
  assertUnitInterval('maxC', maxC);
  const raw = 100 * Math.sqrt(h) * maxC;
  const rounded = Math.round(raw);
  return Math.min(100, Math.max(0, rounded));
}

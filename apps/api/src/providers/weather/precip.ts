import { SCORING_V1 } from '@wildwindow/scoring';

/**
 * Resolve precipitation probability (ARCHITECTURE §3.4).
 * When MET Norway (or another provider) omits probability, derive
 * `min(1, precipMm / precipMmForCertain)` using the scoring v1 constant.
 */
export function resolveProviderPrecipProb(sample: {
  readonly precipProb?: number | null;
  readonly precipMm: number;
}): number {
  if (
    typeof sample.precipMm !== 'number' ||
    !Number.isFinite(sample.precipMm) ||
    sample.precipMm < 0
  ) {
    throw new RangeError(`precipMm must be a non-negative finite number`);
  }
  if (sample.precipProb !== undefined && sample.precipProb !== null) {
    if (
      typeof sample.precipProb !== 'number' ||
      !Number.isFinite(sample.precipProb) ||
      sample.precipProb < 0 ||
      sample.precipProb > 1
    ) {
      throw new RangeError(`precipProb must be in [0, 1], got ${String(sample.precipProb)}`);
    }
    return sample.precipProb;
  }
  return Math.min(1, sample.precipMm / SCORING_V1.weather.precipMmForCertain);
}

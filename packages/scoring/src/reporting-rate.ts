import { SCORING_V1 } from './config/v1.js';

export type ReportingRateInput = {
  /** Species occurrence count in the neighbourhood / cell×weeks window. */
  readonly nSpecies: number;
  /** Effort count over the same cells and weeks. */
  readonly nEffort: number;
  /** Region reporting rate R_reg = Σ_region n_s / Σ_region n_e over the week window. */
  readonly regionRate: number;
  /** Override shrink α (defaults to SCORING_V1.alpha). */
  readonly alpha?: number;
};

export type FactorHInput = {
  readonly nSpecies: number;
  readonly nEffort: number;
  /** Σ_region n_e over the week window — zero ⇒ H = 0 (§4.2). */
  readonly regionEffort: number;
  readonly regionRate: number;
  /** P95 reporting rate reference for the taxon×region. */
  readonly rrRef: number;
  readonly alpha?: number;
};

function assertNonNegFinite(name: string, value: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}

/**
 * Effort-normalised reporting rate with empirical-Bayes shrink toward the region (§4.2):
 * `rr = (n_s + α · R_reg) / (n_e + α)`.
 */
export function reportingRate(input: ReportingRateInput): number {
  assertNonNegFinite('nSpecies', input.nSpecies);
  assertNonNegFinite('nEffort', input.nEffort);
  assertNonNegFinite('regionRate', input.regionRate);
  const alpha = input.alpha ?? SCORING_V1.alpha;
  assertNonNegFinite('alpha', alpha);
  return (input.nSpecies + alpha * input.regionRate) / (input.nEffort + alpha);
}

/**
 * Seasonality / local-history factor H ∈ [0, 1] (§4.2).
 * Zero region effort ⇒ 0; otherwise `min(1, rr / rr_ref)`.
 */
export function factorH(input: FactorHInput): number {
  assertNonNegFinite('regionEffort', input.regionEffort);
  assertNonNegFinite('rrRef', input.rrRef);
  if (input.regionEffort === 0 || input.rrRef === 0) {
    return 0;
  }
  const rr = reportingRate({
    nSpecies: input.nSpecies,
    nEffort: input.nEffort,
    regionRate: input.regionRate,
    ...(input.alpha === undefined ? {} : { alpha: input.alpha }),
  });
  return Math.min(1, rr / input.rrRef);
}

/**
 * Empirical P95 of a sample (linear interpolation on the sorted values).
 * Used for `rr_ref` over published cell×week reporting rates (§4.2).
 */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) {
    throw new RangeError('percentile requires a non-empty sample');
  }
  if (!Number.isFinite(p) || p < 0 || p > 100) {
    throw new RangeError(`p must be in [0, 100], got ${String(p)}`);
  }
  const sorted = [...values].sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first === undefined || last === undefined) {
    throw new RangeError('percentile requires a non-empty sample');
  }
  if (p === 0) {
    return first;
  }
  if (p === 100) {
    return last;
  }
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  const loVal = sorted[lo];
  const hiVal = sorted[hi];
  if (loVal === undefined || hiVal === undefined) {
    throw new RangeError('percentile index out of range');
  }
  if (lo === hi) {
    return loVal;
  }
  const t = rank - lo;
  return loVal + t * (hiVal - loVal);
}

export function p95(values: readonly number[]): number {
  return percentile(values, 95);
}

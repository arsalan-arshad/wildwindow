export type BucketLevel = 1 | 2 | 3 | 4 | 5;

/**
 * Build a quantile bucketiser for public map levels (1–5).
 * Ties share the higher bucket of equal values (stable by value).
 */
export function bucketise(
  values: readonly number[],
  buckets = 5,
): (value: number) => BucketLevel {
  if (buckets !== 5) {
    throw new RangeError('bucketise currently supports exactly 5 buckets');
  }
  if (values.length === 0) {
    return () => 1;
  }

  const sorted = [...values].filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) {
    return () => 1;
  }
  if (sorted.length === 1) {
    return () => 1;
  }

  const unique = [...new Set(sorted)];
  if (unique.length === 1) {
    return () => 1;
  }

  // Thresholds at 20/40/60/80 percentiles of the sorted sample.
  const quantile = (p: number): number => {
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
    const value = sorted[idx];
    if (value === undefined) {
      throw new Error('quantile index out of range');
    }
    return value;
  };
  const t1 = quantile(0.2);
  const t2 = quantile(0.4);
  const t3 = quantile(0.6);
  const t4 = quantile(0.8);

  return (value: number): BucketLevel => {
    if (!Number.isFinite(value) || value <= t1) {
      return 1;
    }
    if (value <= t2) {
      return 2;
    }
    if (value <= t3) {
      return 3;
    }
    if (value <= t4) {
      return 4;
    }
    return 5;
  };
}

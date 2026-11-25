/**
 * Holdout / training year windows for §4.7.
 *
 * `--holdout H` is the held-out year Y−1. Training uses Y−10 … Y−2
 * (= H−9 … H−1).
 */

export type BacktestYearWindow = {
  readonly holdoutYear: number;
  /** Inclusive. */
  readonly trainFromYear: number;
  /** Inclusive. */
  readonly trainToYear: number;
};

export function yearWindowForHoldout(holdoutYear: number): BacktestYearWindow {
  if (!Number.isInteger(holdoutYear) || holdoutYear < 2005 || holdoutYear > 2100) {
    throw new RangeError(`holdout year must be an integer 2005–2100 (got ${String(holdoutYear)})`);
  }
  // Y = holdout + 1; train Y−10 … Y−2 → holdout−9 … holdout−1
  return {
    holdoutYear,
    trainFromYear: holdoutYear - 9,
    trainToYear: holdoutYear - 1,
  };
}

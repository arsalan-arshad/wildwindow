/**
 * Factor G — light / golden-hour overlap for a 2-hour block (§4.2 / T4.5).
 *
 * `G_b = 0.5 + 0.5 · (fraction of block b inside golden hour)`
 */
export function factorG(goldenFractionInBlock: number): number {
  if (
    typeof goldenFractionInBlock !== 'number' ||
    !Number.isFinite(goldenFractionInBlock) ||
    goldenFractionInBlock < 0 ||
    goldenFractionInBlock > 1
  ) {
    throw new RangeError(
      `goldenFractionInBlock must be in [0, 1], got ${String(goldenFractionInBlock)}`,
    );
  }
  return 0.5 + 0.5 * goldenFractionInBlock;
}

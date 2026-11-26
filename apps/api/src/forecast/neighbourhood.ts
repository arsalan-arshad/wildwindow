import { TIER_POLICY, type Tier } from '@wildwindow/geoprivacy';
import { getResolution, gridDisk, isValidCell } from 'h3-js';

/**
 * Neighbourhood N(c) for history aggregates (ARCHITECTURE §4.1):
 * kRing 1 at res 7; the display cell alone at coarser resolutions.
 */
export function neighbourhoodCells(displayCell: string, tier: Tier): readonly string[] {
  if (!isValidCell(displayCell)) {
    throw new RangeError(`invalid display cell: ${displayCell}`);
  }
  const policy = TIER_POLICY[tier];
  if (policy.resolution === null) {
    return [];
  }
  const resolution = getResolution(displayCell);
  if (resolution !== policy.resolution) {
    throw new RangeError(
      `display cell res-${String(resolution)} does not match tier ${tier} res-${String(policy.resolution)}`,
    );
  }
  if (policy.kRing <= 0) {
    return [displayCell];
  }
  return gridDisk(displayCell, policy.kRing);
}
